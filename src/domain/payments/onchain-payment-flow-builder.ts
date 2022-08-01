import { getFeesConfig } from "@config"
import { paymentAmountFromNumber, ValidationError, WalletCurrency } from "@domain/shared"
import { SelfPaymentError } from "@domain/errors"
import { OnChainFees, PaymentInitiationMethod, SettlementMethod } from "@domain/wallets"
import { checkedToBtcPaymentAmount, checkedToUsdPaymentAmount } from "@domain/payments"
import { ImbalanceCalculator } from "@domain/ledger/imbalance-calculator"

import { InvalidOnChainPaymentFlowBuilderStateError } from "./errors"
import { PriceRatio } from "./price-ratio"
import { OnChainPaymentFlow } from "./payment-flow"

const feeConfig = getFeesConfig()
const onChainFees = OnChainFees({
  feeRatioAsBasisPoints: feeConfig.withdrawRatioAsBasisPoints,
  thresholdImbalance: {
    amount: BigInt(feeConfig.withdrawThreshold),
    currency: WalletCurrency.Btc,
  },
})

export const OnChainPaymentFlowBuilder = <S extends WalletCurrency>(
  config: OnChainPaymentFlowBuilderConfig,
): OnChainPaymentFlowBuilder<S> => {
  const settlementMethodFromAddress = async (
    address: OnChainAddress,
  ): Promise<SettlementMethod> => {
    const isExternal = await config.isExternalAddress(address)
    return isExternal ? SettlementMethod.OnChain : SettlementMethod.IntraLedger
  }

  const withAddress = (address: OnChainAddress): OPFBWithAddress<S> | OPFBWithError => {
    // TODO: validate onchain address?
    if (!address) {
      return OPFBWithError(
        new InvalidOnChainPaymentFlowBuilderStateError("invalid address"),
      )
    }

    return OPFBWithAddress({
      ...config,

      paymentInitiationMethod: PaymentInitiationMethod.OnChain,
      settlementMethodPromise: settlementMethodFromAddress(address),
      address,
    })
  }

  return {
    withAddress,
  }
}

const OPFBWithAddress = <S extends WalletCurrency>(
  state: OPFBWithAddressState,
): OPFBWithAddress<S> | OPFBWithError => {
  const withSenderWalletAndAccount = ({
    wallet,
    account,
  }: {
    wallet: WalletDescriptor<S>
    account: Account
  }) => {
    const { id: senderWalletId, currency: senderWalletCurrency } = wallet
    const { withdrawFee: senderWithdrawFee } = account
    return OPFBWithSenderWalletAndAccount({
      ...state,
      senderWalletId,
      senderWalletCurrency,
      senderWithdrawFee,
    })
  }

  return {
    withSenderWalletAndAccount,
  }
}

const OPFBWithSenderWalletAndAccount = <S extends WalletCurrency>(
  state: OPFBWithSenderWalletAndAccountState<S>,
): OPFBWithSenderWalletAndAccount<S> | OPFBWithError => {
  const settlementMethodFromRecipientWallet = (
    walletId: WalletId | undefined,
  ): {
    settlementMethod: SettlementMethod
  } => ({
    settlementMethod:
      walletId === undefined ? SettlementMethod.OnChain : SettlementMethod.IntraLedger,
  })

  const withoutRecipientWallet = <R extends WalletCurrency>():
    | OPFBWithRecipientWallet<S, R>
    | OPFBWithError => {
    return OPFBWithRecipientWallet({
      ...state,
      ...settlementMethodFromRecipientWallet(undefined),
    })
  }

  const withRecipientWallet = <R extends WalletCurrency>({
    id: recipientWalletId,
    currency: recipientWalletCurrency,
    pubkey: recipientPubkey,
    username: recipientUsername,
  }: WalletDescriptor<R> & {
    pubkey?: Pubkey
    usdPaymentAmount?: UsdPaymentAmount
    username?: Username
  }): OPFBWithRecipientWallet<S, R> | OPFBWithError => {
    if (recipientWalletId === state.senderWalletId) {
      return OPFBWithError(new SelfPaymentError())
    }
    return OPFBWithRecipientWallet({
      ...state,
      ...settlementMethodFromRecipientWallet(recipientWalletId),
      recipientWalletId,
      recipientWalletCurrency,
      recipientPubkey,
      recipientUsername,
    })
  }

  return {
    withoutRecipientWallet,
    withRecipientWallet,
  }
}

const OPFBWithRecipientWallet = <S extends WalletCurrency, R extends WalletCurrency>(
  state: OPFBWithRecipientWalletState<S, R>,
): OPFBWithRecipientWallet<S, R> | OPFBWithError => {
  const withAmount = (uncheckedAmount: number): OPFBWithAmount<S, R> | OPFBWithError => {
    const paymentAmount =
      state.senderWalletCurrency === WalletCurrency.Btc
        ? checkedToBtcPaymentAmount(uncheckedAmount)
        : checkedToUsdPaymentAmount(uncheckedAmount)
    if (paymentAmount instanceof ValidationError) {
      return OPFBWithError(paymentAmount)
    }

    return paymentAmount.currency === WalletCurrency.Btc
      ? OPFBWithAmount({
          ...state,
          inputAmount: paymentAmount.amount,
          btcPaymentAmount: paymentAmount,
        })
      : OPFBWithAmount({
          ...state,
          inputAmount: paymentAmount.amount,
          usdPaymentAmount: paymentAmount,
        })
  }

  return {
    withAmount,
  }
}

const OPFBWithAmount = <S extends WalletCurrency, R extends WalletCurrency>(
  state: OPFBWithAmountState<S, R>,
): OPFBWithAmount<S, R> | OPFBWithError => {
  const withConversion = ({
    usdFromBtc,
    btcFromUsd,
  }: {
    usdFromBtc(
      amount: BtcPaymentAmount,
    ): Promise<UsdPaymentAmount | DealerPriceServiceError>
    btcFromUsd(
      amount: UsdPaymentAmount,
    ): Promise<BtcPaymentAmount | DealerPriceServiceError>
  }): OPFBWithConversion<S, R> | OPFBWithError => {
    const stateWithCreatedAt = {
      ...state,
      createdAt: new Date(Date.now()),
      paymentSentAndPending: false,
    }
    const { btcPaymentAmount, usdPaymentAmount } = state

    // Use mid price when no buy / sell required
    const noConversionRequired =
      (state.senderWalletCurrency === WalletCurrency.Btc &&
        state.settlementMethod === SettlementMethod.Lightning) ||
      (state.senderWalletCurrency as WalletCurrency) ===
        (state.recipientWalletCurrency as WalletCurrency)

    if (noConversionRequired) {
      if (btcPaymentAmount) {
        if (usdPaymentAmount) {
          return OPFBWithConversion(
            new Promise((res) =>
              res({
                ...stateWithCreatedAt,
                btcPaymentAmount,
                usdPaymentAmount,
              }),
            ),
          )
        }
        return OPFBWithConversion(
          state.usdFromBtcMidPriceFn(btcPaymentAmount).then((convertedAmount) => {
            if (convertedAmount instanceof Error) {
              return convertedAmount
            }
            const priceRatio = PriceRatio({
              usd: convertedAmount,
              btc: btcPaymentAmount,
            })
            if (priceRatio instanceof Error) return priceRatio

            return {
              ...stateWithCreatedAt,
              btcPaymentAmount,
              usdPaymentAmount: convertedAmount,
            }
          }),
        )
      } else if (usdPaymentAmount) {
        return OPFBWithConversion(
          state.btcFromUsdMidPriceFn(usdPaymentAmount).then((convertedAmount) => {
            if (convertedAmount instanceof Error) {
              return convertedAmount
            }
            const priceRatio = PriceRatio({
              btc: convertedAmount,
              usd: usdPaymentAmount,
            })
            if (priceRatio instanceof Error) return priceRatio

            return {
              ...stateWithCreatedAt,
              btcPaymentAmount: convertedAmount,
              usdPaymentAmount,
            }
          }),
        )
      } else {
        return OPFBWithError(
          new InvalidOnChainPaymentFlowBuilderStateError(
            "withConversion - btcPaymentAmount || btcProtocolFee not set",
          ),
        )
      }
    }

    // Convert to usd if necessary
    if (btcPaymentAmount) {
      return OPFBWithConversion(
        usdFromBtc(btcPaymentAmount).then((convertedAmount) => {
          if (convertedAmount instanceof Error) {
            return convertedAmount
          }
          const priceRatio = PriceRatio({
            usd: convertedAmount,
            btc: btcPaymentAmount,
          })
          if (priceRatio instanceof Error) return priceRatio

          return {
            ...stateWithCreatedAt,
            btcPaymentAmount,
            usdPaymentAmount: convertedAmount,
          }
        }),
      )
    }

    if (usdPaymentAmount) {
      return OPFBWithConversion(
        btcFromUsd(usdPaymentAmount).then((convertedAmount) => {
          if (convertedAmount instanceof Error) {
            return convertedAmount
          }
          const priceRatio = PriceRatio({
            btc: convertedAmount,
            usd: usdPaymentAmount,
          })
          if (priceRatio instanceof Error) return priceRatio

          return {
            ...stateWithCreatedAt,
            btcPaymentAmount: convertedAmount,
            usdPaymentAmount,
          }
        }),
      )
    }

    return OPFBWithError(
      new InvalidOnChainPaymentFlowBuilderStateError(
        "withConversion - impossible withConversion state",
      ),
    )
  }

  return {
    withConversion,
  }
}

const OPFBWithConversion = <S extends WalletCurrency, R extends WalletCurrency>(
  statePromise: Promise<OPFBWithConversionState<S, R> | DealerPriceServiceError>,
): OPFBWithConversion<S, R> | OPFBWithError => {
  const stateFromPromise = async (
    statePromise: Promise<OPFBWithConversionState<S, R> | DealerPriceServiceError>,
  ) => {
    const state = await statePromise
    if (state instanceof Error) return state

    const settlementMethod = await state.settlementMethodPromise
    if (settlementMethod === SettlementMethod.IntraLedger && !state.recipientWalletId) {
      return new InvalidOnChainPaymentFlowBuilderStateError(
        "withoutRecipientWallet called but settlementMethod is IntraLedger",
      )
    }
    return state
  }

  const withoutMinerFee = async (): Promise<
    OnChainPaymentFlow<S, R> | ValidationError | DealerPriceServiceError
  > => {
    const state = await stateFromPromise(statePromise)
    if (state instanceof Error) return state

    return OnChainPaymentFlow({
      ...state,
      outgoingNodePubkey: undefined,
      paymentSentAndPending: false,
      btcProtocolFee: onChainFees.intraLedgerFees().btc,
      usdProtocolFee: onChainFees.intraLedgerFees().usd,
    })
  }

  const withMinerFee = async (
    minerFee: BtcPaymentAmount,
  ): Promise<OnChainPaymentFlow<S, R> | ValidationError | DealerPriceServiceError> => {
    const state = await stateFromPromise(statePromise)
    if (state instanceof Error) return state

    const priceRatio = PriceRatio({
      usd: state.usdPaymentAmount,
      btc: state.btcPaymentAmount,
    })
    if (priceRatio instanceof Error) return priceRatio

    const minBankFee = paymentAmountFromNumber({
      amount: state.senderWithdrawFee || feeConfig.withdrawDefaultMin,
      currency: WalletCurrency.Btc,
    })
    if (minBankFee instanceof Error) return minBankFee

    const imbalanceCalculator = ImbalanceCalculator({
      method: feeConfig.withdrawMethod,
      volumeLightningFn: state.volumeLightningFn,
      volumeOnChainFn: state.volumeOnChainFn,
      sinceDaysAgo: feeConfig.withdrawDaysLookback,
    })
    const imbalanceForWallet = await imbalanceCalculator.getSwapOutImbalanceAmount<S>({
      id: state.senderWalletId,
      currency: state.senderWalletCurrency,
    })
    if (imbalanceForWallet instanceof Error) return imbalanceForWallet

    const imbalance =
      imbalanceForWallet.currency === WalletCurrency.Btc
        ? (imbalanceForWallet as BtcPaymentAmount)
        : priceRatio.convertFromUsd(imbalanceForWallet as UsdPaymentAmount)

    const feeAmounts = onChainFees.withdrawalFee({
      minerFee,
      amount: state.btcPaymentAmount,
      minBankFee,
      imbalance,
    })
    return OnChainPaymentFlow({
      ...state,
      btcProtocolFee: feeAmounts.totalFee,
      usdProtocolFee: priceRatio.convertFromBtcToCeil(feeAmounts.totalFee),
      paymentSentAndPending: false,
    })
  }

  const btcPaymentAmount = async () => {
    const state = await stateFromPromise(statePromise)
    if (state instanceof Error) return state

    return state.btcPaymentAmount
  }

  const usdPaymentAmount = async () => {
    const state = await stateFromPromise(statePromise)
    if (state instanceof Error) return state

    return state.usdPaymentAmount
  }

  const isIntraLedger = async () => {
    const state = await stateFromPromise(statePromise)
    if (state instanceof Error) return state

    return state.settlementMethod === SettlementMethod.IntraLedger
  }

  return {
    withoutMinerFee,
    withMinerFee,
    btcPaymentAmount,
    usdPaymentAmount,
    isIntraLedger,
  }
}

const OPFBWithError = (
  error:
    | ValidationError
    | SelfPaymentError
    | DealerPriceServiceError
    | InvalidOnChainPaymentFlowBuilderStateError,
): OPFBWithError => {
  const withSenderWalletAndAccount = () => {
    return OPFBWithError(error)
  }
  const withAmount = () => {
    return OPFBWithError(error)
  }
  const withoutRecipientWallet = () => {
    return OPFBWithError(error)
  }
  const withRecipientWallet = () => {
    return OPFBWithError(error)
  }
  const withConversion = () => {
    return OPFBWithError(error)
  }
  const withMinerFee = () => {
    return Promise.resolve(error)
  }
  const withoutMinerFee = () => {
    return Promise.resolve(error)
  }
  const isIntraLedger = async () => {
    return Promise.resolve(error)
  }
  const btcPaymentAmount = async () => {
    return Promise.resolve(error)
  }

  const usdPaymentAmount = async () => {
    return Promise.resolve(error)
  }

  return {
    withSenderWalletAndAccount,
    withAmount,
    withoutRecipientWallet,
    withRecipientWallet,
    withConversion,
    withMinerFee,
    withoutMinerFee,
    isIntraLedger,
    btcPaymentAmount,
    usdPaymentAmount,
  }
}
