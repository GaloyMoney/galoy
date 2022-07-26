import { ValidationError, WalletCurrency } from "@domain/shared"
import { SelfPaymentError } from "@domain/errors"
import { PaymentInitiationMethod, SettlementMethod } from "@domain/wallets"
import { checkedToBtcPaymentAmount, checkedToUsdPaymentAmount } from "@domain/payments"
import { generateIntraLedgerHash } from "@domain/payments/get-intraledger-hash"

import {
  InvalidLightningPaymentFlowBuilderStateError,
  InvalidLightningPaymentFlowStateError,
} from "./errors"
import { LnFees } from "./ln-fees"
import { PriceRatio } from "./price-ratio"
import { PaymentFlow } from "./payment-flow"

export const LightningPaymentFlowBuilder = <S extends WalletCurrency>(
  config: LightningPaymentFlowBuilderConfig,
): LightningPaymentFlowBuilder<S> => {
  const settlementMethodFromDestination = (
    destination: Pubkey | undefined,
  ): {
    settlementMethod: SettlementMethod
    btcProtocolFee: BtcPaymentAmount | undefined
    usdProtocolFee: UsdPaymentAmount | undefined
  } => {
    const settlementMethod =
      destination === undefined
        ? SettlementMethod.IntraLedger
        : config.localNodeIds.includes(destination)
        ? SettlementMethod.IntraLedger
        : SettlementMethod.Lightning
    return {
      settlementMethod,
      btcProtocolFee:
        settlementMethod === SettlementMethod.IntraLedger
          ? LnFees().intraLedgerFees().btc
          : undefined,
      usdProtocolFee:
        settlementMethod === SettlementMethod.IntraLedger
          ? LnFees().intraLedgerFees().usd
          : undefined,
    }
  }

  const withInvoice: LightningPaymentFlowBuilder<S>["withInvoice"] = (invoice) => {
    if (invoice.paymentAmount === null) {
      return LPFBWithError(
        new InvalidLightningPaymentFlowBuilderStateError(
          "withInvoice - paymentAmount missing",
        ),
      )
    }
    return LPFBWithInvoice({
      ...config,
      ...settlementMethodFromDestination(invoice.destination),
      paymentInitiationMethod: PaymentInitiationMethod.Lightning,
      paymentHash: invoice.paymentHash,
      btcPaymentAmount: invoice.paymentAmount,
      inputAmount: invoice.paymentAmount.amount,
      descriptionFromInvoice: invoice.description,
    })
  }

  const withNoAmountInvoice: LightningPaymentFlowBuilder<S>["withNoAmountInvoice"] = ({
    invoice,
    uncheckedAmount,
  }) => {
    return LPFBWithInvoice({
      ...config,
      ...settlementMethodFromDestination(invoice.destination),
      paymentInitiationMethod: PaymentInitiationMethod.Lightning,
      paymentHash: invoice.paymentHash,
      uncheckedAmount,
      descriptionFromInvoice: invoice.description,
    })
  }

  const withoutInvoice: LightningPaymentFlowBuilder<S>["withoutInvoice"] = ({
    uncheckedAmount,
    description,
  }) => {
    return LPFBWithInvoice({
      ...config,
      ...settlementMethodFromDestination(undefined),
      paymentInitiationMethod: PaymentInitiationMethod.IntraLedger,
      intraLedgerHash: generateIntraLedgerHash(),
      uncheckedAmount,
      // @Samer why does this compile? description can be null
      // descriptionFromInvoice: string
      descriptionFromInvoice: description,
    })
  }

  return {
    withInvoice,
    withNoAmountInvoice,
    withoutInvoice,
  }
}

const LPFBWithInvoice = <S extends WalletCurrency>(
  state: LPFBWithInvoiceState,
): LPFBWithInvoice<S> | LPFBWithError => {
  const withSenderWallet = (senderWallet: WalletDescriptor<S>) => {
    const { id: senderWalletId, currency: senderWalletCurrency } = senderWallet
    if (state.uncheckedAmount !== undefined) {
      if (senderWalletCurrency === WalletCurrency.Btc) {
        const paymentAmount = checkedToBtcPaymentAmount(state.uncheckedAmount)
        if (paymentAmount instanceof ValidationError) {
          return LPFBWithError(paymentAmount)
        }
        return LPFBWithSenderWallet({
          ...state,
          senderWalletId,
          senderWalletCurrency,
          btcPaymentAmount: paymentAmount,
          inputAmount: paymentAmount.amount,
          btcProtocolFee: state.btcProtocolFee || LnFees().maxProtocolFee(paymentAmount),
        })
      } else {
        const paymentAmount = checkedToUsdPaymentAmount(state.uncheckedAmount)
        if (paymentAmount instanceof ValidationError) {
          return LPFBWithError(paymentAmount)
        }
        return LPFBWithSenderWallet({
          ...state,
          senderWalletId,
          senderWalletCurrency,
          usdPaymentAmount: paymentAmount,
          inputAmount: paymentAmount.amount,
          usdProtocolFee: state.usdProtocolFee || LnFees().maxProtocolFee(paymentAmount),
        })
      }
    }

    const inputAmount = state.inputAmount
    const btcPaymentAmount = state.btcPaymentAmount
    if (inputAmount && btcPaymentAmount) {
      return LPFBWithSenderWallet({
        ...state,
        senderWalletId,
        senderWalletCurrency,
        btcPaymentAmount,
        btcProtocolFee: state.btcProtocolFee || LnFees().maxProtocolFee(btcPaymentAmount),
        inputAmount,
      })
    }

    throw new Error("withSenderWallet impossible")
  }

  return {
    withSenderWallet,
  }
}

const LPFBWithSenderWallet = <S extends WalletCurrency>(
  state: LPFBWithSenderWalletState<S>,
): LPFBWithSenderWallet<S> | LPFBWithError => {
  const withoutRecipientWallet = <R extends WalletCurrency>():
    | LPFBWithRecipientWallet<S, R>
    | LPFBWithError => {
    if (state.settlementMethod === SettlementMethod.IntraLedger) {
      return LPFBWithError(
        new InvalidLightningPaymentFlowBuilderStateError(
          "withoutRecipientWallet called but settlementMethod is IntraLedger",
        ),
      )
    }
    return LPFBWithRecipientWallet({ ...state })
  }

  const withRecipientWallet = <R extends WalletCurrency>({
    id: recipientWalletId,
    currency: recipientWalletCurrency,
    pubkey: recipientPubkey,
    usdPaymentAmount,
    username: recipientUsername,
  }: WalletDescriptor<R> & {
    pubkey?: Pubkey
    usdPaymentAmount?: UsdPaymentAmount
    username?: Username
  }): LPFBWithRecipientWallet<S, R> | LPFBWithError => {
    if (recipientWalletId === state.senderWalletId) {
      return LPFBWithError(new SelfPaymentError())
    }
    if (
      recipientWalletCurrency === WalletCurrency.Usd &&
      // This means (usdPaymentAmount === undefined XNOR state.uncheckedAmount === undefined)
      // XNOR => if both or neither are set we get here - else we're fine
      !!usdPaymentAmount === !!state.uncheckedAmount
    ) {
      return LPFBWithError(
        new InvalidLightningPaymentFlowBuilderStateError(
          "withRecipientWallet incorrect combination of usdPaymentAmount and uncheckedAmount",
        ),
      )
    }
    return LPFBWithRecipientWallet({
      ...state,
      recipientWalletId,
      recipientWalletCurrency,
      recipientPubkey,
      recipientUsername,
      usdPaymentAmount: usdPaymentAmount || state.usdPaymentAmount,
    })
  }

  const isIntraLedger = () => state.settlementMethod === SettlementMethod.IntraLedger

  return {
    withoutRecipientWallet,
    withRecipientWallet,
    isIntraLedger,
  }
}

const LPFBWithRecipientWallet = <S extends WalletCurrency, R extends WalletCurrency>(
  state: LPFBWithRecipientWalletState<S, R>,
): LPFBWithRecipientWallet<S, R> | LPFBWithError => {
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
  }): LPFBWithConversion<S, R> | LPFBWithError => {
    const stateWithCreatedAt = { ...state, createdAt: new Date(Date.now()) }
    const { btcPaymentAmount, usdPaymentAmount, btcProtocolFee, usdProtocolFee } = state

    // Use mid price when no buy / sell required
    const noConversionRequired =
      (state.senderWalletCurrency === WalletCurrency.Btc &&
        state.settlementMethod === SettlementMethod.Lightning) ||
      (state.senderWalletCurrency as WalletCurrency) ===
        (state.recipientWalletCurrency as WalletCurrency)

    if (noConversionRequired) {
      if (btcPaymentAmount && btcProtocolFee) {
        if (usdPaymentAmount && usdProtocolFee) {
          return LPFBWithConversion(
            new Promise((res) =>
              res({
                ...stateWithCreatedAt,
                btcPaymentAmount,
                usdPaymentAmount,
                btcProtocolFee,
                usdProtocolFee,
              }),
            ),
          )
        }
        return LPFBWithConversion(
          state.usdFromBtcMidPriceFn(btcPaymentAmount).then((convertedAmount) => {
            if (convertedAmount instanceof Error) {
              return convertedAmount
            }
            const priceRatio = PriceRatio({
              usd: convertedAmount,
              btc: btcPaymentAmount,
            })
            if (priceRatio instanceof Error) return priceRatio

            const usdProtocolFee = priceRatio.convertFromBtcToCeil(btcProtocolFee)
            return {
              ...stateWithCreatedAt,
              btcPaymentAmount,
              usdPaymentAmount: convertedAmount,
              btcProtocolFee,
              usdProtocolFee,
            }
          }),
        )
      } else if (usdPaymentAmount && usdProtocolFee) {
        return LPFBWithConversion(
          state.btcFromUsdMidPriceFn(usdPaymentAmount).then((convertedAmount) => {
            if (convertedAmount instanceof Error) {
              return convertedAmount
            }
            const priceRatio = PriceRatio({
              btc: convertedAmount,
              usd: usdPaymentAmount,
            })
            if (priceRatio instanceof Error) return priceRatio

            const btcProtocolFee = priceRatio.convertFromUsd(usdProtocolFee)
            return {
              ...stateWithCreatedAt,
              btcPaymentAmount: convertedAmount,
              usdPaymentAmount,
              btcProtocolFee,
              usdProtocolFee,
            }
          }),
        )
      } else {
        return LPFBWithError(
          new InvalidLightningPaymentFlowBuilderStateError(
            "withConversion - btcPaymentAmount || btcProtocolFee not set",
          ),
        )
      }
    }

    // Convert to usd if necessary
    if (btcPaymentAmount && btcProtocolFee) {
      // We already know usd amount from the recipient invoice
      if (
        state.recipientWalletCurrency === WalletCurrency.Usd &&
        usdPaymentAmount &&
        usdProtocolFee
      ) {
        return LPFBWithConversion(
          Promise.resolve({
            ...stateWithCreatedAt,
            btcPaymentAmount,
            usdPaymentAmount,
            btcProtocolFee,
            usdProtocolFee,
          }),
        )
      }
      return LPFBWithConversion(
        usdFromBtc(btcPaymentAmount).then((convertedAmount) => {
          if (convertedAmount instanceof Error) {
            return convertedAmount
          }
          const priceRatio = PriceRatio({
            usd: convertedAmount,
            btc: btcPaymentAmount,
          })
          if (priceRatio instanceof Error) return priceRatio

          const usdProtocolFee = priceRatio.convertFromBtcToCeil(btcProtocolFee)
          return {
            ...stateWithCreatedAt,
            btcPaymentAmount,
            usdPaymentAmount: convertedAmount,
            btcProtocolFee,
            usdProtocolFee,
          }
        }),
      )
    }

    if (usdPaymentAmount && usdProtocolFee) {
      return LPFBWithConversion(
        btcFromUsd(usdPaymentAmount).then((convertedAmount) => {
          if (convertedAmount instanceof Error) {
            return convertedAmount
          }
          const priceRatio = PriceRatio({
            btc: convertedAmount,
            usd: usdPaymentAmount,
          })
          if (priceRatio instanceof Error) return priceRatio

          const btcProtocolFee = priceRatio.convertFromUsd(usdProtocolFee)
          return {
            ...stateWithCreatedAt,
            btcPaymentAmount: convertedAmount,
            usdPaymentAmount,
            btcProtocolFee,
            usdProtocolFee,
          }
        }),
      )
    }

    return LPFBWithError(
      new InvalidLightningPaymentFlowBuilderStateError(
        "withConversion - impossible withConversion state",
      ),
    )
  }

  return {
    withConversion,
  }
}

const LPFBWithConversion = <S extends WalletCurrency, R extends WalletCurrency>(
  statePromise: Promise<LPFBWithConversionState<S, R> | DealerPriceServiceError>,
): LPFBWithConversion<S, R> | LPFBWithError => {
  const paymentFromState = (
    state: LPFBWithRouteState<S, R>,
  ): PaymentFlow<S, R> | ValidationError => {
    const hash = state.paymentHash
      ? { paymentHash: state.paymentHash }
      : state.intraLedgerHash
      ? { intraLedgerHash: state.intraLedgerHash }
      : new InvalidLightningPaymentFlowStateError()
    if (hash instanceof Error) return hash

    return PaymentFlow({
      ...hash,

      senderWalletId: state.senderWalletId,
      senderWalletCurrency: state.senderWalletCurrency,
      recipientWalletId: state.recipientWalletId,
      recipientWalletCurrency: state.recipientWalletCurrency,
      recipientPubkey: state.recipientPubkey,
      recipientUsername: state.recipientUsername,

      descriptionFromInvoice: state.descriptionFromInvoice,
      btcPaymentAmount: state.btcPaymentAmount,
      usdPaymentAmount: state.usdPaymentAmount,
      inputAmount: state.inputAmount,
      createdAt: state.createdAt,
      paymentSentAndPending: false,

      settlementMethod: state.settlementMethod,
      paymentInitiationMethod: state.paymentInitiationMethod,

      btcProtocolFee: state.btcProtocolFee,
      usdProtocolFee: state.usdProtocolFee,

      outgoingNodePubkey: state.outgoingNodePubkey,
      cachedRoute: state.checkedRoute,
    })
  }

  const withoutRoute = async () => {
    const state = await statePromise
    if (state instanceof Error) return state

    return paymentFromState({
      ...state,
      outgoingNodePubkey: undefined,
      checkedRoute: undefined,
    })
  }

  const withRoute = async ({
    pubkey,
    rawRoute,
  }: {
    pubkey: Pubkey
    rawRoute: RawRoute
  }): Promise<PaymentFlow<S, R> | ValidationError | DealerPriceServiceError> => {
    const state = await statePromise
    if (state instanceof Error) return state

    const priceRatio = PriceRatio({
      usd: state.usdPaymentAmount,
      btc: state.btcPaymentAmount,
    })
    if (priceRatio instanceof Error) return priceRatio

    const btcProtocolFee = LnFees().feeFromRawRoute(rawRoute)
    if (btcProtocolFee instanceof Error) return btcProtocolFee
    const usdProtocolFee = priceRatio.convertFromBtcToCeil(btcProtocolFee)

    return paymentFromState({
      ...state,
      outgoingNodePubkey: pubkey,
      checkedRoute: rawRoute,
      btcProtocolFee,
      usdProtocolFee,
    })
  }

  const btcPaymentAmount = async () => {
    const state = await Promise.resolve(statePromise)
    if (state instanceof Error) return state

    return state.btcPaymentAmount
  }

  const usdPaymentAmount = async () => {
    const state = await Promise.resolve(statePromise)
    if (state instanceof Error) return state

    return state.usdPaymentAmount
  }

  const isIntraLedger = async () => {
    const state = await Promise.resolve(statePromise)
    if (state instanceof Error) return state

    return state.settlementMethod === SettlementMethod.IntraLedger
  }

  return {
    withRoute,
    withoutRoute,
    btcPaymentAmount,
    usdPaymentAmount,
    isIntraLedger,
  }
}

const LPFBWithError = (
  error:
    | ValidationError
    | SelfPaymentError
    | DealerPriceServiceError
    | InvalidLightningPaymentFlowBuilderStateError,
): LPFBWithError => {
  const withSenderWallet = () => {
    return LPFBWithError(error)
  }
  const withoutRecipientWallet = () => {
    return LPFBWithError(error)
  }
  const withRecipientWallet = () => {
    return LPFBWithError(error)
  }
  const withConversion = () => {
    return LPFBWithError(error)
  }
  const withRoute = async () => {
    return Promise.resolve(error)
  }
  const withoutRoute = async () => {
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
    withSenderWallet,
    withoutRecipientWallet,
    withRecipientWallet,
    withConversion,
    isIntraLedger,
    withRoute,
    withoutRoute,
    btcPaymentAmount,
    usdPaymentAmount,
  }
}
