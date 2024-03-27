import crypto from "crypto"

import { LedgerTransactionType } from "@/domain/ledger"
import { SettlementMethod, PaymentInitiationMethod, TxStatus } from "@/domain/wallets"
import {
  displayCurrencyPerBaseUnitFromAmounts,
  translateMemo,
  WalletTransactionHistory,
} from "@/domain/wallets/tx-history"
import { toSats } from "@/domain/bitcoin"
import {
  memoSharingConfig,
  MEMO_SHARING_CENTS_THRESHOLD,
  MEMO_SHARING_SATS_THRESHOLD,
} from "@/config"
import { WalletCurrency } from "@/domain/shared"
import { UsdDisplayCurrency, priceAmountFromNumber, toCents } from "@/domain/fiat"
import { LnPaymentState } from "@/domain/ledger/ln-payment-state"

describe("translates ledger txs to wallet txs", () => {
  const timestamp = new Date()

  const satsAmount = toSats(100_000)
  const satsFee = toSats(2)
  const centsAmount = toCents(2_000)
  const centsFee = toCents(10)
  const displayFee = 10 as DisplayCurrencyBaseAmount

  const baseLedgerTransaction = {
    id: "id" as LedgerTransactionId,
    satsFee,
    centsFee,
    displayFee,
    displayCurrency: UsdDisplayCurrency,
    pendingConfirmation: false,
    journalId: "journalId" as LedgerJournalId,
    timestamp,
    feeKnownInAdvance: false,
  }

  const baseWalletTransaction = {
    id: "id" as LedgerTransactionId,
    status: TxStatus.Success,
    createdAt: timestamp,
  }

  const ledgerTxnsInputs = ({
    walletId,
    settlementAmount,
    satsAmount,
    centsAmount,
    currency,
  }: {
    walletId: WalletId
    settlementAmount: Satoshis | UsdCents
    satsAmount: Satoshis
    centsAmount: UsdCents
    currency: WalletCurrency
  }): LedgerTransaction<WalletCurrency>[] => {
    const currencyBaseLedgerTxns = {
      ...baseLedgerTransaction,
      walletId,
      satsAmount,
      centsAmount,
      displayAmount: centsAmount as unknown as DisplayCurrencyBaseAmount,
      currency,

      fee: undefined,
      feeUsd: undefined,
      usd: undefined,
    }

    return [
      {
        ...currencyBaseLedgerTxns,
        type: LedgerTransactionType.Invoice,

        debit: toSats(0),
        credit: settlementAmount,

        paymentHash: "paymentHash" as PaymentHash,
        pubkey: "pubkey" as Pubkey,
        memoFromPayer: "SomeMemo",
      },
      {
        ...currencyBaseLedgerTxns,
        recipientWalletId: "walletIdRecipient" as WalletId,
        type: LedgerTransactionType.IntraLedger,

        debit: toSats(0),
        credit: settlementAmount,

        paymentHash: "paymentHash" as PaymentHash,
        pubkey: "pubkey" as Pubkey,
        username: "username" as Username,
      },
      {
        ...currencyBaseLedgerTxns,
        recipientWalletId: "walletIdRecipient" as WalletId,
        type: LedgerTransactionType.OnchainIntraLedger,

        debit: toSats(0),
        credit: settlementAmount,

        address: "address" as OnChainAddress,
        txHash: "txHash" as OnChainTxHash,
      },
      {
        ...currencyBaseLedgerTxns,
        type: LedgerTransactionType.OnchainReceipt,

        debit: toSats(0),
        credit: settlementAmount,

        address: "address" as OnChainAddress,
        txHash: "txHash" as OnChainTxHash,
      },
    ]
  }

  const expectedWalletTxns = ({
    walletId,
    settlementAmount,
    centsAmount,
    currency,
  }: {
    walletId: WalletId
    settlementAmount: Satoshis | UsdCents
    centsAmount: UsdCents
    currency: WalletCurrency
  }): WalletTransaction[] => {
    const displayCurrency = UsdDisplayCurrency

    const settlementFee = currency === WalletCurrency.Btc ? satsFee : centsFee
    const settlementDisplayPrice = displayCurrencyPerBaseUnitFromAmounts({
      displayAmount: centsAmount,
      displayCurrency,
      walletAmount: settlementAmount,
      walletCurrency: currency,
    })

    if (currency === WalletCurrency.Usd) {
      expect(settlementDisplayPrice).toEqual(
        priceAmountFromNumber({
          priceInMinorUnit: 1,
          displayCurrency,
          walletCurrency: currency,
        }),
      )
    }

    const currencyBaseWalletTxns = {
      ...baseWalletTransaction,
      walletId,
      settlementCurrency: currency,

      settlementAmount,
      settlementFee,
      settlementDisplayAmount: (centsAmount / 100).toFixed(2),
      settlementDisplayFee: (centsFee / 100).toFixed(2),
      settlementDisplayPrice,
    }

    return [
      {
        ...currencyBaseWalletTxns,
        initiationVia: {
          type: PaymentInitiationMethod.Lightning,
          paymentHash: "paymentHash" as PaymentHash,
          pubkey: "pubkey" as Pubkey,
        },
        settlementVia: {
          type: SettlementMethod.Lightning,
          revealedPreImage: undefined,
        },
        memo: "SomeMemo",
      },

      {
        ...currencyBaseWalletTxns,
        initiationVia: {
          type: PaymentInitiationMethod.Lightning,
          paymentHash: "paymentHash" as PaymentHash,
          pubkey: "pubkey" as Pubkey,
        },
        settlementVia: {
          type: SettlementMethod.IntraLedger,
          counterPartyWalletId: "walletIdRecipient" as WalletId,
          counterPartyUsername: "username" as Username,
        },
        memo: null,
      },
      {
        ...currencyBaseWalletTxns,
        initiationVia: {
          type: PaymentInitiationMethod.OnChain,
          address: "address" as OnChainAddress,
        },
        settlementVia: {
          type: SettlementMethod.IntraLedger,
          counterPartyWalletId: "walletIdRecipient" as WalletId,
          counterPartyUsername: null,
        },
        memo: null,
      },
      {
        ...currencyBaseWalletTxns,
        initiationVia: {
          type: PaymentInitiationMethod.OnChain,
          address: "address" as OnChainAddress,
        },
        settlementVia: {
          type: SettlementMethod.OnChain,
          transactionHash: "txHash" as OnChainTxHash,
        },
        memo: null,
      },
    ]
  }

  describe("WalletTransactionHistory.fromLedger", () => {
    it("translates btc ledger txs", () => {
      const currency = WalletCurrency.Btc
      const settlementAmount = satsAmount

      const txnsArgs = {
        walletId: crypto.randomUUID() as WalletId,
        settlementAmount,
        satsAmount,
        centsAmount,
        centsFee,
        displayAmount: centsAmount,
        displayFee: centsFee,
        currency,
      }

      const ledgerTransactions = ledgerTxnsInputs(txnsArgs)
      const expected = expectedWalletTxns(txnsArgs)

      for (let i = 0; i < ledgerTransactions.length; i++) {
        const result = WalletTransactionHistory.fromLedger({
          txn: ledgerTransactions[i],
          nonEndUserWalletIds: [],
          memoSharingConfig,
        })

        expect(result).toEqual(expected[i])
      }
    })

    it("translates usd ledger txs", () => {
      const currency = WalletCurrency.Usd
      const settlementAmount = centsAmount

      const txnsArgs = {
        walletId: crypto.randomUUID() as WalletId,
        settlementAmount,
        satsAmount,
        centsAmount,
        centsFee,
        displayAmount: centsAmount,
        displayFee: centsFee,
        currency,
      }

      const ledgerTransactions = ledgerTxnsInputs(txnsArgs)
      const expected = expectedWalletTxns(txnsArgs)

      for (let i = 0; i < ledgerTransactions.length; i++) {
        const result = WalletTransactionHistory.fromLedger({
          txn: ledgerTransactions[i],
          nonEndUserWalletIds: [],
          memoSharingConfig,
        })

        expect(result).toEqual(expected[i])
      }
    })

    it("handles missing satsAmount-related properties", () => {
      const currency = WalletCurrency.Btc
      const settlementAmount = satsAmount

      const txnsArgs = {
        walletId: crypto.randomUUID() as WalletId,
        settlementAmount,
        satsAmount,
        centsAmount,
        centsFee,
        displayAmount: centsAmount,
        displayFee: centsFee,
        currency,
      }

      const ledgerTransactions = ledgerTxnsInputs(txnsArgs)

      // Remove satsAmount-related properties
      const ledgerTransactionsModified = ledgerTransactions.map((tx) => {
        const {
          satsAmount,
          satsFee,
          centsAmount,
          centsFee,
          displayAmount,
          displayFee,
          displayCurrency,
          ...rest
        } = tx

        const removed = [
          satsAmount,
          satsFee,
          centsAmount,
          centsFee,
          displayAmount,
          displayFee,
          displayCurrency,
        ]
        removed // dummy call to satisfy type-checker

        return rest
      })

      const expected = expectedWalletTxns(txnsArgs)

      // Modify satsAmount-related-dependent properties
      const expectedTransactionsModified = expected.map((tx) => {
        const {
          settlementFee,
          settlementDisplayAmount,
          settlementDisplayFee,
          settlementDisplayPrice,
          ...rest
        } = tx

        const removed = [
          settlementFee,
          settlementDisplayAmount,
          settlementDisplayFee,
          settlementDisplayPrice,
        ]
        removed // dummy call to satisfy type-checker

        return {
          settlementFee: 0,
          settlementDisplayAmount: "0.00",
          settlementDisplayFee: "0.00",
          settlementDisplayPrice: priceAmountFromNumber({
            priceInMinorUnit: 0,
            displayCurrency: UsdDisplayCurrency,
            walletCurrency: tx.settlementCurrency,
          }),
          ...rest,
        }
      })

      for (let i = 0; i < ledgerTransactionsModified.length; i++) {
        const result = WalletTransactionHistory.fromLedger({
          txn: ledgerTransactionsModified[i],
          nonEndUserWalletIds: [],
          memoSharingConfig,
        })

        expect(result).toEqual(expectedTransactionsModified[i])
      }
    })
  })
})

describe("translateDescription", () => {
  const journalIdMemoArgs = {
    walletId: "" as WalletId,
    journalId: "" as LedgerJournalId,
    nonEndUserWalletIds: ["dealerBtcWalletId" as WalletId],
  }

  it("return journalId for dealer wallet id", () => {
    const journalId = "journal-01" as LedgerJournalId

    const result = translateMemo({
      memoFromPayer: "some memo",
      credit: MEMO_SHARING_SATS_THRESHOLD,
      currency: WalletCurrency.Btc,
      walletId: journalIdMemoArgs.nonEndUserWalletIds[0],
      journalId,
      nonEndUserWalletIds: journalIdMemoArgs.nonEndUserWalletIds,
      memoSharingConfig,
    })
    expect(result).toEqual(`JournalId:${journalId}`)
  })

  it("returns the memoFromPayer for BTC wallet", () => {
    const result = translateMemo({
      memoFromPayer: "some memo",
      credit: MEMO_SHARING_SATS_THRESHOLD,
      currency: WalletCurrency.Btc,
      memoSharingConfig,
      ...journalIdMemoArgs,
    })
    expect(result).toEqual("some memo")
  })

  it("returns memo if there is no memoFromPayer for BTC wallet", () => {
    const result = translateMemo({
      lnMemo: "some memo",
      credit: MEMO_SHARING_SATS_THRESHOLD,
      currency: WalletCurrency.Btc,
      memoSharingConfig,
      ...journalIdMemoArgs,
    })
    expect(result).toEqual("some memo")
  })

  it("returns null under spam thresh for BTC wallet", () => {
    const result = translateMemo({
      memoFromPayer: "some memo",
      credit: 1 as Satoshis,
      currency: WalletCurrency.Btc,
      memoSharingConfig,
      ...journalIdMemoArgs,
    })
    expect(result).toBeNull()
  })

  it("returns memo for debit under spam threshold for BTC wallet", () => {
    const result = translateMemo({
      memoFromPayer: "some memo",
      credit: 0 as Satoshis,
      currency: WalletCurrency.Btc,
      memoSharingConfig,
      ...journalIdMemoArgs,
    })
    expect(result).toEqual("some memo")
  })

  it("returns the memoFromPayer for USD wallet", () => {
    const result = translateMemo({
      memoFromPayer: "some memo",
      credit: MEMO_SHARING_CENTS_THRESHOLD,
      currency: WalletCurrency.Usd,
      memoSharingConfig,
      ...journalIdMemoArgs,
    })
    expect(result).toEqual("some memo")
  })

  it("returns memo if there is no memoFromPayer for USD wallet", () => {
    const result = translateMemo({
      lnMemo: "some memo",
      credit: MEMO_SHARING_CENTS_THRESHOLD,
      currency: WalletCurrency.Usd,
      memoSharingConfig,
      ...journalIdMemoArgs,
    })
    expect(result).toEqual("some memo")
  })

  it("returns null under spam thresh for USD wallet", () => {
    const result = translateMemo({
      memoFromPayer: "some memo",
      credit: 1 as UsdCents,
      currency: WalletCurrency.Usd,
      memoSharingConfig,
      ...journalIdMemoArgs,
    })
    expect(result).toBeNull()
  })

  it("returns memo for debit under spam threshold for USD wallet", () => {
    const result = translateMemo({
      memoFromPayer: "some memo",
      credit: 0 as UsdCents,
      currency: WalletCurrency.Usd,
      memoSharingConfig,
      ...journalIdMemoArgs,
    })
    expect(result).toEqual("some memo")
  })
})

describe("WalletTransactionHistory.fromLedger", () => {
  describe("status", () => {
    it("sets status to failed for failed transaction", () => {
      const txn = {
        type: LedgerTransactionType.Payment,
        pendingConfirmation: false,
        debit: 100,
        credit: 0,
        lnPaymentState: LnPaymentState.Failed,
      } as LedgerTransaction<"BTC">

      const result = WalletTransactionHistory.fromLedger({
        txn,
        nonEndUserWalletIds: [],
        memoSharingConfig,
      })
      expect(result.status).toEqual(TxStatus.Failure)
    })
  })
})
