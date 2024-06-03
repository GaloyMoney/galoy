import { randomUUID } from "crypto"

import { Accounts, Payments } from "@/app"

import { AccountStatus } from "@/domain/accounts"
import { toSats } from "@/domain/bitcoin"
import {
  MaxFeeTooLargeForRoutelessPaymentError,
  PaymentSendStatus,
  decodeInvoice,
  LnPaymentAttemptResultType,
} from "@/domain/bitcoin/lightning"
import { UsdDisplayCurrency, toCents } from "@/domain/fiat"
import { LnPaymentRequestNonZeroAmountRequiredError } from "@/domain/payments"
import { LedgerTransactionType } from "@/domain/ledger"
import {
  InactiveAccountError,
  InsufficientBalanceError,
  IntraledgerLimitsExceededError,
  SelfPaymentError,
  TradeIntraAccountLimitsExceededError,
  WithdrawalLimitsExceededError,
} from "@/domain/errors"
import { AmountCalculator, WalletCurrency } from "@/domain/shared"
import * as LnFeesImpl from "@/domain/payments"
import * as DisplayAmountsConverterImpl from "@/domain/fiat"

import {
  AccountsRepository,
  LnPaymentsRepository,
  WalletInvoicesRepository,
} from "@/services/mongoose"
import { LedgerService } from "@/services/ledger"
import { Transaction, TransactionMetadata } from "@/services/ledger/schema"
import { WalletInvoice } from "@/services/mongoose/schema"
import { LnPayment } from "@/services/lnd/schema"
import * as LndImpl from "@/services/lnd"
import * as LedgerFacadeImpl from "@/services/ledger/facade"

import {
  createMandatoryUsers,
  createRandomUserAndBtcWallet,
  createRandomUserAndWallets,
  getBalanceHelper,
  randomLedgerExternalId,
  recordReceiveLnPayment,
} from "test/helpers"

let lnInvoice: LnInvoice
let noAmountLnInvoice: LnInvoice
let largeWithAmountLnInvoice: LnInvoice
let memo: string

const calc = AmountCalculator()

const DEFAULT_PUBKEY =
  "03ca1907342d5d37744cb7038375e1867c24a87564c293157c95b2a9d38dcfb4c2" as Pubkey

beforeAll(async () => {
  await createMandatoryUsers()

  const randomRequest =
    "lnbcrt10n1p39jatkpp5djwv295kunhe5e0e4whj3dcjzwy7cmcxk8cl2a4dquyrp3dqydesdqqcqzpuxqr23ssp56u5m680x7resnvcelmsngc64ljm7g5q9r26zw0qyq5fenuqlcfzq9qyyssqxv4kvltas2qshhmqnjctnqkjpdfzu89e428ga6yk9jsp8rf382f3t03ex4e6x3a4sxkl7ruj6lsfpkuu9u9ee5kgr5zdyj7x2nwdljgq74025p"
  const invoice = decodeInvoice(randomRequest)
  if (invoice instanceof Error) throw invoice
  lnInvoice = invoice

  const randomNoAmountRequest =
    "lnbcrt1pjd9dmfpp5rf6q3rdstzcflshyux9dp05ft86xldx5s3ht99slsneneuefsjhsdqqcqzzsxqyz5vqsp5dl52mgulmljxlng5eafs7n3f54teg858dth67exxvk7wsgh62t6q9qyyssqjqekrkdga0uqnd0fv5dzhuky0l2wnmzr4q846x7grtw75zejla68pjh7vww2y6qvhx576yfexj8x24my72vj2y5929w5lju0f6fpnegp08kdm0"
  const noAmountInvoice = decodeInvoice(randomNoAmountRequest)
  if (noAmountInvoice instanceof Error) throw noAmountInvoice
  noAmountLnInvoice = noAmountInvoice

  const largeWithAmountRequest =
    "lnbcrt31pjdlc2mpp54seydar5l4pz20aq4ngmdp8ghx4s63476yrpy0a04l534g5u3ueqdqqcqzzsxqyz5vqsp5v45qm8fzn5r7hw7qcku0a92qrmfrsycqjwahue3vetyx9cljgeks9qyyssqzdpd0pq7m9qpy5v7r50yswmx57y7uh2q4czrz7cesxhz0rg52y8h6vp2e7jy9vsffxqjxtu82y58smj48f427up8kmlxql4m3r8pn8cq8yhwzl"
  const largeWithAmountInvoice = decodeInvoice(largeWithAmountRequest)
  if (largeWithAmountInvoice instanceof Error) throw largeWithAmountInvoice
  largeWithAmountLnInvoice = largeWithAmountInvoice
})

beforeEach(async () => {
  memo = randomLightningMemo()
  await LnPayment.deleteMany({})
})

afterEach(async () => {
  await Transaction.deleteMany({})
  await TransactionMetadata.deleteMany({})
  await WalletInvoice.deleteMany({})
  await LnPayment.deleteMany({})

  jest.restoreAllMocks()
})

const amount = toSats(10040)
const btcPaymentAmount: BtcPaymentAmount = {
  amount: BigInt(amount),
  currency: WalletCurrency.Btc,
}

const usdAmount = toCents(210)
const usdPaymentAmount: UsdPaymentAmount = {
  amount: BigInt(usdAmount),
  currency: WalletCurrency.Usd,
}

const receiveAmounts = { btc: calc.mul(btcPaymentAmount, 3n), usd: usdPaymentAmount }

const receiveBankFee = {
  btc: { amount: 100n, currency: WalletCurrency.Btc },
  usd: { amount: 1n, currency: WalletCurrency.Usd },
}

const receiveDisplayAmounts = {
  amountDisplayCurrency: Number(receiveAmounts.usd.amount) as DisplayCurrencyBaseAmount,
  feeDisplayCurrency: Number(receiveBankFee.usd.amount) as DisplayCurrencyBaseAmount,
  displayCurrency: UsdDisplayCurrency,
}

const receiveAboveLimitAmounts = {
  btc: { amount: 300_000_000n, currency: WalletCurrency.Btc },
  usd: { amount: 6_000_000n, currency: WalletCurrency.Usd },
}
const receiveAboveLimitDisplayAmounts = {
  amountDisplayCurrency: Number(
    receiveAboveLimitAmounts.usd.amount,
  ) as DisplayCurrencyBaseAmount,
  feeDisplayCurrency: Number(receiveBankFee.usd.amount) as DisplayCurrencyBaseAmount,
  displayCurrency: UsdDisplayCurrency,
}

const updatedByPrivilegedClientId = randomUUID() as PrivilegedClientId

const randomLightningMemo = () =>
  "this is my lightning memo #" + (Math.random() * 1_000_000).toFixed()

describe("initiated via lightning", () => {
  describe("fee probe", () => {
    it("fails if amount greater than limit", async () => {
      // Create users
      const newWalletDescriptor = await createRandomUserAndBtcWallet()
      const newAccount = await AccountsRepository().findById(
        newWalletDescriptor.accountId,
      )
      if (newAccount instanceof Error) throw newAccount

      // Fund balance for send
      for (let i = 0; i < 2; i++) {
        const receive = await recordReceiveLnPayment({
          walletDescriptor: newWalletDescriptor,
          paymentAmount: receiveAboveLimitAmounts,
          bankFee: receiveBankFee,
          displayAmounts: receiveAboveLimitDisplayAmounts,
          memo,
        })
        if (receive instanceof Error) throw receive
      }

      // Execute probe
      const { error } = await Payments.getNoAmountLightningFeeEstimationForBtcWallet({
        walletId: newWalletDescriptor.id,
        uncheckedPaymentRequest: noAmountLnInvoice.paymentRequest,

        amount: toSats(receiveAboveLimitAmounts.btc.amount),
      })
      expect(error).toBeInstanceOf(WithdrawalLimitsExceededError)
    })
  })

  describe("settles via lightning", () => {
    it("fails if sender account is locked", async () => {
      // Setup mocks
      const { LndService: LnServiceOrig } = jest.requireActual("@/services/lnd")
      const lndServiceSpy = jest.spyOn(LndImpl, "LndService").mockReturnValue({
        ...LnServiceOrig(),
        listAllPubkeys: () => [],
      })

      // Create users
      const newWalletDescriptor = await createRandomUserAndBtcWallet()
      const newAccount = await AccountsRepository().findById(
        newWalletDescriptor.accountId,
      )
      if (newAccount instanceof Error) throw newAccount

      // Fund balance for send
      const receive = await recordReceiveLnPayment({
        walletDescriptor: newWalletDescriptor,
        paymentAmount: receiveAmounts,
        bankFee: receiveBankFee,
        displayAmounts: receiveDisplayAmounts,
        memo,
      })
      if (receive instanceof Error) throw receive

      // Lock sender account
      const updatedAccount = await Accounts.updateAccountStatus({
        accountId: newAccount.id,
        status: AccountStatus.Locked,
        updatedByPrivilegedClientId,
      })
      if (updatedAccount instanceof Error) throw updatedAccount
      expect(updatedAccount.status).toEqual(AccountStatus.Locked)

      // Attempt send payment
      const res = await Payments.payInvoiceByWalletId({
        senderWalletId: newWalletDescriptor.id,
        senderAccount: newAccount,
        uncheckedPaymentRequest: lnInvoice.paymentRequest,

        memo,
      })
      expect(res).toBeInstanceOf(InactiveAccountError)

      // Restore system state
      lndServiceSpy.mockRestore()
    })

    it("fails when user has insufficient balance", async () => {
      // Setup mocks
      const { LndService: LnServiceOrig } = jest.requireActual("@/services/lnd")
      const lndServiceSpy = jest.spyOn(LndImpl, "LndService").mockReturnValue({
        ...LnServiceOrig(),
        listAllPubkeys: () => [],
      })

      // Create users
      const newWalletDescriptor = await createRandomUserAndBtcWallet()
      const newAccount = await AccountsRepository().findById(
        newWalletDescriptor.accountId,
      )
      if (newAccount instanceof Error) throw newAccount

      // Attempt pay
      const paymentResult = await Payments.payInvoiceByWalletId({
        uncheckedPaymentRequest: lnInvoice.paymentRequest,
        memo,
        senderWalletId: newWalletDescriptor.id,
        senderAccount: newAccount,
      })
      expect(paymentResult).toBeInstanceOf(InsufficientBalanceError)

      // Restore system state
      lndServiceSpy.mockRestore()
    })

    it("fails to pay zero amount invoice without separate amount", async () => {
      // Setup mocks
      const { LndService: LnServiceOrig } = jest.requireActual("@/services/lnd")
      const lndServiceSpy = jest.spyOn(LndImpl, "LndService").mockReturnValue({
        ...LnServiceOrig(),
        listAllPubkeys: () => [],
      })

      // Create users
      const newWalletDescriptor = await createRandomUserAndBtcWallet()
      const newAccount = await AccountsRepository().findById(
        newWalletDescriptor.accountId,
      )
      if (newAccount instanceof Error) throw newAccount

      // Attempt pay
      const paymentResult = await Payments.payInvoiceByWalletId({
        uncheckedPaymentRequest: noAmountLnInvoice.paymentRequest,
        memo,
        senderWalletId: newWalletDescriptor.id,
        senderAccount: newAccount,
      })
      expect(paymentResult).toBeInstanceOf(LnPaymentRequestNonZeroAmountRequiredError)

      // Restore system state
      lndServiceSpy.mockRestore()
    })

    it("fails if user sends balance amount without accounting for fee", async () => {
      // Setup mocks
      const { LndService: LnServiceOrig } = jest.requireActual("@/services/lnd")
      const lndServiceSpy = jest.spyOn(LndImpl, "LndService").mockReturnValue({
        ...LnServiceOrig(),
        listAllPubkeys: () => [],
      })

      // Create users
      const newWalletDescriptor = await createRandomUserAndBtcWallet()
      const newAccount = await AccountsRepository().findById(
        newWalletDescriptor.accountId,
      )
      if (newAccount instanceof Error) throw newAccount

      // Fund balance for send
      const receive = await recordReceiveLnPayment({
        walletDescriptor: newWalletDescriptor,
        paymentAmount: receiveAmounts,
        bankFee: receiveBankFee,
        displayAmounts: receiveDisplayAmounts,
        memo,
      })
      if (receive instanceof Error) throw receive

      // Attempt pay
      const balance = await getBalanceHelper(newWalletDescriptor.id)
      const paymentResult = await Payments.payNoAmountInvoiceByWalletIdForBtcWallet({
        uncheckedPaymentRequest: noAmountLnInvoice.paymentRequest,
        memo,
        senderWalletId: newWalletDescriptor.id,
        senderAccount: newAccount,
        amount: balance,
      })
      expect(paymentResult).toBeInstanceOf(InsufficientBalanceError)

      // Restore system state
      lndServiceSpy.mockRestore()
    })

    it("fails if amount greater than limit", async () => {
      // Create users
      const newWalletDescriptor = await createRandomUserAndBtcWallet()
      const newAccount = await AccountsRepository().findById(
        newWalletDescriptor.accountId,
      )
      if (newAccount instanceof Error) throw newAccount

      // Fund balance for send
      for (let i = 0; i < 2; i++) {
        const receive = await recordReceiveLnPayment({
          walletDescriptor: newWalletDescriptor,
          paymentAmount: receiveAboveLimitAmounts,
          bankFee: receiveBankFee,
          displayAmounts: receiveAboveLimitDisplayAmounts,
          memo,
        })
        if (receive instanceof Error) throw receive
      }

      // Attempt pay with invoice with amount
      const paymentResult = await Payments.payInvoiceByWalletId({
        uncheckedPaymentRequest: largeWithAmountLnInvoice.paymentRequest,
        memo,
        senderWalletId: newWalletDescriptor.id,
        senderAccount: newAccount,
      })
      expect(paymentResult).toBeInstanceOf(WithdrawalLimitsExceededError)

      // Attempt pay with no amount invoice
      const noAmountPaymentResult =
        await Payments.payNoAmountInvoiceByWalletIdForBtcWallet({
          uncheckedPaymentRequest: noAmountLnInvoice.paymentRequest,
          memo,
          senderWalletId: newWalletDescriptor.id,
          senderAccount: newAccount,

          amount: toSats(receiveAboveLimitAmounts.btc.amount),
        })
      expect(noAmountPaymentResult).toBeInstanceOf(WithdrawalLimitsExceededError)
    })

    it("pay zero amount invoice & revert txn when verifyMaxFee fails", async () => {
      // Setup mocks
      const { LndService: LnServiceOrig } = jest.requireActual("@/services/lnd")
      const lndServiceSpy = jest.spyOn(LndImpl, "LndService").mockReturnValue({
        ...LnServiceOrig(),
        listAllPubkeys: () => [],
        defaultPubkey: (): Pubkey => DEFAULT_PUBKEY,
      })

      const { LnFees: LnFeesOrig } = jest.requireActual("@/domain/payments")
      const lndFeesSpy = jest.spyOn(LnFeesImpl, "LnFees").mockReturnValue({
        ...LnFeesOrig(),
        verifyMaxFee: () => new MaxFeeTooLargeForRoutelessPaymentError(),
      })

      // Create users
      const newWalletDescriptor = await createRandomUserAndBtcWallet()
      const newAccount = await AccountsRepository().findById(
        newWalletDescriptor.accountId,
      )
      if (newAccount instanceof Error) throw newAccount

      // Fund balance for send
      const receive = await recordReceiveLnPayment({
        walletDescriptor: newWalletDescriptor,
        paymentAmount: receiveAmounts,
        bankFee: receiveBankFee,
        displayAmounts: receiveDisplayAmounts,
        memo,
      })
      if (receive instanceof Error) throw receive

      // Attempt pay
      const paymentResult = await Payments.payInvoiceByWalletId({
        uncheckedPaymentRequest: lnInvoice.paymentRequest,
        memo,
        senderWalletId: newWalletDescriptor.id,
        senderAccount: newAccount,
      })
      expect(paymentResult).toBeInstanceOf(MaxFeeTooLargeForRoutelessPaymentError)

      // Expect transaction to be canceled
      const txns = await LedgerService().getTransactionsByHash(lnInvoice.paymentHash)
      if (txns instanceof Error) throw txns

      const { satsAmount, satsFee } = txns[0]
      expect(txns.length).toEqual(2)
      expect(txns).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            lnMemo: "Payment canceled",
            credit: (satsAmount || 0) + (satsFee || 0),
            debit: 0,
            pendingConfirmation: false,
          }),
          expect.objectContaining({
            lnMemo: memo,
            debit: (satsAmount || 0) + (satsFee || 0),
            credit: 0,
            pendingConfirmation: false,
          }),
        ]),
      )

      // Restore system state
      lndFeesSpy.mockRestore()
      lndServiceSpy.mockRestore()
    })

    it("persists ln-payment on successful ln send", async () => {
      // Setup mocks
      const { LndService: LnServiceOrig } = jest.requireActual("@/services/lnd")
      const lndServiceSpy = jest.spyOn(LndImpl, "LndService").mockReturnValue({
        ...LnServiceOrig(),
        defaultPubkey: (): Pubkey => DEFAULT_PUBKEY,
        listAllPubkeys: () => [],
        payInvoiceViaPaymentDetails: () => ({
          type: LnPaymentAttemptResultType.Ok,
          result: {
            roundedUpFee: toSats(0),
            revealedPreImage: "revealedPreImage" as RevealedPreImage,
            sentFromPubkey: DEFAULT_PUBKEY,
          },
        }),
      })

      // Create users
      const newWalletDescriptor = await createRandomUserAndBtcWallet()
      const newAccount = await AccountsRepository().findById(
        newWalletDescriptor.accountId,
      )
      if (newAccount instanceof Error) throw newAccount

      // Fund balance for send
      const receive = await recordReceiveLnPayment({
        walletDescriptor: newWalletDescriptor,
        paymentAmount: receiveAmounts,
        bankFee: receiveBankFee,
        displayAmounts: receiveDisplayAmounts,
        memo,
      })
      if (receive instanceof Error) throw receive

      // Execute pay
      const paymentResult = await Payments.payNoAmountInvoiceByWalletIdForBtcWallet({
        uncheckedPaymentRequest: noAmountLnInvoice.paymentRequest,
        memo,
        senderWalletId: newWalletDescriptor.id,
        senderAccount: newAccount,
        amount,
      })
      if (paymentResult instanceof Error) throw paymentResult
      expect(paymentResult).toEqual({
        status: PaymentSendStatus.Success,
        transaction: expect.objectContaining({
          walletId: newWalletDescriptor.id,
          status: "success",
          settlementAmount: (amount + paymentResult.transaction.settlementFee) * -1,
          settlementCurrency: "BTC",
          initiationVia: expect.objectContaining({
            type: "lightning",
            paymentHash: noAmountLnInvoice.paymentHash,
            pubkey: DEFAULT_PUBKEY,
          }),
          settlementVia: expect.objectContaining({
            type: "lightning",
          }),
        }),
      })

      // Check lnPayment collection after
      const lnPaymentAfter = await LnPaymentsRepository().findByPaymentHash(
        noAmountLnInvoice.paymentHash,
      )
      if (lnPaymentAfter instanceof Error) throw lnPaymentAfter
      expect(lnPaymentAfter.paymentHash).toEqual(noAmountLnInvoice.paymentHash)

      // Restore system state
      lndServiceSpy.mockRestore()
    })

    it("records transaction with lightning metadata on ln send", async () => {
      // Setup mocks
      const { LndService: LnServiceOrig } = jest.requireActual("@/services/lnd")
      jest.spyOn(LndImpl, "LndService").mockReturnValue({
        ...LnServiceOrig(),
        defaultPubkey: (): Pubkey => DEFAULT_PUBKEY,
        listAllPubkeys: () => [],
      })

      const displayAmountsConverterSpy = jest.spyOn(
        DisplayAmountsConverterImpl,
        "DisplayAmountsConverter",
      )

      const lnSendLedgerMetadataSpy = jest.spyOn(LedgerFacadeImpl, "LnSendLedgerMetadata")
      const recordOffChainSendSpy = jest.spyOn(LedgerFacadeImpl, "recordSendOffChain")

      // Create users
      const newWalletDescriptor = await createRandomUserAndBtcWallet()
      const newAccount = await AccountsRepository().findById(
        newWalletDescriptor.accountId,
      )
      if (newAccount instanceof Error) throw newAccount

      // Fund balance for send
      const receive = await recordReceiveLnPayment({
        walletDescriptor: newWalletDescriptor,
        paymentAmount: receiveAmounts,
        bankFee: receiveBankFee,
        displayAmounts: receiveDisplayAmounts,
        memo,
      })
      if (receive instanceof Error) throw receive

      // Execute pay
      await Payments.payNoAmountInvoiceByWalletIdForBtcWallet({
        uncheckedPaymentRequest: noAmountLnInvoice.paymentRequest,
        memo,
        senderWalletId: newWalletDescriptor.id,
        senderAccount: newAccount,
        amount,
      })

      // Check record function was called with right metadata
      expect(displayAmountsConverterSpy).toHaveBeenCalledTimes(1)
      expect(lnSendLedgerMetadataSpy).toHaveBeenCalledTimes(1)
      const args = recordOffChainSendSpy.mock.calls[0][0]
      expect(args.metadata.type).toBe(LedgerTransactionType.Payment)
    })

    it("records transaction with fee reimbursement metadata on ln send", async () => {
      // Setup mocks
      const { LndService: LnServiceOrig } = jest.requireActual("@/services/lnd")
      jest.spyOn(LndImpl, "LndService").mockReturnValue({
        ...LnServiceOrig(),
        defaultPubkey: (): Pubkey => DEFAULT_PUBKEY,
        listAllPubkeys: () => [],
        payInvoiceViaPaymentDetails: () => ({
          type: LnPaymentAttemptResultType.Ok,
          result: {
            roundedUpFee: toSats(0),
            revealedPreImage: "revealedPreImage" as RevealedPreImage,
            sentFromPubkey: DEFAULT_PUBKEY,
          },
        }),
      })

      const displayAmountsConverterSpy = jest.spyOn(
        DisplayAmountsConverterImpl,
        "DisplayAmountsConverter",
      )

      const lnFeeReimbursementReceiveLedgerMetadataSpy = jest.spyOn(
        LedgerFacadeImpl,
        "LnFeeReimbursementReceiveLedgerMetadata",
      )
      const recordOffChainReceiveSpy = jest.spyOn(
        LedgerFacadeImpl,
        "recordReceiveOffChain",
      )

      // Create users
      const newWalletDescriptor = await createRandomUserAndBtcWallet()
      const newAccount = await AccountsRepository().findById(
        newWalletDescriptor.accountId,
      )
      if (newAccount instanceof Error) throw newAccount

      // Fund balance for send
      const receive = await recordReceiveLnPayment({
        walletDescriptor: newWalletDescriptor,
        paymentAmount: receiveAmounts,
        bankFee: receiveBankFee,
        displayAmounts: receiveDisplayAmounts,
        memo,
      })
      if (receive instanceof Error) throw receive

      // Execute pay
      await Payments.payNoAmountInvoiceByWalletIdForBtcWallet({
        uncheckedPaymentRequest: noAmountLnInvoice.paymentRequest,
        memo,
        senderWalletId: newWalletDescriptor.id,
        senderAccount: newAccount,
        amount,
      })

      // Check record function was called with right metadata
      expect(displayAmountsConverterSpy).toHaveBeenCalledTimes(2)
      expect(lnFeeReimbursementReceiveLedgerMetadataSpy).toHaveBeenCalledTimes(1)
      // Note: 1st call is funding balance in test, 2nd call is fee reimbursement
      const args = recordOffChainReceiveSpy.mock.calls[1][0]
      expect(args.metadata.type).toBe(LedgerTransactionType.LnFeeReimbursement)
    })
  })

  describe("settles intraledger", () => {
    it("fails if recipient account is locked", async () => {
      const { paymentHash, destination } = lnInvoice

      // Setup mocks
      const { LndService: LnServiceOrig } = jest.requireActual("@/services/lnd")
      const lndServiceSpy = jest.spyOn(LndImpl, "LndService").mockReturnValue({
        ...LnServiceOrig(),
        listAllPubkeys: () => [destination],
      })

      // Setup users and wallets
      const newWalletDescriptor = await createRandomUserAndBtcWallet()
      const newAccount = await AccountsRepository().findById(
        newWalletDescriptor.accountId,
      )
      if (newAccount instanceof Error) throw newAccount

      const recipientWalletDescriptor = await createRandomUserAndBtcWallet()
      const recipientAccount = await AccountsRepository().findById(
        recipientWalletDescriptor.accountId,
      )
      if (recipientAccount instanceof Error) throw recipientAccount

      // Fund balance for send
      const receive = await recordReceiveLnPayment({
        walletDescriptor: newWalletDescriptor,
        paymentAmount: receiveAmounts,
        bankFee: receiveBankFee,
        displayAmounts: receiveDisplayAmounts,
        memo,
      })
      if (receive instanceof Error) throw receive

      const externalId = randomLedgerExternalId()
      if (externalId instanceof Error) throw externalId

      // Add recipient invoice
      const persisted = await WalletInvoicesRepository().persistNew({
        paymentHash,
        secret: "secret" as SecretPreImage,
        selfGenerated: true,
        pubkey: destination,
        recipientWalletDescriptor,
        paid: false,
        lnInvoice,
        processingCompleted: false,
        externalId,
      })
      if (persisted instanceof Error) throw persisted

      // Lock recipient account
      const updatedAccount = await Accounts.updateAccountStatus({
        accountId: recipientAccount.id,
        status: AccountStatus.Locked,
        updatedByPrivilegedClientId,
      })
      if (updatedAccount instanceof Error) throw updatedAccount
      expect(updatedAccount.status).toEqual(AccountStatus.Locked)

      // Attempt send payment
      const res = await Payments.payInvoiceByWalletId({
        senderWalletId: newWalletDescriptor.id,
        senderAccount: newAccount,
        uncheckedPaymentRequest: lnInvoice.paymentRequest,

        memo,
      })
      expect(res).toBeInstanceOf(InactiveAccountError)

      // Restore system state
      lndServiceSpy.mockRestore()
    })

    it("fails if sends to self", async () => {
      // Setup mocks
      const { LndService: LnServiceOrig } = jest.requireActual("@/services/lnd")
      const lndServiceSpy = jest.spyOn(LndImpl, "LndService").mockReturnValue({
        ...LnServiceOrig(),
        listAllPubkeys: () => [lnInvoice.destination],
      })

      // Create users
      const newWalletDescriptor = await createRandomUserAndBtcWallet()
      const newAccount = await AccountsRepository().findById(
        newWalletDescriptor.accountId,
      )
      if (newAccount instanceof Error) throw newAccount

      const externalId = randomLedgerExternalId()
      if (externalId instanceof Error) throw externalId

      // Persist invoice as self-invoice
      const persisted = await WalletInvoicesRepository().persistNew({
        paymentHash: lnInvoice.paymentHash,
        secret: "secret" as SecretPreImage,
        selfGenerated: true,
        pubkey: lnInvoice.destination,
        recipientWalletDescriptor: newWalletDescriptor,
        paid: false,
        lnInvoice,
        processingCompleted: false,
        externalId,
      })
      if (persisted instanceof Error) throw persisted

      // Fund balance for send
      const receive = await recordReceiveLnPayment({
        walletDescriptor: newWalletDescriptor,
        paymentAmount: receiveAmounts,
        bankFee: receiveBankFee,
        displayAmounts: receiveDisplayAmounts,
        memo,
      })
      if (receive instanceof Error) throw receive

      // Attempt pay
      const paymentResult = await Payments.payInvoiceByWalletId({
        uncheckedPaymentRequest: lnInvoice.paymentRequest,
        memo,
        senderWalletId: newWalletDescriptor.id,
        senderAccount: newAccount,
      })
      expect(paymentResult).toBeInstanceOf(SelfPaymentError)

      // Restore system state
      lndServiceSpy.mockRestore()
    })

    it("fails if amount greater than trade-intra-account limit", async () => {
      // Setup mocks
      const { LndService: LnServiceOrig } = jest.requireActual("@/services/lnd")
      const lndServiceSpy = jest.spyOn(LndImpl, "LndService").mockReturnValue({
        ...LnServiceOrig(),
        listAllPubkeys: () => [
          noAmountLnInvoice.destination,
          largeWithAmountLnInvoice.destination,
        ],
      })

      // Create users
      const { btcWalletDescriptor: newWalletDescriptor, usdWalletDescriptor } =
        await createRandomUserAndWallets()
      const newAccount = await AccountsRepository().findById(
        newWalletDescriptor.accountId,
      )
      if (newAccount instanceof Error) throw newAccount

      // Fund balance for send
      for (let i = 0; i < 2; i++) {
        const receive = await recordReceiveLnPayment({
          walletDescriptor: newWalletDescriptor,
          paymentAmount: receiveAboveLimitAmounts,
          bankFee: receiveBankFee,
          displayAmounts: receiveAboveLimitDisplayAmounts,
          memo,
        })
        if (receive instanceof Error) throw receive
      }

      expect(largeWithAmountLnInvoice.paymentAmount).toStrictEqual(
        receiveAboveLimitAmounts.btc,
      )
      const usdAmount = receiveAboveLimitAmounts.usd

      let externalId = randomLedgerExternalId()
      if (externalId instanceof Error) throw externalId

      // Persist invoice as self-invoice
      const persisted = await WalletInvoicesRepository().persistNew({
        paymentHash: largeWithAmountLnInvoice.paymentHash,
        secret: "secret" as SecretPreImage,
        selfGenerated: true,
        pubkey: largeWithAmountLnInvoice.destination,
        recipientWalletDescriptor: usdWalletDescriptor,
        paid: false,
        usdAmount,
        lnInvoice,
        processingCompleted: false,
        externalId,
      })
      if (persisted instanceof Error) throw persisted

      // Attempt pay with invoice with amount
      const paymentResult = await Payments.payInvoiceByWalletId({
        uncheckedPaymentRequest: largeWithAmountLnInvoice.paymentRequest,
        memo,
        senderWalletId: newWalletDescriptor.id,
        senderAccount: newAccount,
      })
      expect(paymentResult).toBeInstanceOf(TradeIntraAccountLimitsExceededError)

      externalId = randomLedgerExternalId()
      if (externalId instanceof Error) throw externalId

      // Persist no-amount invoice as self-invoice
      const noAmountPersisted = await WalletInvoicesRepository().persistNew({
        paymentHash: noAmountLnInvoice.paymentHash,
        secret: "secret" as SecretPreImage,
        selfGenerated: true,
        pubkey: noAmountLnInvoice.destination,
        recipientWalletDescriptor: usdWalletDescriptor,
        paid: false,
        lnInvoice,
        processingCompleted: false,
        externalId,
      })
      if (noAmountPersisted instanceof Error) throw noAmountPersisted

      // Attempt pay with no-amount invoice
      const noAmountPaymentResult =
        await Payments.payNoAmountInvoiceByWalletIdForBtcWallet({
          uncheckedPaymentRequest: noAmountLnInvoice.paymentRequest,
          memo,
          senderWalletId: newWalletDescriptor.id,
          senderAccount: newAccount,

          amount: toSats(receiveAboveLimitAmounts.btc.amount),
        })
      expect(noAmountPaymentResult).toBeInstanceOf(TradeIntraAccountLimitsExceededError)

      // Restore system state
      lndServiceSpy.mockReset()
    })

    it("fails if amount greater than intraledger limit", async () => {
      // Setup mocks
      const { LndService: LnServiceOrig } = jest.requireActual("@/services/lnd")
      const lndServiceSpy = jest.spyOn(LndImpl, "LndService").mockReturnValue({
        ...LnServiceOrig(),
        listAllPubkeys: () => [
          noAmountLnInvoice.destination,
          largeWithAmountLnInvoice.destination,
        ],
      })

      // Create users
      const newWalletDescriptor = await createRandomUserAndBtcWallet()
      const otherWalletDescriptor = await createRandomUserAndBtcWallet()
      const newAccount = await AccountsRepository().findById(
        newWalletDescriptor.accountId,
      )
      if (newAccount instanceof Error) throw newAccount

      // Fund balance for send
      for (let i = 0; i < 2; i++) {
        const receive = await recordReceiveLnPayment({
          walletDescriptor: newWalletDescriptor,
          paymentAmount: receiveAboveLimitAmounts,
          bankFee: receiveBankFee,
          displayAmounts: receiveAboveLimitDisplayAmounts,
          memo,
        })
        if (receive instanceof Error) throw receive
      }

      let externalId = randomLedgerExternalId()
      if (externalId instanceof Error) throw externalId

      // Persist invoice as self-invoice
      const persisted = await WalletInvoicesRepository().persistNew({
        paymentHash: largeWithAmountLnInvoice.paymentHash,
        secret: "secret" as SecretPreImage,
        selfGenerated: true,
        pubkey: largeWithAmountLnInvoice.destination,
        recipientWalletDescriptor: otherWalletDescriptor,
        paid: false,
        lnInvoice,
        processingCompleted: false,
        externalId,
      })
      if (persisted instanceof Error) throw persisted

      // Attempt pay with invoice with amount
      const paymentResult = await Payments.payInvoiceByWalletId({
        uncheckedPaymentRequest: largeWithAmountLnInvoice.paymentRequest,
        memo,
        senderWalletId: newWalletDescriptor.id,
        senderAccount: newAccount,
      })
      expect(paymentResult).toBeInstanceOf(IntraledgerLimitsExceededError)

      externalId = randomLedgerExternalId()
      if (externalId instanceof Error) throw externalId

      // Persist no-amount invoice as self-invoice
      const noAmountPersisted = await WalletInvoicesRepository().persistNew({
        paymentHash: noAmountLnInvoice.paymentHash,
        secret: "secret" as SecretPreImage,
        selfGenerated: true,
        pubkey: noAmountLnInvoice.destination,
        recipientWalletDescriptor: otherWalletDescriptor,
        paid: false,
        lnInvoice,
        processingCompleted: false,
        externalId,
      })
      if (noAmountPersisted instanceof Error) throw noAmountPersisted

      // Attempt pay with no-amount invoice
      const noAmountPaymentResult =
        await Payments.payNoAmountInvoiceByWalletIdForBtcWallet({
          uncheckedPaymentRequest: noAmountLnInvoice.paymentRequest,
          memo,
          senderWalletId: newWalletDescriptor.id,
          senderAccount: newAccount,

          amount: toSats(receiveAboveLimitAmounts.btc.amount),
        })
      expect(noAmountPaymentResult).toBeInstanceOf(IntraledgerLimitsExceededError)

      // Restore system state
      lndServiceSpy.mockReset()
    })

    it("records transaction with ln-trade-intra-account metadata on intraledger send", async () => {
      // Setup mocks
      const { LndService: LnServiceOrig } = jest.requireActual("@/services/lnd")
      jest.spyOn(LndImpl, "LndService").mockReturnValue({
        ...LnServiceOrig(),
        listAllPubkeys: () => [noAmountLnInvoice.destination],
        cancelInvoice: () => true,
      })

      const displayAmountsConverterSpy = jest.spyOn(
        DisplayAmountsConverterImpl,
        "DisplayAmountsConverter",
      )

      const lnTradeIntraAccountLedgerMetadataSpy = jest.spyOn(
        LedgerFacadeImpl,
        "LnTradeIntraAccountLedgerMetadata",
      )
      const recordIntraledgerSpy = jest.spyOn(LedgerFacadeImpl, "recordIntraledger")

      // Create users
      const { btcWalletDescriptor: newWalletDescriptor, usdWalletDescriptor } =
        await createRandomUserAndWallets()
      const newAccount = await AccountsRepository().findById(
        newWalletDescriptor.accountId,
      )
      if (newAccount instanceof Error) throw newAccount

      const externalId = randomLedgerExternalId()
      if (externalId instanceof Error) throw externalId

      // Persist invoice as self-invoice
      const persisted = await WalletInvoicesRepository().persistNew({
        paymentHash: noAmountLnInvoice.paymentHash,
        secret: "secret" as SecretPreImage,
        selfGenerated: true,
        pubkey: noAmountLnInvoice.destination,
        recipientWalletDescriptor: usdWalletDescriptor,
        paid: false,
        lnInvoice,
        processingCompleted: false,
        externalId,
      })
      if (persisted instanceof Error) throw persisted

      // Fund balance for send
      const receive = await recordReceiveLnPayment({
        walletDescriptor: newWalletDescriptor,
        paymentAmount: receiveAmounts,
        bankFee: receiveBankFee,
        displayAmounts: receiveDisplayAmounts,
        memo,
      })
      if (receive instanceof Error) throw receive

      // Execute pay
      await Payments.payNoAmountInvoiceByWalletIdForBtcWallet({
        uncheckedPaymentRequest: noAmountLnInvoice.paymentRequest,
        memo,
        senderWalletId: newWalletDescriptor.id,
        senderAccount: newAccount,
        amount,
      })

      // Check record function was called with right metadata
      expect(displayAmountsConverterSpy).toHaveBeenCalledTimes(2)
      expect(lnTradeIntraAccountLedgerMetadataSpy).toHaveBeenCalledTimes(1)
      const args = recordIntraledgerSpy.mock.calls[0][0]
      expect(args.metadata.type).toBe(LedgerTransactionType.LnTradeIntraAccount)
    })

    it("records transaction with ln-intraledger metadata on intraledger send", async () => {
      // Setup mocks
      const { LndService: LnServiceOrig } = jest.requireActual("@/services/lnd")
      jest.spyOn(LndImpl, "LndService").mockReturnValue({
        ...LnServiceOrig(),
        listAllPubkeys: () => [noAmountLnInvoice.destination],
        cancelInvoice: () => true,
      })

      const displayAmountsConverterSpy = jest.spyOn(
        DisplayAmountsConverterImpl,
        "DisplayAmountsConverter",
      )

      const lnIntraledgerLedgerMetadataSpy = jest.spyOn(
        LedgerFacadeImpl,
        "LnIntraledgerLedgerMetadata",
      )
      const recordIntraledgerSpy = jest.spyOn(LedgerFacadeImpl, "recordIntraledger")

      // Setup users and wallets
      const newWalletDescriptor = await createRandomUserAndBtcWallet()
      const newAccount = await AccountsRepository().findById(
        newWalletDescriptor.accountId,
      )
      if (newAccount instanceof Error) throw newAccount

      const recipientWalletDescriptor = await createRandomUserAndBtcWallet()

      const externalId = randomLedgerExternalId()
      if (externalId instanceof Error) throw externalId

      // Persist invoice as self-invoice
      const persisted = await WalletInvoicesRepository().persistNew({
        paymentHash: noAmountLnInvoice.paymentHash,
        secret: "secret" as SecretPreImage,
        selfGenerated: true,
        pubkey: noAmountLnInvoice.destination,
        recipientWalletDescriptor,
        paid: false,
        lnInvoice,
        processingCompleted: false,
        externalId,
      })
      if (persisted instanceof Error) throw persisted

      // Fund balance for send
      const receive = await recordReceiveLnPayment({
        walletDescriptor: newWalletDescriptor,
        paymentAmount: receiveAmounts,
        bankFee: receiveBankFee,
        displayAmounts: receiveDisplayAmounts,
        memo,
      })
      if (receive instanceof Error) throw receive

      // Execute pay
      await Payments.payNoAmountInvoiceByWalletIdForBtcWallet({
        uncheckedPaymentRequest: noAmountLnInvoice.paymentRequest,
        memo,
        senderWalletId: newWalletDescriptor.id,
        senderAccount: newAccount,
        amount,
      })

      // Check record function was called with right metadata
      expect(displayAmountsConverterSpy).toHaveBeenCalledTimes(2)
      expect(lnIntraledgerLedgerMetadataSpy).toHaveBeenCalledTimes(1)
      const args = recordIntraledgerSpy.mock.calls[0][0]
      expect(args.metadata.type).toBe(LedgerTransactionType.LnIntraLedger)
    })
  })
})
