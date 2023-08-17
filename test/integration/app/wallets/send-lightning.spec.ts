import { Accounts, Payments } from "@app"

import { AccountStatus } from "@domain/accounts"
import { toSats } from "@domain/bitcoin"
import {
  MaxFeeTooLargeForRoutelessPaymentError,
  PaymentSendStatus,
  decodeInvoice,
} from "@domain/bitcoin/lightning"
import { DisplayCurrency, toCents } from "@domain/fiat"
import {
  LnPaymentRequestNonZeroAmountRequiredError,
  ZeroAmountForUsdRecipientError,
} from "@domain/payments"
import {
  InactiveAccountError,
  InsufficientBalanceError,
  SelfPaymentError,
} from "@domain/errors"
import { AmountCalculator, WalletCurrency } from "@domain/shared"
import * as LnFeesImpl from "@domain/payments/ln-fees"

import { AccountsRepository, WalletInvoicesRepository } from "@services/mongoose"
import { LedgerService } from "@services/ledger"
import { Transaction } from "@services/ledger/schema"
import { WalletInvoice } from "@services/mongoose/schema"
import * as LndImpl from "@services/lnd"
import * as PushNotificationsServiceImpl from "@services/notifications/push-notifications"

import {
  createMandatoryUsers,
  createRandomUserAndBtcWallet,
  createRandomUserAndWallets,
  getBalanceHelper,
  recordReceiveLnPayment,
} from "test/helpers"

let lnInvoice: LnInvoice
let noAmountLnInvoice: LnInvoice
let memo

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
})

beforeEach(() => {
  memo = randomLightningMemo()
})

afterEach(async () => {
  await Transaction.deleteMany({ memo })
  await Transaction.deleteMany({ memoPayer: memo })
  await Transaction.deleteMany({ hash: lnInvoice.paymentHash })
  await Transaction.deleteMany({ hash: noAmountLnInvoice.paymentHash })
  await WalletInvoice.deleteMany({})
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
  displayCurrency: DisplayCurrency.Usd,
}

const randomLightningMemo = () =>
  "this is my lightning memo #" + (Math.random() * 1_000_000).toFixed()

describe("initiated via lightning", () => {
  describe("settles via lightning", () => {
    it("fails if sender account is locked", async () => {
      // Setup mocks
      const { LndService: LnServiceOrig } = jest.requireActual("@services/lnd")
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
        id: newAccount.id,
        status: AccountStatus.Locked,
        updatedByUserId: newAccount.kratosUserId,
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
      lndServiceSpy.mockReset()
    })

    it("fails when user has insufficient balance", async () => {
      // Setup mocks
      const { LndService: LnServiceOrig } = jest.requireActual("@services/lnd")
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
      lndServiceSpy.mockReset()
    })

    it("fails to pay zero amount invoice without separate amount", async () => {
      // Setup mocks
      const { LndService: LnServiceOrig } = jest.requireActual("@services/lnd")
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
      lndServiceSpy.mockReset()
    })

    it("fails if user sends balance amount without accounting for fee", async () => {
      // Setup mocks
      const { LndService: LnServiceOrig } = jest.requireActual("@services/lnd")
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
      lndServiceSpy.mockReset()
    })

    it("pay zero amount invoice & revert txn when verifyMaxFee fails", async () => {
      // Setup mocks
      const { LndService: LnServiceOrig } = jest.requireActual("@services/lnd")
      const lndServiceSpy = jest.spyOn(LndImpl, "LndService").mockReturnValue({
        ...LnServiceOrig(),
        listAllPubkeys: () => [],
        defaultPubkey: () => DEFAULT_PUBKEY,
      })

      const { LnFees: LnFeesOrig } = jest.requireActual("@domain/payments/ln-fees")
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
      lndFeesSpy.mockReset()
      lndServiceSpy.mockReset()
    })
  })

  describe("settles intraledger", () => {
    it("fails if recipient account is locked", async () => {
      const { paymentHash, destination } = lnInvoice

      // Setup mocks
      const { LndService: LnServiceOrig } = jest.requireActual("@services/lnd")
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

      // Add recipient invoice
      const persisted = await WalletInvoicesRepository().persistNew({
        paymentHash,
        secret: "secret" as SecretPreImage,
        selfGenerated: true,
        pubkey: destination,
        recipientWalletDescriptor,
        paid: false,
      })
      if (persisted instanceof Error) throw persisted

      // Lock recipient account
      const updatedAccount = await Accounts.updateAccountStatus({
        id: recipientAccount.id,
        status: AccountStatus.Locked,
        updatedByUserId: recipientAccount.kratosUserId,
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
      lndServiceSpy.mockReset()
    })

    it("fails if sends to self", async () => {
      // Setup mocks
      const { LndService: LnServiceOrig } = jest.requireActual("@services/lnd")
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

      // Persist invoice as self-invoice
      const persisted = await WalletInvoicesRepository().persistNew({
        paymentHash: lnInvoice.paymentHash,
        secret: "secret" as SecretPreImage,
        selfGenerated: true,
        pubkey: lnInvoice.destination,
        recipientWalletDescriptor: newWalletDescriptor,
        paid: false,
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
      lndServiceSpy.mockReset()
    })

    it("fails to send less-than-1-cent amount to usd recipient", async () => {
      // Setup mocks
      const { LndService: LnServiceOrig } = jest.requireActual("@services/lnd")
      const lndServiceSpy = jest.spyOn(LndImpl, "LndService").mockReturnValue({
        ...LnServiceOrig(),
        listAllPubkeys: () => [noAmountLnInvoice.destination],
      })

      // Create users
      const { btcWalletDescriptor: newWalletDescriptor, usdWalletDescriptor } =
        await createRandomUserAndWallets()
      const newAccount = await AccountsRepository().findById(
        newWalletDescriptor.accountId,
      )
      if (newAccount instanceof Error) throw newAccount

      // Persist invoice as self-invoice
      const persisted = await WalletInvoicesRepository().persistNew({
        paymentHash: noAmountLnInvoice.paymentHash,
        secret: "secret" as SecretPreImage,
        selfGenerated: true,
        pubkey: noAmountLnInvoice.destination,
        recipientWalletDescriptor: usdWalletDescriptor,
        paid: false,
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
      const paymentResult = await Payments.payNoAmountInvoiceByWalletIdForBtcWallet({
        uncheckedPaymentRequest: noAmountLnInvoice.paymentRequest,
        memo,
        senderWalletId: newWalletDescriptor.id,
        senderAccount: newAccount,
        amount: 1,
      })
      expect(paymentResult).toBeInstanceOf(ZeroAmountForUsdRecipientError)

      // Restore system state
      lndServiceSpy.mockReset()
    })

    it("calls sendNotification on successful intraledger send", async () => {
      // Setup mocks
      const sendNotification = jest.fn()
      const pushNotificationsServiceSpy = jest
        .spyOn(PushNotificationsServiceImpl, "PushNotificationsService")
        .mockImplementationOnce(() => ({ sendNotification }))

      const { LndService: LnServiceOrig } = jest.requireActual("@services/lnd")
      const lndServiceSpy = jest.spyOn(LndImpl, "LndService").mockReturnValue({
        ...LnServiceOrig(),
        listAllPubkeys: () => [noAmountLnInvoice.destination],
        cancelInvoice: () => true,
      })

      // Create users
      const { btcWalletDescriptor: newWalletDescriptor, usdWalletDescriptor } =
        await createRandomUserAndWallets()
      const newAccount = await AccountsRepository().findById(
        newWalletDescriptor.accountId,
      )
      if (newAccount instanceof Error) throw newAccount

      // Persist invoice as self-invoice
      const persisted = await WalletInvoicesRepository().persistNew({
        paymentHash: noAmountLnInvoice.paymentHash,
        secret: "secret" as SecretPreImage,
        selfGenerated: true,
        pubkey: noAmountLnInvoice.destination,
        recipientWalletDescriptor: usdWalletDescriptor,
        paid: false,
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
      const paymentResult = await Payments.payNoAmountInvoiceByWalletIdForBtcWallet({
        uncheckedPaymentRequest: noAmountLnInvoice.paymentRequest,
        memo,
        senderWalletId: newWalletDescriptor.id,
        senderAccount: newAccount,
        amount,
      })
      expect(paymentResult).toEqual(PaymentSendStatus.Success)

      // Expect sent notification
      expect(sendNotification.mock.calls.length).toBe(1)
      expect(sendNotification.mock.calls[0][0].title).toBeTruthy()

      // Restore system state
      pushNotificationsServiceSpy.mockReset()
      lndServiceSpy.mockReset()
    })
  })
})
