import { once } from "events"

import { Prices, Wallets } from "@app"
import {
  getFeesConfig,
  getOnChainAddressCreateAttemptLimits,
  getAccountLimits,
  getLocale,
  getDisplayCurrencyConfig,
} from "@config"
import { sat2btc, toSats } from "@domain/bitcoin"
import { NotificationType } from "@domain/notifications"
import { OnChainAddressCreateRateLimiterExceededError } from "@domain/rate-limit/errors"
import { TxStatus } from "@domain/wallets"
import { onchainTransactionEventHandler } from "@servers/trigger"
import { getFunderWalletId } from "@services/ledger/caching"
import { baseLogger } from "@services/logger"
import { createPushNotificationContent } from "@services/notifications/create-push-notification-content"
import * as PushNotificationsServiceImpl from "@services/notifications/push-notifications"
import { ModifiedSet, sleep } from "@utils"
import { WalletsRepository } from "@services/mongoose"

import { DisplayCurrencyConverter } from "@domain/fiat/display-currency"

import { getCurrentPrice } from "@app/prices"

import { WalletCurrency } from "@domain/shared"

import {
  amountAfterFeeDeduction,
  bitcoindClient,
  bitcoindOutside,
  checkIsBalanced,
  createMandatoryUsers,
  createUserAndWalletFromUserRef,
  getAccountIdByTestUserRef,
  getDefaultWalletIdByRole,
  getDefaultWalletIdByTestUserRef,
  getUserRecordByTestUserRef,
  lndonchain,
  RANDOM_ADDRESS,
  sendToAddress,
  sendToAddressAndConfirm,
  confirmSent,
  subscribeToChainAddress,
  subscribeToTransactions,
  waitUntilBlockHeight,
} from "test/helpers"
import { resetOnChainAddressAccountIdLimits } from "test/helpers/rate-limit"
import { getBalanceHelper } from "test/helpers/wallet"

jest.mock("@app/prices/get-current-price", () => require("test/mocks/get-current-price"))

let walletIdA: WalletId
let accountIdA: AccountId

const accountLimits = getAccountLimits({ level: 1 })

const locale = getLocale()
const { code: DefaultDisplayCurrency } = getDisplayCurrencyConfig()

beforeAll(async () => {
  await createMandatoryUsers()

  await bitcoindClient.loadWallet({ filename: "outside" })

  walletIdA = await getDefaultWalletIdByTestUserRef("A")
  accountIdA = await getAccountIdByTestUserRef("A")

  await createUserAndWalletFromUserRef("C")
})

beforeEach(() => {
  jest.resetAllMocks()

  // the randomness aim to ensure that we don't pass the test with 2 false negative
  // that could turn the result in a false positive
  // we could get rid of the random with a different amountSats for each test
})

afterEach(async () => {
  await checkIsBalanced()
})

afterAll(async () => {
  jest.restoreAllMocks()
  await bitcoindClient.unloadWallet({ walletName: "outside" })
})

describe("FunderWallet - On chain", () => {
  it("receives on-chain transaction", async () => {
    const funderWalletId = await getFunderWalletId()
    await sendToWalletTestWrapper({
      walletId: funderWalletId,
      amountSats: getRandomAmountOfSats(),
    })
  })
})

describe("UserWallet - On chain", () => {
  it("get last on chain address", async () => {
    const address = await Wallets.createOnChainAddress(walletIdA)
    const lastAddress = await Wallets.getLastOnChainAddress(walletIdA)

    expect(address).not.toBeInstanceOf(Error)
    expect(lastAddress).not.toBeInstanceOf(Error)
    expect(lastAddress).toBe(address)
  })

  it("fails to create onChain Address past rate limit", async () => {
    // Reset limits before starting
    let resetOk = await resetOnChainAddressAccountIdLimits(accountIdA)
    expect(resetOk).not.toBeInstanceOf(Error)
    if (resetOk instanceof Error) throw resetOk

    // Create max number of addresses
    const limitsNum = getOnChainAddressCreateAttemptLimits().points
    const promises: Promise<OnChainAddress | ApplicationError>[] = []
    for (let i = 0; i < limitsNum; i++) {
      const onChainAddressPromise = Wallets.createOnChainAddress(walletIdA)
      promises.push(onChainAddressPromise)
    }
    const onChainAddresses = await Promise.all(promises)
    const isNotError = (item) => !(item instanceof Error)
    expect(onChainAddresses.every(isNotError)).toBe(true)

    // Test that first address past the limit fails
    const onChainAddress = await Wallets.createOnChainAddress(walletIdA)
    expect(onChainAddress).toBeInstanceOf(OnChainAddressCreateRateLimiterExceededError)

    // Reset limits when done for other tests
    resetOk = await resetOnChainAddressAccountIdLimits(accountIdA)
    expect(resetOk).not.toBeInstanceOf(Error)
  })

  it("receives on-chain transaction", async () => {
    await sendToWalletTestWrapper({
      walletId: walletIdA,
      amountSats: getRandomAmountOfSats(),
    })
  })

  it("retrieves on-chain transactions by address", async () => {
    const address1 = await Wallets.createOnChainAddress(walletIdA)
    if (address1 instanceof Error) throw address1
    expect(address1.substr(0, 4)).toBe("bcrt")
    await testTxnsByAddressWrapper({
      walletId: walletIdA,
      addresses: [address1],
      amountSats: getRandomAmountOfSats(),
    })

    const address2 = await Wallets.createOnChainAddress(walletIdA)
    if (address2 instanceof Error) throw address2
    expect(address2.substr(0, 4)).toBe("bcrt")
    await testTxnsByAddressWrapper({
      walletId: walletIdA,
      addresses: [address2],
      amountSats: getRandomAmountOfSats(),
    })

    await testTxnsByAddressWrapper({
      walletId: walletIdA,
      addresses: [address1, address2],
      amountSats: getRandomAmountOfSats(),
    })
  })

  it("receives on-chain transaction with max limit for withdrawal level1", async () => {
    /// TODO? add sendAll tests in which the user has more than the limit?
    const withdrawalLimitAccountLevel1 = accountLimits.withdrawalLimit // cents
    await createUserAndWalletFromUserRef("E")
    const walletIdE = await getDefaultWalletIdByTestUserRef("E")
    await createUserAndWalletFromUserRef("G")
    const walletIdG = await getDefaultWalletIdByTestUserRef("G")

    const price = await getCurrentPrice()
    if (price instanceof Error) throw price
    const dCConverter = DisplayCurrencyConverter(price)
    const amountSats = dCConverter.fromCentsToSats(withdrawalLimitAccountLevel1)

    await sendToWalletTestWrapper({ walletId: walletIdE, amountSats })
    await sendToWalletTestWrapper({ walletId: walletIdG, amountSats })
  })

  it("receives on-chain transaction with max limit for onUs level1", async () => {
    const intraLedgerLimitAccountLevel1 = accountLimits.intraLedgerLimit // cents

    await createUserAndWalletFromUserRef("F")
    const walletId = await getDefaultWalletIdByTestUserRef("F")

    const price = await getCurrentPrice()
    if (price instanceof Error) throw price
    const dCConverter = DisplayCurrencyConverter(price)
    const amountSats = dCConverter.fromCentsToSats(intraLedgerLimitAccountLevel1)

    await sendToWalletTestWrapper({ walletId, amountSats })
  })

  it("receives batch on-chain transaction", async () => {
    const address0 = await Wallets.createOnChainAddress(walletIdA)
    if (address0 instanceof Error) throw address0

    const walletId = await getDefaultWalletIdByRole("funder")

    const addressDealer = await Wallets.createOnChainAddress(walletId)
    if (addressDealer instanceof Error) throw addressDealer

    const initialBalanceUserA = await getBalanceHelper(walletIdA)
    const initBalanceDealer = await getBalanceHelper(walletId)

    const output0 = {}
    output0[address0] = 1

    const output1 = {}
    output1[addressDealer] = 2

    const outputs = [output0, output1]

    const { psbt } = await bitcoindOutside.walletCreateFundedPsbt({ inputs: [], outputs })
    // const decodedPsbt1 = await bitcoindOutside.decodePsbt(psbt)
    // const analysePsbt1 = await bitcoindOutside.analyzePsbt(psbt)
    const walletProcessPsbt = await bitcoindOutside.walletProcessPsbt({ psbt })
    // const decodedPsbt2 = await bitcoindOutside.decodePsbt(walletProcessPsbt.psbt)
    // const analysePsbt2 = await bitcoindOutside.analyzePsbt(walletProcessPsbt.psbt)
    const finalizedPsbt = await bitcoindOutside.finalizePsbt({
      psbt: walletProcessPsbt.psbt,
    })

    await bitcoindOutside.sendRawTransaction({ hexstring: finalizedPsbt.hex })
    await bitcoindOutside.generateToAddress({ nblocks: 6, address: RANDOM_ADDRESS })
    await waitUntilBlockHeight({ lnd: lndonchain })

    // this is done by trigger and/or cron in prod
    const result = await Wallets.updateOnChainReceipt({ logger: baseLogger })
    if (result instanceof Error) {
      throw result
    }

    {
      const balanceA = await getBalanceHelper(walletIdA)
      const balance4 = await getBalanceHelper(walletId)

      const depositFeeRatio = getFeesConfig().depositFeeVariable as DepositFeeRatio

      expect(balanceA).toBe(
        initialBalanceUserA +
          amountAfterFeeDeduction({
            amount: toSats(100_000_000),
            depositFeeRatio,
          }),
      )
      expect(balance4).toBe(
        initBalanceDealer +
          amountAfterFeeDeduction({
            amount: toSats(200_000_000),
            depositFeeRatio,
          }),
      )
    }
  })

  it("identifies unconfirmed incoming on-chain transactions", async () => {
    const sendNotification = jest.fn()
    jest
      .spyOn(PushNotificationsServiceImpl, "PushNotificationsService")
      .mockImplementationOnce(() => ({
        sendNotification,
      }))

    const amountSats = getRandomAmountOfSats()

    const address = await Wallets.createOnChainAddress(walletIdA)
    if (address instanceof Error) throw address

    const sub = subscribeToTransactions({ lnd: lndonchain })
    sub.on("chain_transaction", onchainTransactionEventHandler)

    await Promise.all([
      once(sub, "chain_transaction"),
      bitcoindOutside.sendToAddress({
        address,
        amount: sat2btc(amountSats),
      }),
    ])

    await sleep(1000)

    const { result: txs, error } = await Wallets.getTransactionsForWalletId({
      walletId: walletIdA,
    })
    if (error instanceof Error || txs === null) {
      throw error
    }
    const pendingTxs = txs.filter(({ status }) => status === TxStatus.Pending)
    expect(pendingTxs.length).toBe(1)

    const pendingTx = pendingTxs[0] as WalletOnChainTransaction
    expect(pendingTx.settlementVia.type).toBe("onchain")
    expect(pendingTx.settlementAmount).toBe(amountSats)
    expect(pendingTx.initiationVia.address).toBe(address)

    await sleep(1000)

    const satsPrice = await Prices.getCurrentPrice()
    if (satsPrice instanceof Error) throw satsPrice

    const paymentAmount = { amount: BigInt(amountSats), currency: WalletCurrency.Btc }
    const displayPaymentAmount = {
      amount: amountSats * satsPrice,
      currency: DefaultDisplayCurrency,
    }

    const pendingNotification = createPushNotificationContent({
      type: NotificationType.OnchainReceiptPending,
      userLanguage: locale as UserLanguage,
      amount: paymentAmount,
      displayAmount: displayPaymentAmount,
    })

    expect(sendNotification.mock.calls.length).toBe(1)
    expect(sendNotification.mock.calls[0][0].title).toBe(pendingNotification.title)
    expect(sendNotification.mock.calls[0][0].body).toBe(pendingNotification.body)

    await Promise.all([
      once(sub, "chain_transaction"),
      bitcoindOutside.generateToAddress({ nblocks: 3, address: RANDOM_ADDRESS }),
    ])

    await sleep(3000)
    sub.removeAllListeners()
  })

  it("allows fee exemption for specific users", async () => {
    const amountSats = getRandomAmountOfSats()

    const userRecordC = await getUserRecordByTestUserRef("C")
    userRecordC.depositFeeRatio = 0
    await userRecordC.save()
    const walletC = await getDefaultWalletIdByTestUserRef("C")

    const initBalanceUserC = await getBalanceHelper(walletC)
    await sendToWalletTestWrapper({
      walletId: walletC,
      depositFeeRatio: 0 as DepositFeeRatio,
      amountSats,
    })
    const finalBalanceUserC = await getBalanceHelper(walletC)
    expect(finalBalanceUserC).toBe(initBalanceUserC + amountSats)
  })
})

async function sendToWalletTestWrapper({
  amountSats,
  walletId,
  depositFeeRatio = getFeesConfig().depositFeeVariable as DepositFeeRatio,
}: {
  amountSats: Satoshis
  walletId: WalletId
  depositFeeRatio?: DepositFeeRatio
}) {
  const lnd = lndonchain

  const initialBalance = await getBalanceHelper(walletId)
  const { result: initTransactions, error } = await Wallets.getTransactionsForWalletId({
    walletId,
  })
  if (error instanceof Error || initTransactions === null) {
    throw error
  }

  const address = await Wallets.createOnChainAddress(walletId)
  if (address instanceof Error) throw address

  expect(address.substr(0, 4)).toBe("bcrt")

  const checkBalance = async (minBlockToWatch = 1) => {
    const sub = subscribeToChainAddress({
      lnd,
      bech32_address: address,
      min_height: minBlockToWatch,
    })
    await once(sub, "confirmation")
    sub.removeAllListeners()

    await waitUntilBlockHeight({ lnd })
    // this is done by trigger and/or cron in prod
    const result = await Wallets.updateOnChainReceipt({ logger: baseLogger })
    if (result instanceof Error) {
      throw result
    }

    const balance = await getBalanceHelper(walletId)
    expect(balance).toBe(
      initialBalance +
        amountAfterFeeDeduction({
          amount: amountSats,
          depositFeeRatio,
        }),
    )

    const { result: transactions, error } = await Wallets.getTransactionsForWalletId({
      walletId,
    })
    if (error instanceof Error || transactions === null) {
      throw error
    }

    expect(transactions.length).toBe(initTransactions.length + 1)

    const txn = transactions[0] as WalletOnChainTransaction
    expect(txn.settlementVia.type).toBe("onchain")
    expect(txn.settlementFee).toBe(Math.round(txn.settlementFee))
    expect(txn.settlementAmount).toBe(
      amountAfterFeeDeduction({
        amount: amountSats,
        depositFeeRatio: depositFeeRatio,
      }),
    )
    expect(txn.initiationVia.address).toBe(address)
  }

  // just to improve performance
  const blockNumber = await bitcoindClient.getBlockCount()
  await sendToAddressAndConfirm({
    walletClient: bitcoindOutside,
    address,
    amount: sat2btc(amountSats),
  })
  await checkBalance(blockNumber)
}

async function testTxnsByAddressWrapper({
  amountSats,
  walletId,
  addresses,
  depositFeeRatio = getFeesConfig().depositFeeVariable as DepositFeeRatio,
}: {
  amountSats: Satoshis
  walletId: WalletId
  addresses: OnChainAddress[]
  depositFeeRatio?: DepositFeeRatio
}) {
  const lnd = lndonchain

  const currentBalance = await getBalanceHelper(walletId)
  const { result: initTransactions, error } = await Wallets.getTransactionsForWalletId({
    walletId,
  })
  if (error instanceof Error || initTransactions === null) {
    throw error
  }

  const checkBalance = async (addresses, minBlockToWatch = 1) => {
    for (const address of addresses) {
      const sub = subscribeToChainAddress({
        lnd,
        bech32_address: address,
        min_height: minBlockToWatch,
      })
      await once(sub, "confirmation")
      sub.removeAllListeners()
    }

    await waitUntilBlockHeight({ lnd })
    // this is done by trigger and/or cron in prod
    const result = await Wallets.updateOnChainReceipt({ logger: baseLogger })
    if (result instanceof Error) {
      throw result
    }

    const balance = await getBalanceHelper(walletId)
    expect(balance).toBe(
      currentBalance +
        amountAfterFeeDeduction({
          amount: amountSats,
          depositFeeRatio,
        }) *
          addresses.length,
    )

    const { result: transactions, error } = await Wallets.getTransactionsForWalletId({
      walletId,
    })
    if (error instanceof Error || transactions === null) {
      throw error
    }

    expect(transactions.length).toBe(initTransactions.length + addresses.length)

    const txn = transactions[0] as WalletOnChainTransaction
    expect(txn.settlementVia.type).toBe("onchain")
    expect(txn.settlementFee).toBe(Math.round(txn.settlementFee))
    expect(txn.settlementAmount).toBe(
      amountAfterFeeDeduction({
        amount: amountSats,
        depositFeeRatio: depositFeeRatio,
      }),
    )
    expect(addresses.includes(txn.initiationVia.address)).toBeTruthy()
  }

  const wallet = await WalletsRepository().findById(walletId)
  if (wallet instanceof Error) return wallet

  // just to improve performance
  const blockNumber = await bitcoindClient.getBlockCount()
  for (const address of addresses) {
    await sendToAddress({
      walletClient: bitcoindOutside,
      address,
      amount: sat2btc(amountSats),
    })
  }

  // Fetch txns with pending
  const txnsWithPendingResult = await Wallets.getTransactionsForWalletsByAddresses({
    wallets: [wallet],
    addresses: addresses,
  })
  const txnsWithPending = txnsWithPendingResult.result
  expect(txnsWithPending).not.toBeNull()
  if (txnsWithPending === null) throw new Error()
  const pendingTxn = txnsWithPending[0]
  expect(pendingTxn.initiationVia.type).toEqual("onchain")
  if (
    pendingTxn.initiationVia.type !== "onchain" ||
    pendingTxn.settlementVia.type !== "onchain"
  ) {
    throw new Error()
  }

  // Test pending txn
  expect(pendingTxn.status).toEqual(TxStatus.Pending)
  expect(pendingTxn.initiationVia.address).not.toBeUndefined()
  if (!pendingTxn.initiationVia.address) throw new Error()
  expect(addresses.includes(pendingTxn.initiationVia.address)).toBeTruthy()

  // Test all txns
  const txnAddressesWithPendingSet = new ModifiedSet(
    txnsWithPending.map((txn) => {
      if (txn.initiationVia.type !== "onchain" || !txn.initiationVia.address) {
        return new Error()
      }
      return txn.initiationVia.address
    }),
  )
  expect(txnAddressesWithPendingSet.size).toEqual(addresses.length)
  const commonAddressPendingSet = txnAddressesWithPendingSet.intersect(new Set(addresses))
  expect(commonAddressPendingSet.size).toEqual(addresses.length)

  // Confirm pending onchain transactions
  await confirmSent({
    walletClient: bitcoindOutside,
  })
  await checkBalance(addresses, blockNumber)

  // Fetch txns with confirmed
  const txnsWithConfirmedResult = await Wallets.getTransactionsForWalletsByAddresses({
    wallets: [wallet],
    addresses,
  })
  const txnsWithConfirmed = txnsWithConfirmedResult.result
  expect(txnsWithConfirmed).not.toBeNull()
  if (txnsWithConfirmed === null) throw new Error()

  // Test confirmed txn
  const confirmedTxn = txnsWithConfirmed.find(
    (txn) =>
      (txn.settlementVia as SettlementViaOnChain).transactionHash ===
      (pendingTxn.settlementVia as SettlementViaOnChain).transactionHash,
  )
  expect(confirmedTxn).not.toBeUndefined()
  if (confirmedTxn === undefined) throw new Error()
  expect(confirmedTxn.status).toEqual(TxStatus.Success)

  // Test all txns
  const txnAddressesWithConfirmedSet = new ModifiedSet(
    txnsWithConfirmed.map((txn) => {
      if (txn.initiationVia.type !== "onchain" || !txn.initiationVia.address) {
        return new Error()
      }
      return txn.initiationVia.address
    }),
  )
  expect(txnAddressesWithConfirmedSet.size).toEqual(addresses.length)
  const commonAddressSet = txnAddressesWithConfirmedSet.intersect(new Set(addresses))
  expect(commonAddressSet.size).toEqual(addresses.length)
}

const getRandomAmountOfSats = () =>
  toSats(+100_000_000 + Math.floor(Math.random() * 10 ** 6))
