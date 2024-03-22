import { LnPaymentState } from "../ledger/ln-payment-state"

import { TxStatus } from "./tx-status"

import { PaymentInitiationMethod, SettlementMethod } from "./tx-methods"

import { SettlementAmounts } from "./settlement-amounts"

import { UsdDisplayCurrency, priceAmountFromNumber, toCents } from "@/domain/fiat"
import { toSats } from "@/domain/bitcoin"
import { WalletCurrency } from "@/domain/shared"
import { AdminLedgerTransactionType, LedgerTransactionType } from "@/domain/ledger"

const translateLedgerTxnToWalletTxn = <S extends WalletCurrency>({
  txn,
  nonEndUserWalletIds,
  memoSharingConfig,
}: {
  txn: LedgerTransaction<S>
  nonEndUserWalletIds: WalletId[]
  memoSharingConfig: MemoSharingConfig
}): WalletTransaction => {
  const {
    type,
    credit,
    currency,
    satsAmount: satsAmountRaw,
    satsFee: satsFeeRaw,
    centsAmount: centsAmountRaw,
    centsFee: centsFeeRaw,
    displayAmount: displayAmountRaw,
    displayFee: displayFeeRaw,
    displayCurrency: displayCurrencyRaw,
    lnMemo,
    memoFromPayer,
    journalId,
    walletId,
  } = txn

  const displayCurrency = displayCurrencyRaw || UsdDisplayCurrency

  const isAdmin = Object.values(AdminLedgerTransactionType).includes(
    type as AdminLedgerTransactionType,
  )

  const { settlementAmount, settlementDisplayAmount, settlementDisplayFee } =
    SettlementAmounts().fromTxn(txn)

  let satsAmount = satsAmountRaw || 0
  let centsAmount = centsAmountRaw || 0
  let displayAmount = displayAmountRaw || 0
  let displayFee = displayFeeRaw || 0
  let satsFee = satsFeeRaw || 0
  let centsFee = centsFeeRaw || 0
  // Temp admin checks, to be removed when usd/feeUsd/fee fields are deprecated
  if (isAdmin) {
    displayAmount = txn.usd ? Math.round(txn.usd * 100) : 0
    displayFee = txn.feeUsd ? Math.round(txn.feeUsd * 100) : 0
    satsAmount = Math.abs(settlementAmount)
    satsFee = txn.fee || 0
    centsAmount = displayAmount
    centsFee = displayFee
  }

  const memo = translateMemo({
    memoFromPayer,
    lnMemo,
    credit,
    currency,
    walletId,
    nonEndUserWalletIds,
    journalId,
    memoSharingConfig,
  })

  const baseTransaction: BaseWalletTransaction = {
    id: txn.id,
    walletId: txn.walletId,
    settlementAmount,
    settlementFee: currency === WalletCurrency.Btc ? toSats(satsFee) : toCents(centsFee),
    settlementCurrency: txn.currency,
    settlementDisplayAmount,
    settlementDisplayFee,
    settlementDisplayPrice: displayCurrencyPerBaseUnitFromAmounts({
      displayAmount,
      displayCurrency,
      walletAmount: txn.currency === WalletCurrency.Btc ? satsAmount : centsAmount,
      walletCurrency: txn.currency,
    }),
    status: statusFromTxn(txn),
    memo,
    createdAt: txn.timestamp,
  }

  let txType = txn.type
  if (txn.type == LedgerTransactionType.IntraLedger && txn.paymentHash) {
    txType = LedgerTransactionType.LnIntraLedger
  }

  const defaultOnChainAddress = "<no-address>" as OnChainAddress

  const { recipientWalletId, username, pubkey, paymentHash, txHash, vout, address } = txn

  let walletTransaction: WalletTransaction
  switch (txType) {
    case LedgerTransactionType.IntraLedger:
    case LedgerTransactionType.WalletIdTradeIntraAccount:
      walletTransaction = {
        ...baseTransaction,
        initiationVia: {
          type: PaymentInitiationMethod.IntraLedger,
          counterPartyWalletId: recipientWalletId as WalletId,
          counterPartyUsername: username as Username,
        },
        settlementVia: {
          type: SettlementMethod.IntraLedger,
          counterPartyWalletId: recipientWalletId as WalletId,
          counterPartyUsername: username as Username,
        },
      }
      break

    case LedgerTransactionType.OnchainIntraLedger:
    case LedgerTransactionType.OnChainTradeIntraAccount:
      walletTransaction = {
        ...baseTransaction,
        initiationVia: {
          type: PaymentInitiationMethod.OnChain,
          address: address || defaultOnChainAddress,
        },
        settlementVia: {
          type: SettlementMethod.IntraLedger,
          counterPartyWalletId: recipientWalletId as WalletId,
          counterPartyUsername: username || null,
        },
      }
      break

    case LedgerTransactionType.OnchainPayment:
    case LedgerTransactionType.OnchainReceipt:
      walletTransaction = {
        ...baseTransaction,
        initiationVia: {
          type: PaymentInitiationMethod.OnChain,
          address: address || defaultOnChainAddress,
        },
        settlementVia: {
          type: SettlementMethod.OnChain,
          transactionHash: txHash as OnChainTxHash,
          vout: vout as OnChainTxVout,
        },
      }
      break

    case LedgerTransactionType.LnIntraLedger:
    case LedgerTransactionType.LnTradeIntraAccount:
      walletTransaction = {
        ...baseTransaction,
        initiationVia: {
          type: PaymentInitiationMethod.Lightning,
          paymentHash: paymentHash as PaymentHash,
          pubkey: pubkey as Pubkey,
        },
        settlementVia: {
          type: SettlementMethod.IntraLedger,
          counterPartyWalletId: recipientWalletId as WalletId,
          counterPartyUsername: username || null,
        },
      }
      break

    case LedgerTransactionType.Payment:
    case LedgerTransactionType.Invoice:
      walletTransaction = {
        ...baseTransaction,
        initiationVia: {
          type: PaymentInitiationMethod.Lightning,
          paymentHash: paymentHash as PaymentHash,
          pubkey: pubkey as Pubkey,
        },
        settlementVia: {
          type: SettlementMethod.Lightning,
          revealedPreImage: undefined, // is added by dataloader in resolver
        },
      }
      break

    default:
      walletTransaction = {
        ...baseTransaction,
        initiationVia: {
          type: PaymentInitiationMethod.IntraLedger,
          counterPartyWalletId: recipientWalletId as WalletId,
          counterPartyUsername: username as Username,
        },
        settlementVia: {
          type: SettlementMethod.IntraLedger,
          counterPartyWalletId: recipientWalletId as WalletId,
          counterPartyUsername: username || null,
        },
      }
  }

  return walletTransaction
}

const shouldDisplayMemo = ({
  memo,
  credit,
  currency,
  memoSharingConfig,
}: {
  memo: string | undefined
  credit: CurrencyBaseAmount
  currency: WalletCurrency
  memoSharingConfig: MemoSharingConfig
}) => {
  if ((!!memo && memoSharingConfig.authorizedMemos.includes(memo)) || credit === 0)
    return true

  if (currency === WalletCurrency.Btc)
    return credit >= memoSharingConfig.memoSharingSatsThreshold

  return credit >= memoSharingConfig.memoSharingCentsThreshold
}

const statusFromTxn = (txn: LedgerTransaction<WalletCurrency>): TxStatus => {
  switch (txn.lnPaymentState) {
    case undefined:
      return txn.pendingConfirmation ? TxStatus.Pending : TxStatus.Success

    case LnPaymentState.Pending:
    case LnPaymentState.PendingAfterRetry:
      return TxStatus.Pending

    case LnPaymentState.Success:
    case LnPaymentState.SuccessAfterRetry:
    case LnPaymentState.SuccessWithReimbursement:
    case LnPaymentState.SuccessWithReimbursementAfterRetry:
      return TxStatus.Success

    case LnPaymentState.Failed:
    case LnPaymentState.FailedAfterRetry:
    case LnPaymentState.FailedAfterSuccess:
    case LnPaymentState.FailedAfterSuccessWithReimbursement:
      return TxStatus.Failure
  }
}

export const translateMemo = ({
  memoFromPayer,
  lnMemo,
  credit,
  currency,
  walletId,
  nonEndUserWalletIds,
  journalId,
  memoSharingConfig,
}: {
  memoFromPayer?: string
  lnMemo?: string
  credit: CurrencyBaseAmount
  currency: WalletCurrency
  walletId: WalletId | undefined
  nonEndUserWalletIds: WalletId[]
  journalId: LedgerJournalId
  memoSharingConfig: MemoSharingConfig
}): string | null => {
  if (walletId && nonEndUserWalletIds.includes(walletId)) {
    return `JournalId:${journalId}`
  }

  const memo = memoFromPayer || lnMemo
  if (shouldDisplayMemo({ memo, credit, currency, memoSharingConfig })) {
    return memo || null
  }

  return null
}

export const WalletTransactionHistory = {
  fromLedger: translateLedgerTxnToWalletTxn,
} as const

// TODO: refactor this to use WalletPriceRatio eventually instead after
// 'usd' property removal from db
export const displayCurrencyPerBaseUnitFromAmounts = <
  S extends WalletCurrency,
  T extends DisplayCurrency,
>({
  displayAmount,
  displayCurrency,
  walletAmount,
  walletCurrency,
}: {
  displayAmount: number
  displayCurrency: T
  walletAmount: number
  walletCurrency: S
}): WalletMinorUnitDisplayPrice<S, T> => {
  const priceInMinorUnit = walletAmount !== 0 ? displayAmount / walletAmount : 0

  return priceAmountFromNumber({
    priceInMinorUnit,
    displayCurrency,
    walletCurrency,
  })
}
