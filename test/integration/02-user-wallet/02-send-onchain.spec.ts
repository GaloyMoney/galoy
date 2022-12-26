import { once } from "events"

import { Prices, Wallets } from "@app"
import {
  BTC_NETWORK,
  getAccountLimits,
  getDisplayCurrencyConfig,
  getFeesConfig,
  getLocale,
  getOnChainWalletConfig,
  ONE_DAY,
} from "@config"
import { toSats, toTargetConfs } from "@domain/bitcoin"
import { PaymentSendStatus } from "@domain/bitcoin/lightning"
import {
  InsufficientBalanceError,
  InvalidCurrencyBaseAmountError,
  LessThanDustThresholdError,
  LimitsExceededError,
  RebalanceNeededError,
  SelfPaymentError,
} from "@domain/errors"
import { InvalidZeroAmountPriceRatioInputError } from "@domain/payments"
import { NotificationType } from "@domain/notifications"
import { PaymentInitiationMethod, SettlementMethod, TxStatus } from "@domain/wallets"
import { onchainTransactionEventHandler } from "@servers/trigger"
import { LedgerService } from "@services/ledger"
import { sleep, timestampDaysAgo } from "@utils"

import { getCurrentPrice } from "@app/prices"

import { DisplayCurrencyConverter } from "@domain/fiat/display-currency"

import { add, sub, toCents } from "@domain/fiat"

import { createPushNotificationContent } from "@services/notifications/create-push-notification-content"
import { WalletsRepository } from "@services/mongoose"
import * as PushNotificationsServiceImpl from "@services/notifications/push-notifications"

import { paymentAmountFromNumber, WalletCurrency } from "@domain/shared"

import {
  CPFPAncestorLimitReachedError,
  InsufficientOnChainFundsError,
  OnChainServiceUnavailableError,
  UnknownOnChainServiceError,
} from "@domain/bitcoin/onchain/errors"
import { TxDecoder } from "@domain/bitcoin/onchain"
import * as OnChainServiceImpl from "@services/lnd/onchain-service"
import { DealerPriceService } from "@services/dealer-price"

import { getBalanceHelper } from "test/helpers/wallet"
import {
  bitcoindClient,
  bitcoindOutside,
  checkIsBalanced,
  createChainAddress,
  createMandatoryUsers,
  createUserAndWalletFromUserRef,
  getAccountByTestUserRef,
  getDefaultWalletIdByTestUserRef,
  getAccountRecordByTestUserRef,
  lndonchain,
  lndOutside1,
  mineBlockAndSync,
  mineBlockAndSyncAll,
  subscribeToTransactions,
  getUsdWalletIdByTestUserRef,
  publishOkexPrice,
  cancelOkexPricePublish,
} from "test/helpers"

let accountRecordA: AccountRecord

let accountA: Account
let accountB: Account
let accountE: Account
let accountG: Account

let walletIdA: WalletId
let walletIdUsdA: WalletId
let walletIdUsdB: WalletId
let walletIdD: WalletId
let walletIdG: WalletId

// using walletIdE and walletIdF to sendAll
let walletIdE: WalletId
let walletIdF: WalletId

const locale = getLocale()
const { code: DefaultDisplayCurrency } = getDisplayCurrencyConfig()

beforeAll(async () => {
  await publishOkexPrice()
  await createMandatoryUsers()

  await createUserAndWalletFromUserRef("B")
  await createUserAndWalletFromUserRef("D")
  await createUserAndWalletFromUserRef("E")
  await createUserAndWalletFromUserRef("F")

  accountRecordA = await getAccountRecordByTestUserRef("A")
  walletIdA = await getDefaultWalletIdByTestUserRef("A")
  walletIdUsdA = await getUsdWalletIdByTestUserRef("A")
  accountA = await getAccountByTestUserRef("A")

  walletIdUsdB = await getUsdWalletIdByTestUserRef("B")
  accountB = await getAccountByTestUserRef("B")

  walletIdD = await getDefaultWalletIdByTestUserRef("D")
  walletIdE = await getDefaultWalletIdByTestUserRef("E")
  walletIdF = await getDefaultWalletIdByTestUserRef("F")
  walletIdG = await getDefaultWalletIdByTestUserRef("G")
  accountE = await getAccountByTestUserRef("E")
  accountG = await getAccountByTestUserRef("G")

  await bitcoindClient.loadWallet({ filename: "outside" })
})

afterEach(async () => {
  await checkIsBalanced()
})

afterAll(async () => {
  cancelOkexPricePublish()
  jest.restoreAllMocks()
  await bitcoindClient.unloadWallet({ walletName: "outside" })
})

const amount = toSats(10040)
const usdAmount = toCents(105)
const amountBelowDustThreshold = getOnChainWalletConfig().dustThreshold - 1
const targetConfirmations = toTargetConfs(1)

const payOnChainForPromiseAll = async (args: PayOnChainByWalletIdArgs) => {
  const res = await Wallets.payOnChainByWalletId(args)
  if (res instanceof Error) throw res
  return res
}

const testExternalSend = async ({
  senderAccount,
  senderWalletId,
  amount,
  sendAll,
}: {
  senderAccount: Account
  senderWalletId: WalletId
  amount: Satoshis | UsdCents
  sendAll: boolean
}) => {
  const initialWalletBalance = await getBalanceHelper(senderWalletId)

  const sendNotification = jest.fn()
  jest
    .spyOn(PushNotificationsServiceImpl, "PushNotificationsService")
    .mockImplementation(() => ({ sendNotification }))
  const { address } = await createChainAddress({ format: "p2wpkh", lnd: lndOutside1 })

  const sub = subscribeToTransactions({ lnd: lndonchain })
  sub.on("chain_transaction", onchainTransactionEventHandler)

  const results = await Promise.all([
    once(sub, "chain_transaction"),
    payOnChainForPromiseAll({
      senderAccount,
      senderWalletId,
      address,
      amount,
      targetConfirmations,
      memo: null,
      sendAll,
    }),
  ])

  expect(results[1]).toBe(PaymentSendStatus.Success)
  await onchainTransactionEventHandler(results[0][0])

  // we don't send a notification for send transaction for now
  // expect(sendNotification.mock.calls.length).toBe(1)
  // expect(sendNotification.mock.calls[0][0].data.type).toBe(NotificationType.OnchainPayment)
  // expect(sendNotification.mock.calls[0][0].data.title).toBe(`Your transaction has been sent. It may takes some time before it is confirmed`)

  let pendingTxHash: OnChainTxHash

  {
    const txResult = await Wallets.getTransactionsForWalletId({
      walletId: senderWalletId,
    })
    if (txResult.error instanceof Error || txResult.result === null) {
      throw txResult.error
    }
    const pendingTxs = txResult.result.filter(({ status }) => status === TxStatus.Pending)
    expect(pendingTxs.length).toBe(1)
    const pendingTx = pendingTxs[0]
    const interimBalance = await getBalanceHelper(senderWalletId)

    if (sendAll) {
      expect(pendingTx.settlementAmount).toBe(-initialWalletBalance)
      expect(interimBalance).toBe(0)
    } else {
      expect(pendingTx.settlementAmount).toBe(-amount - pendingTx.settlementFee)
      expect(interimBalance).toBe(initialWalletBalance - amount - pendingTx.settlementFee)
    }

    pendingTxHash = pendingTx.id as OnChainTxHash

    await checkIsBalanced()
  }

  // const subSpend = subscribeToChainSpend({ lnd: lndonchain, bech32_address: address, min_height: 1 })

  await Promise.all([
    once(sub, "chain_transaction"),
    mineBlockAndSync({ lnds: [lndonchain] }),
  ])

  await sleep(1000)

  expect(sendNotification.mock.calls.length).toBe(1)

  const senderWallet = await WalletsRepository().findById(senderWalletId)
  if (senderWallet instanceof Error) throw senderWallet

  if (!sendAll) {
    const satsPrice = await Prices.getCurrentPrice()
    if (satsPrice instanceof Error) throw satsPrice

    const paymentAmount = { amount: BigInt(amount), currency: senderWallet.currency }
    const displayPaymentAmount = {
      amount: senderWallet.currency === WalletCurrency.Btc ? amount * satsPrice : amount,
      currency: DefaultDisplayCurrency,
    }

    const { title, body } = createPushNotificationContent({
      type: NotificationType.OnchainPayment,
      userLanguage: locale as UserLanguage,
      amount: paymentAmount,
      displayAmount: displayPaymentAmount,
    })

    expect(sendNotification.mock.calls[0][0].title).toBe(title)
    expect(sendNotification.mock.calls[0][0].body).toBe(body)
  }

  {
    const txResult = await Wallets.getTransactionsForWalletId({
      walletId: senderWalletId,
    })
    if (txResult.error instanceof Error || txResult.result === null) {
      throw txResult.error
    }
    const pendingTxs = txResult.result.filter(({ status }) => status === TxStatus.Pending)
    expect(pendingTxs.length).toBe(0)

    const settledTxs = txResult.result.filter(
      ({ status, initiationVia, id }) =>
        status === TxStatus.Success &&
        initiationVia.type === PaymentInitiationMethod.OnChain &&
        id === pendingTxHash,
    )
    expect(settledTxs.length).toBe(1)
    const settledTx = settledTxs[0] as WalletTransaction

    const feeRates = getFeesConfig()
    let fee: number
    if (senderWallet.currency === WalletCurrency.Btc) {
      fee = feeRates.withdrawDefaultMin + 7050
    } else {
      const feeSats = toSats(feeRates.withdrawDefaultMin + 7050)
      const dealerFns = DealerPriceService()
      const feeResult = await dealerFns.getCentsFromSatsForImmediateSell(feeSats)
      if (feeResult instanceof Error) throw feeResult
      fee = feeResult
    }

    expect(settledTx.settlementFee).toBe(fee)
    expect(settledTx.displayCurrencyPerSettlementCurrencyUnit).toBeGreaterThan(0)

    const finalBalance = await getBalanceHelper(senderWalletId)

    if (sendAll) {
      expect(settledTx.settlementAmount).toBe(-initialWalletBalance)
      expect(finalBalance).toBe(0)
    } else {
      expect(settledTx.settlementAmount).toBe(-amount - fee)
      expect(finalBalance).toBe(initialWalletBalance - amount - fee)
    }
  }

  sub.removeAllListeners()
}

const testInternalSend = async ({
  senderAccount,
  senderWalletId,
  recipientWalletId,
  senderAmount,
}: {
  senderAccount: Account
  senderWalletId: WalletId
  recipientWalletId: WalletId
  senderAmount: Satoshis | UsdCents
}) => {
  const memo = "this is my onchain usd memo #" + (Math.random() * 1_000_000).toFixed()

  const senderWallet = await WalletsRepository().findById(senderWalletId)
  if (senderWallet instanceof Error) return senderWallet
  const { currency: senderCurrency } = senderWallet

  const recipientWallet = await WalletsRepository().findById(recipientWalletId)
  if (recipientWallet instanceof Error) return recipientWallet
  const { currency: recipientCurrency } = recipientWallet

  const dealerFns = DealerPriceService()

  let amountResult: UsdCents | Satoshis | DealerPriceServiceError
  let recipientAmount: UsdCents | Satoshis
  switch (true) {
    case senderCurrency === recipientCurrency:
      recipientAmount = senderAmount
      break

    case senderCurrency === WalletCurrency.Usd &&
      recipientCurrency === WalletCurrency.Btc:
      amountResult = await dealerFns.getSatsFromCentsForImmediateSell(
        senderAmount as unknown as UsdCents,
      )
      if (amountResult instanceof Error) return amountResult

      recipientAmount = amountResult
      break

    case senderCurrency === WalletCurrency.Btc &&
      recipientCurrency === WalletCurrency.Usd:
      amountResult = await dealerFns.getCentsFromSatsForImmediateBuy(
        senderAmount as unknown as Satoshis,
      )
      if (amountResult instanceof Error) return amountResult

      recipientAmount = amountResult
      break

    default:
      return new Error("Not possible")
  }

  const initialSenderBalance = await getBalanceHelper(senderWalletId)
  const initialRecipientBalance = await getBalanceHelper(recipientWalletId)

  const address = await Wallets.createOnChainAddress(recipientWalletId)
  if (address instanceof Error) return address

  const paid = await Wallets.payOnChainByWalletId({
    senderAccount: senderAccount,
    senderWalletId: senderWalletId,
    address,
    amount: senderAmount,
    targetConfirmations,
    memo,
    sendAll: false,
  })
  if (paid instanceof Error) return paid

  // Check balances for both wallets
  // ===
  const finalSenderBalance = await getBalanceHelper(senderWalletId)
  const finalRecipient = await getBalanceHelper(recipientWalletId)

  expect(paid).toBe(PaymentSendStatus.Success)
  expect(finalSenderBalance).toBe(initialSenderBalance - senderAmount)
  expect(finalRecipient).toBe(initialRecipientBalance + recipientAmount)

  // Check txn details for sent wallet
  // ===
  const { result: txsSender, error } = await Wallets.getTransactionsForWalletId({
    walletId: senderWalletId,
  })
  if (error instanceof Error || txsSender === null) {
    return error
  }
  const pendingTxsSender = txsSender.filter(({ status }) => status === TxStatus.Pending)
  expect(pendingTxsSender.length).toBe(0)

  const settledTxsSender = txsSender.filter(
    ({ status, initiationVia, settlementVia, memo: txMemo }) =>
      status === TxStatus.Success &&
      initiationVia.type === PaymentInitiationMethod.OnChain &&
      settlementVia.type === SettlementMethod.IntraLedger &&
      txMemo === memo,
  )
  expect(settledTxsSender.length).toBe(1)
  const senderSettledTx = settledTxsSender[0] as WalletTransaction

  expect(senderSettledTx.settlementFee).toBe(0)
  expect(senderSettledTx.settlementAmount).toBe(-senderAmount)
  expect(senderSettledTx.displayCurrencyPerSettlementCurrencyUnit).toBeGreaterThan(0)

  // Check txn details for received wallet
  // ===
  const { result: txsRecipient, error: errorUserA } =
    await Wallets.getTransactionsForWalletId({
      walletId: recipientWalletId,
    })
  if (errorUserA instanceof Error || txsRecipient === null) {
    return errorUserA
  }
  const pendingTxsRecipient = txsRecipient.filter(
    ({ status }) => status === TxStatus.Pending,
  )
  expect(pendingTxsRecipient.length).toBe(0)

  const settledTxsRecipient = txsRecipient.filter(
    ({ status, initiationVia, settlementVia }) =>
      status === TxStatus.Success &&
      initiationVia.type === PaymentInitiationMethod.OnChain &&
      settlementVia.type === SettlementMethod.IntraLedger,
  )
  const recipientSettledTx = settledTxsRecipient[0] as WalletTransaction

  expect(recipientSettledTx.settlementFee).toBe(0)
  expect(recipientSettledTx.settlementAmount).toBe(recipientAmount)
  expect(recipientSettledTx.displayCurrencyPerSettlementCurrencyUnit).toBeGreaterThan(0)

  // Check memos
  // ===
  const matchTx = (tx: WalletTransaction) =>
    tx.initiationVia.type === PaymentInitiationMethod.OnChain &&
    tx.initiationVia.address === address

  // sender should know memo
  const filteredTxs = txsSender.filter(matchTx)
  expect(filteredTxs.length).toBe(1)
  expect(filteredTxs[0].memo).toBe(memo)

  // receiver should not know memo from sender
  const filteredTxsUserD = txsRecipient.filter(matchTx)
  expect(filteredTxsUserD.length).toBe(1)
  expect(filteredTxsUserD[0].memo).not.toBe(memo)
}

describe("UserWallet - onChainPay", () => {
  it("sends a successful payment", async () =>
    testExternalSend({
      senderAccount: accountA,
      senderWalletId: walletIdA,
      amount,
      sendAll: false,
    }))

  it("sends all in a successful payment", async () =>
    testExternalSend({
      senderAccount: accountE,
      senderWalletId: walletIdE,
      amount,
      sendAll: true,
    }))

  it("sends a successful payment with memo", async () => {
    const memo = "this is my onchain memo"
    const { address } = await createChainAddress({ format: "p2wpkh", lnd: lndOutside1 })
    const paymentResult = await Wallets.payOnChainByWalletId({
      senderAccount: accountA,
      senderWalletId: walletIdA,
      address,
      amount,
      targetConfirmations,
      memo,
      sendAll: false,
    })
    expect(paymentResult).toBe(PaymentSendStatus.Success)
    const { result: txs, error } = await Wallets.getTransactionsForWalletId({
      walletId: walletIdA,
    })
    if (error instanceof Error || txs === null) {
      throw error
    }
    if (txs.length === 0) {
      throw Error("No transactions found")
    }
    const firstTxs = txs[0]
    expect(firstTxs.memo).toBe(memo)
    const pendingTxHash = firstTxs.id

    const sub = subscribeToTransactions({ lnd: lndonchain })
    sub.on("chain_transaction", onchainTransactionEventHandler)

    const results = await Promise.all([
      once(sub, "chain_transaction"),
      mineBlockAndSync({ lnds: [lndonchain] }),
    ])

    await sleep(1000)
    await onchainTransactionEventHandler(results[0][0])

    {
      const txResult = await Wallets.getTransactionsForWalletId({
        walletId: walletIdA,
      })
      if (txResult.error instanceof Error || txResult.result === null) {
        throw txResult.error
      }
      const pendingTxs = txResult.result.filter(
        ({ status }) => status === TxStatus.Pending,
      )
      expect(pendingTxs.length).toBe(0)

      const settledTxs = txResult.result.filter(
        ({ status, initiationVia, id }) =>
          status === TxStatus.Success &&
          initiationVia.type === PaymentInitiationMethod.OnChain &&
          id === pendingTxHash,
      )
      expect(settledTxs.length).toBe(1)
      const settledTx = settledTxs[0] as WalletTransaction

      expect(settledTx.memo).toBe(memo)
    }

    // Delay as workaround for occasional core-dump error
    await new Promise((resolve) => setImmediate(resolve))
    sub.removeAllListeners()
  })

  it("sends an on us transaction", async () => {
    const res = await testInternalSend({
      senderAccount: accountA,
      senderWalletId: walletIdA,
      recipientWalletId: walletIdD,
      senderAmount: amount,
    })
    if (res instanceof Error) throw res
  })

  it("sends an on us transaction below dust limit", async () => {
    const res = await testInternalSend({
      senderAccount: accountA,
      senderWalletId: walletIdA,
      recipientWalletId: walletIdD,
      senderAmount: toSats(amountBelowDustThreshold),
    })
    if (res instanceof Error) throw res
  })

  it("sends all with an on us transaction", async () => {
    const initialBalanceUserF = await getBalanceHelper(walletIdF)

    const address = await Wallets.createOnChainAddress(walletIdD)
    if (address instanceof Error) throw address

    const initialBalanceUserD = await getBalanceHelper(walletIdD)
    const senderAccount = await getAccountByTestUserRef("F")

    const paid = await Wallets.payOnChainByWalletId({
      senderAccount,
      senderWalletId: walletIdF,
      address,
      amount: 0,
      targetConfirmations,
      memo: null,
      sendAll: true,
    })

    const finalBalanceUserF = await getBalanceHelper(walletIdF)
    const finalBalanceUserD = await getBalanceHelper(walletIdD)

    expect(paid).toBe(PaymentSendStatus.Success)
    expect(finalBalanceUserF).toBe(0)
    expect(finalBalanceUserD).toBe(initialBalanceUserD + initialBalanceUserF)

    {
      const txResult = await Wallets.getTransactionsForWalletId({
        walletId: walletIdF,
      })
      if (txResult.error instanceof Error || txResult.result === null) {
        throw txResult.error
      }
      const pendingTxs = txResult.result.filter(
        ({ status }) => status === TxStatus.Pending,
      )
      expect(pendingTxs.length).toBe(0)

      const settledTxs = txResult.result.filter(
        ({ status, initiationVia, settlementVia }) =>
          status === TxStatus.Success &&
          initiationVia.type === PaymentInitiationMethod.OnChain &&
          settlementVia.type === SettlementMethod.IntraLedger,
      )
      expect(settledTxs.length).toBe(1)
      const settledTx = settledTxs[0] as WalletTransaction

      expect(settledTx.settlementFee).toBe(0)
      expect(settledTx.settlementAmount).toBe(-initialBalanceUserF)
      expect(settledTx.displayCurrencyPerSettlementCurrencyUnit).toBeGreaterThan(0)

      const finalBalance = await getBalanceHelper(walletIdF)
      expect(finalBalance).toBe(0)
    }
  })

  const lndVoidErrors = [
    { name: "insufficient funds", error: InsufficientOnChainFundsError },
    { name: "CPFP limit", error: CPFPAncestorLimitReachedError },
  ]
  test.each(lndVoidErrors)(
    "void transaction if lnd service returns $name error",
    async ({ error }) => {
      const onChainService = OnChainServiceImpl.OnChainService(TxDecoder(BTC_NETWORK))

      jest.spyOn(OnChainServiceImpl, "OnChainService").mockImplementationOnce(() => ({
        ...onChainService,
        payToAddress: () => Promise.resolve(new error()),
      }))

      const initialBalanceUserA = await getBalanceHelper(walletIdA)
      const { address } = await createChainAddress({ format: "p2wpkh", lnd: lndOutside1 })

      const result = await Wallets.payOnChainByWalletId({
        senderAccount: accountA,
        senderWalletId: walletIdA,
        address,
        amount,
        targetConfirmations,
        memo: null,
        sendAll: false,
      })

      expect(result).toBeInstanceOf(error)

      const finalBalanceUserA = await getBalanceHelper(walletIdA)
      expect(finalBalanceUserA).toBe(initialBalanceUserA)

      const txResult = await Wallets.getTransactionsForWalletId({
        walletId: walletIdA,
      })
      if (txResult.error instanceof Error || txResult.result === null) {
        throw txResult.error
      }
      const pendingTxs = txResult.result.filter(
        ({ status }) => status === TxStatus.Pending,
      )
      expect(pendingTxs.length).toBe(0)
    },
  )

  const lndKeepPendingErrors = [
    { name: "service unavailable", error: OnChainServiceUnavailableError },
    { name: "unknown", error: UnknownOnChainServiceError },
  ]
  test.each(lndKeepPendingErrors)(
    "keep pending transaction if lnd service returns $name error",
    async ({ error }) => {
      const onChainService = OnChainServiceImpl.OnChainService(TxDecoder(BTC_NETWORK))
      if (onChainService instanceof Error) throw onChainService

      jest.spyOn(OnChainServiceImpl, "OnChainService").mockImplementationOnce(() => ({
        ...onChainService,
        payToAddress: () => Promise.resolve(new error()),
      }))

      const initialBalanceUserA = await getBalanceHelper(walletIdA)
      const { address } = await createChainAddress({ format: "p2wpkh", lnd: lndOutside1 })

      const result = await Wallets.payOnChainByWalletId({
        senderAccount: accountA,
        senderWalletId: walletIdA,
        address,
        amount,
        targetConfirmations,
        memo: null,
        sendAll: false,
      })

      expect(result).toBeInstanceOf(error)

      const txResult = await Wallets.getTransactionsForWalletId({
        walletId: walletIdA,
      })
      if (txResult.error instanceof Error || txResult.result === null) {
        throw txResult.error
      }
      const pendingTxs = txResult.result.filter(
        ({ status }) => status === TxStatus.Pending,
      )
      expect(pendingTxs.length).toBe(1)

      const pendingTx = pendingTxs[0] as WalletOnChainSettledTransaction
      const finalBalanceUserA = await getBalanceHelper(walletIdA)
      expect(finalBalanceUserA).toBe(
        initialBalanceUserA - amount - pendingTx.settlementFee,
      )

      // clean pending tx to avoid collisions with other tests
      await onChainService.payToAddress({
        address: address as OnChainAddress,
        amount,
        targetConfirmations,
      })
      await mineBlockAndSyncAll()
      await LedgerService().settlePendingOnChainPayment(
        pendingTx.settlementVia.transactionHash,
      )
    },
  )

  it("fails if try to send a transaction to self", async () => {
    const res = await testInternalSend({
      senderAccount: accountA,
      senderWalletId: walletIdA,
      recipientWalletId: walletIdA,
      senderAmount: amount,
    })
    expect(res).toBeInstanceOf(SelfPaymentError)
  })

  it("fails if an on us payment has insufficient balance", async () => {
    const res = await testInternalSend({
      senderAccount: accountE,
      senderWalletId: walletIdE,
      recipientWalletId: walletIdD,
      senderAmount: amount,
    })
    expect(res).toBeInstanceOf(InsufficientBalanceError)
  })

  it("fails if has insufficient balance", async () => {
    const { address } = await createChainAddress({
      lnd: lndOutside1,
      format: "p2wpkh",
    })
    const initialBalanceUserG = await getBalanceHelper(walletIdG)

    const status = await Wallets.payOnChainByWalletId({
      senderAccount: accountG,
      senderWalletId: walletIdG,
      address,
      amount: initialBalanceUserG,
      targetConfirmations,
      memo: null,
      sendAll: false,
    })
    //should fail because user does not have balance to pay for on-chain fee
    expect(status).toBeInstanceOf(InsufficientBalanceError)
  })

  it("fails if onchain service has insufficient balance", async () => {
    const { address } = await createChainAddress({
      lnd: lndOutside1,
      format: "p2wpkh",
    })
    const initialBalanceUserG = await getBalanceHelper(walletIdG)

    const onChainService = OnChainServiceImpl.OnChainService(TxDecoder(BTC_NETWORK))
    if (onChainService instanceof Error) throw onChainService
    jest.spyOn(OnChainServiceImpl, "OnChainService").mockImplementationOnce(() => ({
      ...onChainService,
      getBalanceAmount: () =>
        Promise.resolve(
          paymentAmountFromNumber({
            amount: initialBalanceUserG,
            currency: WalletCurrency.Btc,
          }),
        ),
    }))

    const status = await Wallets.payOnChainByWalletId({
      senderAccount: accountG,
      senderWalletId: walletIdG,
      address,
      amount: initialBalanceUserG,
      targetConfirmations,
      memo: null,
      sendAll: false,
    })

    //should fail because onchain does not have balance to pay for on-chain fee
    expect(status).toBeInstanceOf(RebalanceNeededError)
  })

  it("fails if has negative amount", async () => {
    const amount = -1000
    const { address } = await createChainAddress({ format: "p2wpkh", lnd: lndOutside1 })

    const status = await Wallets.payOnChainByWalletId({
      senderAccount: accountA,
      senderWalletId: walletIdA,
      address,
      amount,
      targetConfirmations,
      memo: null,
      sendAll: false,
    })
    expect(status).toBeInstanceOf(InvalidCurrencyBaseAmountError)
  })

  it("fails if withdrawal limit hit", async () => {
    const { address } = await createChainAddress({
      lnd: lndOutside1,
      format: "p2wpkh",
    })

    const ledgerService = LedgerService()
    const timestamp1DayAgo = timestampDaysAgo(ONE_DAY)
    if (timestamp1DayAgo instanceof Error) return timestamp1DayAgo

    const walletVolume = await ledgerService.externalPaymentVolumeSince({
      walletId: walletIdA,
      timestamp: timestamp1DayAgo,
    })
    if (walletVolume instanceof Error) return walletVolume

    const { outgoingBaseAmount } = walletVolume

    if (!accountRecordA.level) throw new Error("Invalid or non existent user level")

    const withdrawalLimit = getAccountLimits({ level: accountA.level }).withdrawalLimit

    const price = await getCurrentPrice()
    if (price instanceof Error) throw price
    const dCConverter = DisplayCurrencyConverter(price)

    const subResult = sub(
      dCConverter.fromCentsToSats(withdrawalLimit),
      outgoingBaseAmount,
    )
    if (subResult instanceof Error) throw subResult

    const amount = add(subResult, toSats(100))

    const status = await Wallets.payOnChainByWalletId({
      senderAccount: accountA,
      senderWalletId: walletIdA,
      address,
      amount,
      targetConfirmations,
      memo: null,
      sendAll: false,
    })

    expect(status).toBeInstanceOf(LimitsExceededError)
  })

  it("fee probe fails if the amount is less than on chain dust amount", async () => {
    const address = (await bitcoindOutside.getNewAddress()) as OnChainAddress

    const status = await Wallets.getOnChainFee({
      account: accountA,
      walletId: walletIdA,
      address,
      amount: amountBelowDustThreshold,
      targetConfirmations,
    })
    expect(status).toBeInstanceOf(LessThanDustThresholdError)
  })

  it("fee probe fails if the amount is less than lnd on-chain dust amount", async () => {
    const address = (await bitcoindOutside.getNewAddress()) as OnChainAddress

    const status = await Wallets.getOnChainFee({
      account: accountA,
      walletId: walletIdA,
      address,
      amount: 1,
      targetConfirmations,
    })
    expect(status).toBeInstanceOf(LessThanDustThresholdError)
  })

  it("fails if the amount is less than on chain dust amount", async () => {
    const address = await bitcoindOutside.getNewAddress()

    const status = await Wallets.payOnChainByWalletId({
      senderAccount: accountA,
      senderWalletId: walletIdA,
      address,
      amount: amountBelowDustThreshold,
      targetConfirmations,
      memo: null,
      sendAll: false,
    })
    expect(status).toBeInstanceOf(LessThanDustThresholdError)
  })

  it("fails if the amount is less than lnd on-chain dust amount", async () => {
    const address = await bitcoindOutside.getNewAddress()

    const status = await Wallets.payOnChainByWalletId({
      senderAccount: accountA,
      senderWalletId: walletIdA,
      address,
      amount: 1,
      targetConfirmations,
      memo: null,
      sendAll: false,
    })
    expect(status).toBeInstanceOf(LessThanDustThresholdError)
  })
})

describe("UsdWallet - onChainPay", () => {
  describe("to an internal address", () => {
    it("sends from usd wallet to usd wallet", async () => {
      const res = await testInternalSend({
        senderAccount: accountB,
        senderWalletId: walletIdUsdB,
        recipientWalletId: walletIdUsdA,
        senderAmount: usdAmount,
      })
      if (res instanceof Error) throw res
    })

    it("sends from usd wallet to btc wallet", async () => {
      const res = await testInternalSend({
        senderAccount: accountB,
        senderWalletId: walletIdUsdB,
        recipientWalletId: walletIdA,
        senderAmount: usdAmount,
      })
      if (res instanceof Error) throw res
    })

    it("sends from btc wallet to usd wallet", async () => {
      const res = await testInternalSend({
        senderAccount: accountA,
        senderWalletId: walletIdA,
        recipientWalletId: walletIdUsdB,
        senderAmount: amount,
      })
      if (res instanceof Error) throw res
    })

    it("fails to send with less-than-1-cent amount from btc wallet to usd wallet", async () => {
      const dealerFns = DealerPriceService()

      const btcSendAmount = toSats(10)
      const btcSendAmountInUsd = await dealerFns.getCentsFromSatsForImmediateBuy(
        toSats(btcSendAmount),
      )
      expect(btcSendAmountInUsd).toBe(0)

      const res = await testInternalSend({
        senderAccount: accountA,
        senderWalletId: walletIdA,
        recipientWalletId: walletIdUsdB,
        senderAmount: btcSendAmount,
      })
      expect(res).toBeInstanceOf(InvalidZeroAmountPriceRatioInputError)
    })
  })

  describe("to an external address", () => {
    it("send from usd wallet", async () =>
      testExternalSend({
        senderAccount: accountB,
        senderWalletId: walletIdUsdB,
        amount: usdAmount,
        sendAll: false,
      }))

    it("send all from usd wallet", async () =>
      testExternalSend({
        senderAccount: accountB,
        senderWalletId: walletIdUsdB,
        amount: usdAmount,
        sendAll: true,
      }))
  })
})
