import {
  MEMO_SHARING_SATS_THRESHOLD,
  MEMO_SHARING_CENTS_THRESHOLD,
  onboardingEarn,
} from "@config"
import { toSats } from "@domain/bitcoin"
import { ExtendedLedgerTransactionType, LedgerTransactionType } from "@domain/ledger"

import { WalletCurrency } from "./primitives"

import { PaymentInitiationMethod, SettlementMethod } from "./tx-methods"
import { TxStatus } from "./tx-status"

const filterPendingIncoming = (
  walletId: WalletId,
  pendingTransactions: IncomingOnChainTransaction[],
  addresses: OnChainAddress[],
  displayCurrencyPerSat: DisplayCurrencyPerSat,
): WalletOnChainTransaction[] => {
  const walletTransactions: WalletOnChainTransaction[] = []
  pendingTransactions.forEach(({ rawTx, createdAt }) => {
    // TODO: manage the case where walletCurrency associated
    // with WalletId is not WalletCurrency.Btc

    rawTx.outs.forEach(({ sats, address }) => {
      if (address && addresses.includes(address)) {
        walletTransactions.push({
          currency: WalletCurrency.Btc,
          id: rawTx.txHash,
          walletId,
          settlementAmount: sats,
          settlementFee: toSats(0),
          settlementDisplayCurrencyPerSat: displayCurrencyPerSat,
          status: TxStatus.Pending,
          memo: null,
          createdAt: createdAt,
          initiationVia: {
            type: PaymentInitiationMethod.OnChain,
            address,
          },
          settlementVia: {
            type: SettlementMethod.OnChain,
            transactionHash: rawTx.txHash,
          },
        })
      }
    })
  })
  return walletTransactions
}

export const fromLedger = (
  ledgerTransactions: LedgerTransaction[],
): ConfirmedTransactionHistory => {
  const transactions: WalletTransaction[] = ledgerTransactions.map(
    ({
      id,
      walletId,
      recipientWalletId,
      memoFromPayer,
      lnMemo,
      type,
      credit,
      debit,
      fee,
      usd,
      paymentHash,
      txHash,
      pubkey,
      username,
      address,
      pendingConfirmation,
      timestamp,
      currency,
    }) => {
      const settlementAmount = toSats(credit - debit)

      const memo = translateMemo({
        memoFromPayer,
        lnMemo,
        credit,
        currency,
      })

      const status = pendingConfirmation ? TxStatus.Pending : TxStatus.Success

      const baseTransaction = {
        id,
        walletId,
        settlementAmount,
        settlementFee: toSats(fee || 0),
        settlementDisplayCurrencyPerSat: Math.abs(usd / settlementAmount),
        status,
        memo,
        createdAt: timestamp,
        currency,
      }

      let txType: ExtendedLedgerTransactionType = type
      if (type == LedgerTransactionType.IntraLedger && paymentHash) {
        txType = ExtendedLedgerTransactionType.LnIntraLedger
      }

      const defaultOnChainAddress = "<no-address>" as OnChainAddress

      let walletTransaction: WalletTransaction
      switch (txType) {
        case ExtendedLedgerTransactionType.IntraLedger:
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
          return walletTransaction

        case ExtendedLedgerTransactionType.OnchainIntraLedger:
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
          return walletTransaction

        case ExtendedLedgerTransactionType.OnchainPayment:
        case ExtendedLedgerTransactionType.OnchainReceipt:
          walletTransaction = {
            ...baseTransaction,
            initiationVia: {
              type: PaymentInitiationMethod.OnChain,
              address: address || defaultOnChainAddress,
            },
            settlementVia: {
              type: SettlementMethod.OnChain,
              transactionHash: txHash as OnChainTxHash,
            },
          }
          return walletTransaction

        case ExtendedLedgerTransactionType.LnIntraLedger:
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
          return walletTransaction

        case ExtendedLedgerTransactionType.Payment:
        case ExtendedLedgerTransactionType.Invoice:
          walletTransaction = {
            ...baseTransaction,
            initiationVia: {
              type: PaymentInitiationMethod.Lightning,
              paymentHash: paymentHash as PaymentHash,
              pubkey: pubkey as Pubkey,
            },
            settlementVia: {
              type: SettlementMethod.Lightning,
              revealedPreImage: null,
            },
          }
          return walletTransaction
      }

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
      return walletTransaction
    },
  )

  return {
    transactions,
    addPendingIncoming: (
      walletId: WalletId,
      pendingIncoming: IncomingOnChainTransaction[],
      addresses: OnChainAddress[],
      displayCurrencyPerSat: DisplayCurrencyPerSat,
    ): WalletTransactionHistoryWithPending => ({
      transactions: [
        ...filterPendingIncoming(
          walletId,
          pendingIncoming,
          addresses,
          displayCurrencyPerSat,
        ),
        ...transactions,
      ],
    }),
  }
}

const shouldDisplayMemo = ({
  memo,
  currency,
  credit,
}: {
  memo: string | undefined
  currency: WalletCurrency
  credit: CurrencyBaseAmount
}) => {
  if (isAuthorizedMemo(memo)) return true
  if (credit === 0) return true

  if (currency === WalletCurrency.Btc) return credit >= MEMO_SHARING_SATS_THRESHOLD
  else return credit >= MEMO_SHARING_CENTS_THRESHOLD
}

const isAuthorizedMemo = (memo: string | undefined): boolean =>
  !!memo && Object.keys(onboardingEarn).includes(memo)

export const translateMemo = ({
  memoFromPayer,
  lnMemo,
  credit,
  currency,
}: {
  memoFromPayer?: string
  lnMemo?: string
  credit: CurrencyBaseAmount
  currency: WalletCurrency
}): string | null => {
  if (shouldDisplayMemo({ memo: memoFromPayer, credit, currency })) {
    if (memoFromPayer) {
      return memoFromPayer
    }
    if (lnMemo) {
      return lnMemo
    }
  }

  return null
}

export const WalletTransactionHistory = {
  fromLedger,
} as const
