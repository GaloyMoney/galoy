import { InsufficientBalanceError, InvalidCurrencyForWalletError } from "@domain/errors"
import { AmountCalculator, ErrorLevel, WalletCurrency } from "@domain/shared"
import { recordExceptionInCurrentSpan } from "@services/tracing"

import {
  InvalidLightningPaymentFlowBuilderStateError,
  IntraLedgerHashPresentInLnFlowError,
  LnHashPresentInIntraLedgerFlowError,
} from "./errors"

import { RouteValidator } from "./route-validator"

export const PaymentFlowBase = <S extends WalletCurrency, R extends WalletCurrency>(
  state: PaymentFlowBaseState<S, R>,
): PaymentFlowBase<S, R> => {
  const protocolFeeInSenderWalletCurrency = (): PaymentAmount<S> => {
    return state.senderWalletCurrency === WalletCurrency.Btc
      ? (state.btcProtocolFee as PaymentAmount<S>)
      : (state.usdProtocolFee as PaymentAmount<S>)
  }

  const paymentAmounts = (): { btc: BtcPaymentAmount; usd: UsdPaymentAmount } => ({
    btc: state.btcPaymentAmount,
    usd: state.usdPaymentAmount,
  })

  const totalAmountsForPayment = (): {
    btc: BtcPaymentAmount
    usd: UsdPaymentAmount
  } => ({
    btc: AmountCalculator().add(state.btcPaymentAmount, state.btcProtocolFee),
    usd: AmountCalculator().add(state.usdPaymentAmount, state.usdProtocolFee),
  })

  const routeDetails = (): {
    rawRoute: RawRoute | undefined
    outgoingNodePubkey: Pubkey | undefined
  } => {
    const uncheckedRawRoute = state.cachedRoute

    let rawRoute: RawRoute | undefined = uncheckedRawRoute
    if (uncheckedRawRoute) {
      const validateRoute = RouteValidator(uncheckedRawRoute).validate(
        state.btcPaymentAmount,
      )
      if (validateRoute instanceof Error) {
        rawRoute = undefined
        recordExceptionInCurrentSpan({ error: validateRoute, level: ErrorLevel.Warn })
      }
    }

    return {
      rawRoute,
      outgoingNodePubkey: rawRoute ? state.outgoingNodePubkey : undefined,
    }
  }

  const recipientDetails = (): {
    recipientWalletId: WalletId | undefined
    recipientWalletCurrency: WalletCurrency | undefined
    recipientPubkey: Pubkey | undefined
    recipientUsername: Username | undefined
  } => ({
    recipientWalletId: state.recipientWalletId,
    recipientWalletCurrency: state.recipientWalletCurrency,
    recipientPubkey: state.recipientPubkey,
    recipientUsername: state.recipientUsername,
  })

  const senderWalletDescriptor = (): WalletDescriptor<S> => ({
    id: state.senderWalletId,
    currency: state.senderWalletCurrency,
  })

  const recipientWalletDescriptor = (): WalletDescriptor<R> | undefined =>
    state.recipientWalletId && state.recipientWalletCurrency
      ? {
          id: state.recipientWalletId,
          currency: state.recipientWalletCurrency,
        }
      : undefined

  const checkBalanceForSend = (
    balanceAmount: BalanceAmount<S>,
  ): true | ValidationError => {
    if (state.senderWalletCurrency !== balanceAmount.currency)
      return new InvalidCurrencyForWalletError()

    const { amount, fee } =
      balanceAmount.currency === WalletCurrency.Btc
        ? { amount: state.btcPaymentAmount, fee: state.btcProtocolFee }
        : { amount: state.usdPaymentAmount, fee: state.usdProtocolFee }
    const totalSendAmount = AmountCalculator().add(amount, fee)

    if (balanceAmount.amount < totalSendAmount.amount) {
      const unitForMsg =
        state.senderWalletCurrency === WalletCurrency.Btc ? "sats" : "cents"
      return new InsufficientBalanceError(
        `Payment amount '${totalSendAmount.amount}' ${unitForMsg} exceeds balance '${balanceAmount.amount}'`,
      )
    }

    return true
  }

  return {
    protocolFeeInSenderWalletCurrency,
    paymentAmounts,
    totalAmountsForPayment,
    routeDetails,
    recipientDetails,
    senderWalletDescriptor,
    recipientWalletDescriptor,
    checkBalanceForSend,
  }
}

export const PaymentFlow = <S extends WalletCurrency, R extends WalletCurrency>(
  state: PaymentFlowState<S, R>,
): PaymentFlow<S, R> | ValidationError => {
  const { paymentHash, intraLedgerHash, ...baseState } = state

  const paymentHashForFlow = (): PaymentHash | ValidationError => {
    if (!!paymentHash === !!intraLedgerHash) {
      return new InvalidLightningPaymentFlowBuilderStateError()
    }

    if (!paymentHash) {
      return new IntraLedgerHashPresentInLnFlowError()
    }

    return paymentHash
  }

  const intraLedgerHashForFlow = (): IntraLedgerHash | ValidationError => {
    if (!!paymentHash === !!intraLedgerHash) {
      return new InvalidLightningPaymentFlowBuilderStateError()
    }

    if (!intraLedgerHash) {
      return new LnHashPresentInIntraLedgerFlowError()
    }

    return intraLedgerHash
  }

  return {
    ...state,
    ...PaymentFlowBase(baseState),
    paymentHashForFlow,
    intraLedgerHashForFlow,
  }
}

export const OnChainPaymentFlow = <S extends WalletCurrency, R extends WalletCurrency>(
  state: OnChainPaymentFlowState<S, R>,
): OnChainPaymentFlow<S, R> => {
  const { address, ...baseState } = state

  const addressForFlow = (): OnChainAddress | ValidationError => {
    if (address === undefined) {
      return new InvalidLightningPaymentFlowBuilderStateError()
    }

    return address
  }

  return {
    ...state,
    ...PaymentFlowBase(baseState),
    addressForFlow,
  }
}
