import { Lightning } from "@app"
import { getDealerUsdWalletId } from "@services/ledger/caching"
import * as Wallets from "@app/wallets"
import { MEMO_SHARING_SATS_THRESHOLD } from "@config"
import { toSats } from "@domain/bitcoin"
import { defaultTimeToExpiryInSeconds } from "@domain/bitcoin/lightning/invoice-expiration"
import { toCents } from "@domain/fiat"
import { PaymentInitiationMethod, WithdrawalFeePriceMethod } from "@domain/wallets"
import { WalletCurrency } from "@domain/shared"
import { DealerPriceService } from "@services/dealer-price"
import { LedgerService } from "@services/ledger"
import { TransactionsMetadataRepository } from "@services/ledger/services"
import { baseLogger } from "@services/logger"

import { ImbalanceCalculator } from "@domain/ledger/imbalance-calculator"

import {
  checkIsBalanced,
  createUserAndWalletFromUserRef,
  getAmount,
  getBalanceHelper,
  getDefaultWalletIdByTestUserRef,
  getHash,
  getUsdWalletIdByTestUserRef,
  lndOutside1,
  pay,
} from "test/helpers"

let walletIdB: WalletId
let walletDescriptorB: WalletDescriptor<WalletCurrency>
let walletIdUsdB: WalletId
let initBalanceB: Satoshis

jest.mock("@services/dealer-price", () => require("test/mocks/dealer-price"))

jest.mock("@app/prices/get-current-price", () => require("test/mocks/get-current-price"))

beforeAll(async () => {
  await createUserAndWalletFromUserRef("B")
  walletIdB = await getDefaultWalletIdByTestUserRef("B")
  walletDescriptorB = { id: walletIdB, currency: WalletCurrency.Btc }
  walletIdUsdB = await getUsdWalletIdByTestUserRef("B")
})

beforeEach(async () => {
  initBalanceB = toSats(await getBalanceHelper(walletIdB))
})

afterEach(async () => {
  await checkIsBalanced()
})

describe("UserWallet - Lightning", () => {
  it("receives payment from outside", async () => {
    // larger amount to not fall below the escrow limit
    const sats = 50000
    const memo = "myMemo"

    const lnInvoice = await Wallets.addInvoiceForSelf({
      walletId: walletIdB as WalletId,
      amount: toSats(sats),
      memo,
    })
    if (lnInvoice instanceof Error) throw lnInvoice
    const { paymentRequest: invoice } = lnInvoice

    const checker = await Lightning.PaymentStatusChecker(invoice)
    expect(checker).not.toBeInstanceOf(Error)
    if (checker instanceof Error) throw checker

    const isPaidBeforePay = await checker.invoiceIsPaid()
    expect(isPaidBeforePay).not.toBeInstanceOf(Error)
    expect(isPaidBeforePay).toBe(false)

    const hash = getHash(invoice)

    await pay({ lnd: lndOutside1, request: invoice })

    expect(
      await Wallets.updatePendingInvoiceByPaymentHash({
        paymentHash: hash as PaymentHash,
        logger: baseLogger,
      }),
    ).not.toBeInstanceOf(Error)
    // should be idempotent (not return error when called again)
    expect(
      await Wallets.updatePendingInvoiceByPaymentHash({
        paymentHash: hash as PaymentHash,
        logger: baseLogger,
      }),
    ).not.toBeInstanceOf(Error)

    const ledger = LedgerService()
    const ledgerMetadata = TransactionsMetadataRepository()
    const ledgerTxs = await ledger.getTransactionsByHash(hash)
    if (ledgerTxs instanceof Error) throw ledgerTxs

    const ledgerTx = ledgerTxs[0]
    const ledgerTxMetadata = await ledgerMetadata.findById(ledgerTx.id)
    if (ledgerTxMetadata instanceof Error) throw ledgerTxMetadata

    expect(ledgerTx.credit).toBe(sats)
    expect(ledgerTx.lnMemo).toBe(memo)
    expect(ledgerTx.pendingConfirmation).toBe(false)

    expect(ledgerTxMetadata).toHaveProperty("hash")
    if (!("hash" in ledgerTxMetadata)) return
    expect(ledgerTxMetadata.hash).toBe(ledgerTx.paymentHash)

    if ("revealedPreImage" in ledgerTxMetadata)
      expect(ledgerTxMetadata.revealedPreImage).toBeUndefined()

    const isPaidAfterPay = await checker.invoiceIsPaid()
    expect(isPaidAfterPay).not.toBeInstanceOf(Error)
    expect(isPaidAfterPay).toBe(true)

    // check that memo is not filtered by spam filter
    const { result: txns, error } = await Wallets.getTransactionsForWalletId({
      walletId: walletIdB,
    })
    if (error instanceof Error || txns === null) {
      throw error
    }
    const noSpamTxn = txns.find(
      (txn) =>
        txn.initiationVia.type === PaymentInitiationMethod.Lightning &&
        txn.initiationVia.paymentHash === hash,
    ) as WalletTransaction
    expect(noSpamTxn.memo).toBe(memo)

    const finalBalance = await getBalanceHelper(walletIdB)
    expect(finalBalance).toBe(initBalanceB + sats)

    const imbalanceCalc = ImbalanceCalculator({
      method: WithdrawalFeePriceMethod.proportionalOnImbalance,
      sinceDaysAgo: 1 as Days,
      volumeLightningFn: ledger.lightningTxBaseVolumeSince,
      volumeOnChainFn: ledger.onChainTxBaseVolumeSince,
    })

    const imbalance = await imbalanceCalc.getSwapOutImbalance(walletDescriptorB)
    if (imbalance instanceof Error) throw imbalance

    expect(imbalance).toBe(sats)
  })

  it("receives payment from outside to USD wallet with amount", async () => {
    const initBalanceUsdB = toCents(await getBalanceHelper(walletIdUsdB))

    const cents = toCents(250)
    const memo = "myMemo"

    const lnInvoice = await Wallets.addInvoiceForSelf({
      walletId: walletIdUsdB as WalletId,
      amount: cents,
      memo,
    })
    if (lnInvoice instanceof Error) throw lnInvoice
    const { paymentRequest: invoice } = lnInvoice

    const hash = getHash(invoice)
    const amount = getAmount(invoice)

    const dealerFns = DealerPriceService()
    const sats = await dealerFns.getSatsFromCentsForFutureBuy(
      cents,
      defaultTimeToExpiryInSeconds,
    )
    if (sats instanceof Error) throw sats

    expect(amount).toBe(sats)

    await pay({ lnd: lndOutside1, request: invoice })

    expect(
      await Wallets.updatePendingInvoiceByPaymentHash({
        paymentHash: hash as PaymentHash,
        logger: baseLogger,
      }),
    ).not.toBeInstanceOf(Error)
    // should be idempotent (not return error when called again)
    expect(
      await Wallets.updatePendingInvoiceByPaymentHash({
        paymentHash: hash as PaymentHash,
        logger: baseLogger,
      }),
    ).not.toBeInstanceOf(Error)

    const ledger = LedgerService()
    const ledgerTxs = await ledger.getTransactionsByHash(hash)
    if (ledgerTxs instanceof Error) throw ledgerTxs

    const ledgerTx = ledgerTxs.find((tx) => tx.walletId === walletIdUsdB)
    if (ledgerTx === undefined) throw Error("ledgerTx needs to be defined")

    expect(ledgerTx.credit).toBe(cents)
    expect(ledgerTx.usd).toBe(cents / 100)
    expect(ledgerTx.currency).toBe(WalletCurrency.Usd)
    expect(ledgerTx.lnMemo).toBe(memo)
    expect(ledgerTx.pendingConfirmation).toBe(false)
    const dealerUsdWalletId = await getDealerUsdWalletId()
    const dealerBalance = await getBalanceHelper(dealerUsdWalletId)
    expect(dealerBalance).toBe(cents * -1)

    // check that memo is not filtered by spam filter
    const { result: txns } = await Wallets.getTransactionsForWalletId({
      walletId: walletIdUsdB,
    })
    expect(txns?.length).toBe(1)

    // FIXME(nicolas) need to have spam memo working USD wallet
    // if (error instanceof Error || txns === null) throw error
    // const noSpamTxn = txns.find(
    //   (txn) =>
    //     txn.initiationVia.type === PaymentInitiationMethod.Lightning &&
    //     txn.initiationVia.paymentHash === hash,
    // ) as WalletTransaction
    // expect(noSpamTxn.memo).toBe(memo)

    const finalBalance = await getBalanceHelper(walletIdUsdB)
    expect(finalBalance).toBe(initBalanceUsdB + cents)
  })

  it("receives payment from outside USD wallet with amountless invoices", async () => {
    const initBalanceUsdB = toCents(await getBalanceHelper(walletIdUsdB))

    const sats = toSats(120)
    const memo = "myMemo"

    const lnInvoice = await Wallets.addInvoiceNoAmountForSelf({
      walletId: walletIdUsdB as WalletId,
      memo,
    })
    if (lnInvoice instanceof Error) throw lnInvoice
    const { paymentRequest: invoice } = lnInvoice

    const hash = getHash(invoice)

    await pay({ lnd: lndOutside1, request: invoice, tokens: sats })

    expect(
      await Wallets.updatePendingInvoiceByPaymentHash({
        paymentHash: hash as PaymentHash,
        logger: baseLogger,
      }),
    ).not.toBeInstanceOf(Error)
    // should be idempotent (not return error when called again)
    expect(
      await Wallets.updatePendingInvoiceByPaymentHash({
        paymentHash: hash as PaymentHash,
        logger: baseLogger,
      }),
    ).not.toBeInstanceOf(Error)

    const ledger = LedgerService()
    const ledgerTxs = await ledger.getTransactionsByHash(hash)
    if (ledgerTxs instanceof Error) throw ledgerTxs

    const ledgerTx = ledgerTxs.find((tx) => tx.walletId === walletIdUsdB)
    if (ledgerTx === undefined) throw Error("ledgerTx needs to be defined")

    const dealerFns = DealerPriceService()
    const cents = await dealerFns.getCentsFromSatsForImmediateBuy(sats)
    if (cents instanceof Error) throw cents

    expect(ledgerTx.credit).toBe(cents)
    expect(ledgerTx.usd).toBe(cents / 100)
    expect(ledgerTx.currency).toBe(WalletCurrency.Usd)
    expect(ledgerTx.lnMemo).toBe(memo)
    expect(ledgerTx.pendingConfirmation).toBe(false)

    // check that memo is not filtered by spam filter
    const { result: txns } = await Wallets.getTransactionsForWalletId({
      walletId: walletIdUsdB,
    })
    expect(txns?.length).toBe(2)

    // FIXME(nicolas) need to have spam memo working USD wallet
    // if (error instanceof Error || txns === null) throw error
    // const noSpamTxn = txns.find(
    //   (txn) =>
    //     txn.initiationVia.type === PaymentInitiationMethod.Lightning &&
    //     txn.initiationVia.paymentHash === hash,
    // ) as WalletTransaction
    // expect(noSpamTxn.memo).toBe(memo)

    const finalBalance = await getBalanceHelper(walletIdUsdB)
    expect(finalBalance).toBe(initBalanceUsdB + cents)
  })

  it("receives zero amount invoice", async () => {
    const sats = 1000

    const lnInvoice = await Wallets.addInvoiceNoAmountForSelf({
      walletId: walletIdB as WalletId,
    })
    if (lnInvoice instanceof Error) throw lnInvoice
    const { paymentRequest: invoice } = lnInvoice

    const hash = getHash(invoice)

    await pay({ lnd: lndOutside1, request: invoice, tokens: sats })

    expect(
      await Wallets.updatePendingInvoiceByPaymentHash({
        paymentHash: hash as PaymentHash,
        logger: baseLogger,
      }),
    ).not.toBeInstanceOf(Error)
    // should be idempotent (not return error when called again)
    expect(
      await Wallets.updatePendingInvoiceByPaymentHash({
        paymentHash: hash as PaymentHash,
        logger: baseLogger,
      }),
    ).not.toBeInstanceOf(Error)

    const ledger = LedgerService()
    const ledgerMetadata = TransactionsMetadataRepository()
    const ledgerTxs = await ledger.getTransactionsByHash(hash)
    if (ledgerTxs instanceof Error) throw ledgerTxs

    const ledgerTx = ledgerTxs[0]
    const ledgerTxMetadata = await ledgerMetadata.findById(ledgerTx.id)
    if (ledgerTxMetadata instanceof Error) throw ledgerTxMetadata

    expect(ledgerTx.credit).toBe(sats)
    expect(ledgerTx.lnMemo).toBe("")
    expect(ledgerTx.pendingConfirmation).toBe(false)

    expect(ledgerTxMetadata).toHaveProperty("hash")
    if (!("hash" in ledgerTxMetadata)) return
    expect(ledgerTxMetadata.hash).toBe(ledgerTx.paymentHash)

    if ("revealedPreImage" in ledgerTxMetadata)
      expect(ledgerTxMetadata.revealedPreImage).toBeUndefined()

    const finalBalance = await getBalanceHelper(walletIdB)
    expect(finalBalance).toBe(initBalanceB + sats)
  })

  it("receives spam invoice", async () => {
    // amount below MEMO_SPAM threshold
    const sats = 100
    const memo = "THIS MIGHT BE SPAM!!!"

    // confirm that transaction should be filtered
    expect(sats).toBeLessThan(MEMO_SHARING_SATS_THRESHOLD)

    // process spam transaction
    const lnInvoice = await Wallets.addInvoiceForSelf({
      walletId: walletIdB as WalletId,
      amount: toSats(sats),
      memo,
    })
    if (lnInvoice instanceof Error) throw lnInvoice
    const { paymentRequest: invoice } = lnInvoice

    const hash = getHash(invoice)
    await pay({ lnd: lndOutside1, request: invoice })
    expect(
      await Wallets.updatePendingInvoiceByPaymentHash({
        paymentHash: hash as PaymentHash,
        logger: baseLogger,
      }),
    ).not.toBeInstanceOf(Error)

    // check that spam memo is persisted to database
    const ledger = LedgerService()
    const ledgerTxs = await ledger.getTransactionsByHash(hash)
    if (ledgerTxs instanceof Error) throw ledgerTxs

    const ledgerTx = ledgerTxs[0]
    expect(ledgerTx.lnMemo).toBe(memo)

    // check that spam memo is filtered from transaction description
    const { result: txns, error } = await Wallets.getTransactionsForWalletId({
      walletId: walletIdB,
    })
    if (error instanceof Error || txns === null) throw error
    expect(ledgerTx.type).toBe("invoice")

    const spamTxn = txns.find(
      (txn) =>
        txn.initiationVia.type === PaymentInitiationMethod.Lightning &&
        txn.initiationVia.paymentHash === hash,
    ) as WalletTransaction
    expect(spamTxn.memo).toBeNull()

    // confirm expected final balance
    const finalBalance = await getBalanceHelper(walletIdB)
    expect(finalBalance).toBe(initBalanceB + sats)
  })
})
