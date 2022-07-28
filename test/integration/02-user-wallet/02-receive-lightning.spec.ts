import { MEMO_SHARING_SATS_THRESHOLD } from "@config"

import { Lightning } from "@app"
import * as Wallets from "@app/wallets"
import { handleHeldInvoices } from "@app/wallets"

import { toSats } from "@domain/bitcoin"
import { InvoiceNotFoundError } from "@domain/bitcoin/lightning"
import { defaultTimeToExpiryInSeconds } from "@domain/bitcoin/lightning/invoice-expiration"
import { toCents } from "@domain/fiat"
import { PaymentInitiationMethod, WithdrawalFeePriceMethod } from "@domain/wallets"
import { WalletCurrency } from "@domain/shared"
import { CouldNotFindWalletInvoiceError } from "@domain/errors"

import { WalletInvoicesRepository } from "@services/mongoose"
import { getDealerUsdWalletId } from "@services/ledger/caching"
import { DealerPriceService } from "@services/dealer-price"
import { LedgerService } from "@services/ledger"
import { TransactionsMetadataRepository } from "@services/ledger/services"
import { KnownLndErrorDetails, LndService } from "@services/lnd"
import { parseLndErrorDetails } from "@services/lnd/utils"
import { baseLogger } from "@services/logger"
import { setupInvoiceSubscribe } from "@servers/trigger"

import { ImbalanceCalculator } from "@domain/ledger/imbalance-calculator"

import { sleep } from "@utils"

import {
  checkIsBalanced,
  createUserAndWalletFromUserRef,
  getAmount,
  getBalanceHelper,
  getDefaultWalletIdByTestUserRef,
  getHash,
  getPubKey,
  getUsdWalletIdByTestUserRef,
  lnd1,
  lndOutside1,
  pay,
  subscribeToInvoices,
} from "test/helpers"

let walletIdB: WalletId
let walletIdUsdB: WalletId
let walletIdF: WalletId
let walletIdUsdF: WalletId
let initBalanceB: Satoshis
let initBalanceUsdB: UsdCents

jest.mock("@services/dealer-price", () => require("test/mocks/dealer-price"))

jest.mock("@app/prices/get-current-price", () => require("test/mocks/get-current-price"))

beforeAll(async () => {
  await createUserAndWalletFromUserRef("B")
  await createUserAndWalletFromUserRef("F")
  walletIdB = await getDefaultWalletIdByTestUserRef("B")
  walletIdUsdB = await getUsdWalletIdByTestUserRef("B")
  walletIdF = await getDefaultWalletIdByTestUserRef("F")
  walletIdUsdF = await getUsdWalletIdByTestUserRef("F")
})

beforeEach(async () => {
  initBalanceB = toSats(await getBalanceHelper(walletIdB))
  initBalanceUsdB = toCents(await getBalanceHelper(walletIdUsdB))
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

    const updateInvoice = () =>
      Wallets.updatePendingInvoiceByPaymentHash({
        paymentHash: hash as PaymentHash,
        logger: baseLogger,
      })

    const promises = Promise.all([
      pay({ lnd: lndOutside1, request: invoice }),
      (async () => {
        // TODO: we could use event instead of a sleep to lower test latency
        await sleep(500)
        return updateInvoice()
      })(),
    ])

    {
      // first arg is the outsideLndpayResult
      const [, result] = await promises
      expect(result).not.toBeInstanceOf(Error)
    }

    // should be idempotent (not return error when called again)
    {
      const result = await updateInvoice()
      expect(result).not.toBeInstanceOf(Error)
    }

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

    // FIXME: Needs to be in the first test so that previous volume for wallet is 0.
    const imbalance = await imbalanceCalc.getSwapOutImbalance(walletIdB)
    if (imbalance instanceof Error) throw imbalance

    expect(imbalance).toBe(sats)
  })

  it("if trigger is missing the USD invoice, then it should be denied", async () => {
    /*
      the reason we are doing this behavior is to limit the discrepancy between our books,
      and the state of lnd.
      if we get invoices that lnd has been settled because we were not using holdinvoice,
      then there would be discrepancy between the time lnd settled the invoice
      and the time it's being settle in our ledger
      the reason this could happen is because trigger has to restart
      the discrepancy in ledger is an okish behavior for bitcoin invoice, because there
      are no price risk, but it's an unbearable risk for non bitcoin wallets,
      because of the associated price risk exposure
    */

    const cents = 1000
    const memo = "myUsdMemo"

    const lnInvoice = await Wallets.addInvoiceForSelf({
      walletId: walletIdUsdB as WalletId,
      amount: toCents(cents),
      memo,
    })
    if (lnInvoice instanceof Error) throw lnInvoice
    const { paymentRequest: invoice } = lnInvoice

    const checker = await Lightning.PaymentStatusChecker(invoice)
    if (checker instanceof Error) throw checker

    const isPaidBeforePay = await checker.invoiceIsPaid()
    expect(isPaidBeforePay).not.toBeInstanceOf(Error)
    expect(isPaidBeforePay).toBe(false)

    const paymentHash = getHash(invoice)
    const pubkey = getPubKey(invoice)

    await Promise.all([
      (async () => {
        try {
          await pay({ lnd: lndOutside1, request: invoice })
        } catch (err) {
          expect(err[1]).toBe("PaymentRejectedByDestination")
        }
      })(),
      (async () => {
        await sleep(500)

        // make sure invoice is held

        const lndService = LndService()
        if (lndService instanceof Error) throw lndService

        {
          const lnInvoiceLookup = await lndService.lookupInvoice({ pubkey, paymentHash })
          if (lnInvoiceLookup instanceof Error) throw lnInvoiceLookup

          expect(lnInvoiceLookup.isHeld).toBe(true)
        }

        // handling invoice
        await handleHeldInvoices(baseLogger)

        const ledger = LedgerService()
        const ledgerTxs = await ledger.getTransactionsByHash(paymentHash)
        if (ledgerTxs instanceof Error) throw ledgerTxs
        expect(ledgerTxs).toStrictEqual([])

        const isPaidAfterPay = await checker.invoiceIsPaid()
        expect(isPaidAfterPay).not.toBeInstanceOf(Error)
        expect(isPaidAfterPay).toBe(false)

        const finalBalance = await getBalanceHelper(walletIdUsdB)
        expect(finalBalance).toBe(initBalanceUsdB)

        const lnInvoiceLookup = await lndService.lookupInvoice({ pubkey, paymentHash })
        expect(lnInvoiceLookup).toBeInstanceOf(InvoiceNotFoundError)

        {
          const walletInvoiceRepo = WalletInvoicesRepository()
          const result = await walletInvoiceRepo.findByPaymentHash(paymentHash)
          expect(result).toBeInstanceOf(CouldNotFindWalletInvoiceError)
        }

        // making sure relooping is a no-op and doesn't throw
        await handleHeldInvoices(baseLogger)
      })(),
    ])
  })

  it("if trigger is missing the BTC invoice, then it should be processed", async () => {
    const sats = 25000
    const memo = "myBtcMemo"

    const lnInvoice = await Wallets.addInvoiceForSelf({
      walletId: walletIdB as WalletId,
      amount: toSats(sats),
      memo,
    })
    if (lnInvoice instanceof Error) throw lnInvoice
    const { paymentRequest: invoice } = lnInvoice

    const checker = await Lightning.PaymentStatusChecker(invoice)
    if (checker instanceof Error) throw checker

    const isPaidBeforePay = await checker.invoiceIsPaid()
    expect(isPaidBeforePay).not.toBeInstanceOf(Error)
    expect(isPaidBeforePay).toBe(false)

    const paymentHash = getHash(invoice)
    const pubkey = getPubKey(invoice)

    await Promise.all([
      (async () => {
        try {
          await pay({ lnd: lndOutside1, request: invoice })
        } catch (err) {
          expect(err[1]).toBe("PaymentRejectedByDestination")
        }
      })(),
      (async () => {
        await sleep(500)

        // make sure invoice is held

        const lndService = LndService()
        if (lndService instanceof Error) throw lndService

        {
          const lnInvoiceLookup = await lndService.lookupInvoice({ pubkey, paymentHash })
          if (lnInvoiceLookup instanceof Error) throw lnInvoiceLookup

          expect(lnInvoiceLookup.isHeld).toBe(true)
        }

        // handling invoice
        await handleHeldInvoices(baseLogger)

        const ledger = LedgerService()
        const ledgerTxs = await ledger.getTransactionsByHash(paymentHash)
        if (ledgerTxs instanceof Error) throw ledgerTxs
        expect(ledgerTxs).toHaveLength(1)

        const isPaidAfterPay = await checker.invoiceIsPaid()
        expect(isPaidAfterPay).not.toBeInstanceOf(Error)
        expect(isPaidAfterPay).toBe(true)

        const finalBalance = await getBalanceHelper(walletIdB)
        expect(finalBalance).toBe(initBalanceB + sats)

        const lnInvoiceLookup = await lndService.lookupInvoice({ pubkey, paymentHash })
        expect(lnInvoiceLookup).not.toBeInstanceOf(Error)
        if (lnInvoiceLookup instanceof Error) throw lnInvoiceLookup
        expect(lnInvoiceLookup.isSettled).toBeTruthy()

        {
          const walletInvoiceRepo = WalletInvoicesRepository()
          const result = await walletInvoiceRepo.findByPaymentHash(paymentHash)
          expect(result).not.toBeInstanceOf(Error)
          if (result instanceof Error) throw result
          expect(result.paid).toBeTruthy()
        }

        // making sure relooping is a no-op and doesn't throw
        await handleHeldInvoices(baseLogger)
      })(),
    ])
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

    pay({ lnd: lndOutside1, request: invoice })

    // TODO: we could use an event instead of a sleep
    await sleep(500)

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

    pay({ lnd: lndOutside1, request: invoice, tokens: sats })

    // TODO: we could use an event instead of a sleep
    await sleep(500)

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

    pay({ lnd: lndOutside1, request: invoice, tokens: sats })

    // TODO: we could use an event instead of a sleep
    await sleep(500)

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
    pay({ lnd: lndOutside1, request: invoice })

    // TODO: we could use an event instead of a sleep
    await sleep(500)

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

describe("Invoice handling from trigger", () => {
  describe("btc recipient invoice", () => {
    const sats = toSats(500)

    it("should process hodl invoice on invoice payment", async () => {
      // Kick off listener
      const subInvoices = subscribeToInvoices({ lnd: lnd1 })
      setupInvoiceSubscribe({
        lnd: lnd1,
        pubkey: process.env.LND1_PUBKEY as Pubkey,
        subInvoices,
      })

      // Create invoice for self
      const lnInvoice = await Wallets.addInvoiceForSelf({
        walletId: walletIdF,
        amount: sats,
      })
      expect(lnInvoice).not.toBeInstanceOf(Error)
      if (lnInvoice instanceof Error) throw lnInvoice

      // Pay invoice
      const result = await pay({
        lnd: lndOutside1,
        request: lnInvoice.paymentRequest,
      })

      // See successful payment
      expect(result.is_confirmed).toBeTruthy()
      subInvoices.removeAllListeners()
    })

    it("should process held invoice when trigger comes back up", async () => {
      // Create invoice for self
      const lnInvoice = await Wallets.addInvoiceForSelf({
        walletId: walletIdF,
        amount: sats,
      })
      expect(lnInvoice).not.toBeInstanceOf(Error)
      if (lnInvoice instanceof Error) throw lnInvoice

      // Pay invoice promise
      const startPay = async () => {
        try {
          return await pay({
            lnd: lndOutside1,
            request: lnInvoice.paymentRequest,
          })
        } catch (err) {
          return parseLndErrorDetails(err)
        }
      }

      // Listener promise
      const delayedListener = async (subInvoices) => {
        await sleep(500)
        setupInvoiceSubscribe({
          lnd: lnd1,
          pubkey: process.env.LND1_PUBKEY as Pubkey,
          subInvoices,
        })
      }

      // Pay and then listen
      const subInvoices = subscribeToInvoices({ lnd: lnd1 })
      const [result] = await Promise.all([startPay(), delayedListener(subInvoices)])

      // See successful payment
      expect(result.is_confirmed).toBeTruthy()
      subInvoices.removeAllListeners()
    })

    it("should process new invoice payment when trigger comes back up", async () => {
      // Create invoice for self
      const lnInvoice = await Wallets.addInvoiceForSelf({
        walletId: walletIdF,
        amount: sats,
      })
      expect(lnInvoice).not.toBeInstanceOf(Error)
      if (lnInvoice instanceof Error) throw lnInvoice

      // Kick off listener
      const subInvoices = subscribeToInvoices({ lnd: lnd1 })
      setupInvoiceSubscribe({
        lnd: lnd1,
        pubkey: process.env.LND1_PUBKEY as Pubkey,
        subInvoices,
      })

      // Pay invoice
      const result = await pay({
        lnd: lndOutside1,
        request: lnInvoice.paymentRequest,
      })

      // See successful payment
      expect(result.is_confirmed).toBeTruthy()
      subInvoices.removeAllListeners()
    })
  })

  describe("usd recipient invoice", () => {
    const cents = toCents(100)

    it("should process hodl invoice on invoice payment", async () => {
      // Kick off listener
      const subInvoices = subscribeToInvoices({ lnd: lnd1 })
      setupInvoiceSubscribe({
        lnd: lnd1,
        pubkey: process.env.LND1_PUBKEY as Pubkey,
        subInvoices,
      })

      // Create invoice for self
      const lnInvoice = await Wallets.addInvoiceForSelf({
        walletId: walletIdUsdF,
        amount: cents,
      })
      expect(lnInvoice).not.toBeInstanceOf(Error)
      if (lnInvoice instanceof Error) throw lnInvoice

      // Pay invoice
      const result = await pay({
        lnd: lndOutside1,
        request: lnInvoice.paymentRequest,
      })

      // See successful payment
      expect(result.is_confirmed).toBeTruthy()
      subInvoices.removeAllListeners()
    })

    it("should decline held invoice when trigger comes back up", async () => {
      // Create invoice for self
      const lnInvoice = await Wallets.addInvoiceForSelf({
        walletId: walletIdUsdF,
        amount: cents,
      })
      expect(lnInvoice).not.toBeInstanceOf(Error)
      if (lnInvoice instanceof Error) throw lnInvoice

      // Pay invoice promise
      const startPay = async () => {
        try {
          return await pay({
            lnd: lndOutside1,
            request: lnInvoice.paymentRequest,
          })
        } catch (err) {
          return parseLndErrorDetails(err)
        }
      }

      // Listener promise
      const delayedListener = async (subInvoices) => {
        await sleep(500)
        setupInvoiceSubscribe({
          lnd: lnd1,
          pubkey: process.env.LND1_PUBKEY as Pubkey,
          subInvoices,
        })
      }

      // Pay and then listen
      const subInvoices = subscribeToInvoices({ lnd: lnd1 })
      const [result] = await Promise.all([startPay(), delayedListener(subInvoices)])

      // See successful payment
      expect(result).toEqual(KnownLndErrorDetails.PaymentRejectedByDestination)
      subInvoices.removeAllListeners()
    })

    it("should process new invoice payment when trigger comes back up", async () => {
      // Create invoice for self
      const lnInvoice = await Wallets.addInvoiceForSelf({
        walletId: walletIdUsdF,
        amount: cents,
      })
      expect(lnInvoice).not.toBeInstanceOf(Error)
      if (lnInvoice instanceof Error) throw lnInvoice

      // Kick off listener
      const subInvoices = subscribeToInvoices({ lnd: lnd1 })
      setupInvoiceSubscribe({
        lnd: lnd1,
        pubkey: process.env.LND1_PUBKEY as Pubkey,
        subInvoices,
      })

      // Pay invoice
      const result = await pay({
        lnd: lndOutside1,
        request: lnInvoice.paymentRequest,
      })

      // See successful payment
      expect(result.is_confirmed).toBeTruthy()
      subInvoices.removeAllListeners()
    })
  })
})
