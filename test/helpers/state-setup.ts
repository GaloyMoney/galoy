import { yamlConfig } from "@config"
import { setupMongoConnection } from "@services/mongodb"

import { getFunderWalletId } from "@services/ledger/caching"
import { adminUsers } from "@domain/admin-users"

import { baseLogger } from "@services/logger"

import { sleep } from "@utils"

import {
  fundLnd,
  getChainBalance,
  mineBlockAndSyncAll,
  waitUntilSyncAll,
} from "./lightning"

import { clearAccountLocks, clearLimiters } from "./redis"

import {
  bitcoindClient,
  createUserAndWallet,
  fundWalletIdFromOnchain,
  lnd1,
  lnd2,
  lndOutside1,
  lndOutside2,
  mineAndConfirm,
  bitcoindOutside,
  resetDatabase,
  resetLnds,
  openChannelTesting,
  checkIsBalanced,
} from "test/helpers"

export type TestingStateConfig = {
  resetState: boolean
  userAccounts: {
    phone: PhoneNumber
    phoneMetadataCarrierType?: string
    username?: string
    role?: string
    title?: string
  }[]
  outsideWalletBlocksToMineAndConfirm: number
  fundFunderWallet?: {
    amountInBitcoin: number
    receivingNode: AuthenticatedLnd
  }
  lndFunding: AuthenticatedLnd[]
  channelOpens: {
    lnd: AuthenticatedLnd
    lndPartner: AuthenticatedLnd
    socket: string
    is_private?: boolean
  }[]
}

const testAccounts = yamlConfig.test_accounts.map((account) => ({
  ...account,
  phone: account.phone as PhoneNumber,
}))

export const defaultStateConfig = (): TestingStateConfig => ({
  resetState: true,
  userAccounts: [...testAccounts, ...adminUsers],
  outsideWalletBlocksToMineAndConfirm: 10,
  fundFunderWallet: {
    amountInBitcoin: 1,
    receivingNode: lnd1,
  },
  lndFunding: [lndOutside1, lndOutside2],
  channelOpens: [
    {
      lnd: lnd1,
      lndPartner: lnd2,
      socket: `lnd2:9735`,
    },
    {
      lnd: lnd1,
      lndPartner: lndOutside1,
      socket: `lnd-outside-1:9735`,
    },
    {
      lnd: lndOutside1,
      lndPartner: lnd1,
      socket: `lnd1:9735`,
    },
    {
      lnd: lnd1,
      lndPartner: lndOutside2,
      socket: `lnd-outside-2:9735`,
    },
    {
      lnd: lndOutside1,
      lndPartner: lndOutside2,
      socket: `lnd-outside-2:9735`,
      is_private: true,
    },
  ],
})

export const initializeTestingState = async (stateConfig: TestingStateConfig) => {
  const mongoose = await setupMongoConnection(true)

  // Ensure outside wallet exists
  const existingWallets = await bitcoindClient.listWalletDir()
  const loadedWallets = await bitcoindClient.listWallets()
  if (!existingWallets.map((wallet) => wallet.name).includes("outside")) {
    await bitcoindClient.createWallet({
      walletName: "outside",
    })
  } else if (!loadedWallets.includes("outside")) {
    await bitcoindClient.loadWallet({ filename: "outside" })
  }
  baseLogger.info("Loaded outside wallet.")

  // Reset state
  if (stateConfig.resetState) {
    await Promise.all([
      resetLnds(),
      resetDatabase(mongoose),
      clearLimiters(),
      clearAccountLocks(),
    ])
    baseLogger.info("Reset state.")
  }

  // Fund outside wallet
  if (stateConfig.outsideWalletBlocksToMineAndConfirm > 0) {
    const bitcoindAddress = await bitcoindOutside.getNewAddress()
    const bitcoinReward = await mineAndConfirm({
      walletClient: bitcoindOutside,
      numOfBlocks: stateConfig.outsideWalletBlocksToMineAndConfirm,
      address: bitcoindAddress,
    })
    baseLogger.info(
      `Funded outside wallet by mining ${bitcoinReward} bitcoin to ${bitcoindAddress}`,
    )
  }

  // Create test users and mandatory users
  await Promise.all(
    stateConfig.userAccounts.map((accountEntry) => createUserAndWallet(accountEntry)),
  )
  baseLogger.info("Created all test users.")

  // Fund special wallets
  if (stateConfig.fundFunderWallet) {
    const funderWalletId = await getFunderWalletId()
    const funderBalance = await fundWalletIdFromOnchain({
      walletId: funderWalletId,
      amountInBitcoin: stateConfig.fundFunderWallet.amountInBitcoin,
      lnd: stateConfig.fundFunderWallet.receivingNode,
    })

    const { chain_balance } = await getChainBalance({
      lnd: stateConfig.fundFunderWallet.receivingNode,
    })

    baseLogger.info(
      `Funded Funder Wallet(${funderWalletId}) with current balance of ${funderBalance} sats. Lnd1 chain balance is ${chain_balance}.`,
    )
  }

  await sleep(1000)

  // Fund external lnd
  if (stateConfig.lndFunding.length > 0) {
    for (const lndInstance of stateConfig.lndFunding) {
      await waitUntilSyncAll()
      await fundLnd(lndInstance)
    }
    await mineBlockAndSyncAll()
    baseLogger.info("LND's have been funded.")
  }

  await sleep(1000)

  // Open ln channels
  if (stateConfig.channelOpens.length > 0) {
    for (const channel of stateConfig.channelOpens) {
      await waitUntilSyncAll()
      await openChannelTesting(channel)
    }
    await mineBlockAndSyncAll()
    baseLogger.info("Channels have been opened.")
  }

  await sleep(1000)
  await checkIsBalanced()
}
