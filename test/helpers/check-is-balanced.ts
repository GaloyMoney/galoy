import { updatePendingPayments } from "@app/payments"
import { handleHeldInvoices, updateOnChainReceipt } from "@app/wallets"
import { baseLogger } from "@services/logger"
import { getBalance as getBitcoindBalance } from "@services/bitcoind"

import { ledgerAdmin } from "@services/mongodb"
import { lndsBalances } from "@services/lnd/utils"

import { waitUntilChannelBalanceSyncAll } from "./lightning"

const logger = baseLogger.child({ module: "test" })

export const checkIsBalanced = async () => {
  await Promise.all([
    handleHeldInvoices(logger),
    updatePendingPayments(logger),
    updateOnChainReceipt({ logger }),
  ])
  // wait for balance updates because invoice event
  // arrives before wallet balances updates in lnd
  await waitUntilChannelBalanceSyncAll()

  const { assetsLiabilitiesDifference, bookingVersusRealWorldAssets } =
    await balanceSheetIsBalanced()
  expect(assetsLiabilitiesDifference).toBe(0)

  // TODO: need to go from sats to msats to properly account for every msats spent
  expect(Math.abs(bookingVersusRealWorldAssets)).toBe(0)
}

const getLedgerAccounts = async () => {
  const [assets, liabilities, lightning, bitcoin, bankOwnerBalance] = await Promise.all([
    ledgerAdmin.getAssetsBalance(),
    ledgerAdmin.getLiabilitiesBalance(),
    ledgerAdmin.getLndBalance(),
    ledgerAdmin.getBitcoindBalance(),
    ledgerAdmin.getBankOwnerBalance(),
  ])

  return { assets, liabilities, lightning, bitcoin, bankOwnerBalance }
}

const balanceSheetIsBalanced = async () => {
  const { assets, liabilities, lightning, bitcoin, bankOwnerBalance } =
    await getLedgerAccounts()
  const { total: lnd } = await lndsBalances() // doesnt include escrow amount

  const bitcoind = await getBitcoindBalance()

  const assetsLiabilitiesDifference =
    assets /* assets is ___ */ + liabilities /* liabilities is ___ */

  const bookingVersusRealWorldAssets =
    lnd + // physical assets
    bitcoind + // physical assets
    (lightning + bitcoin) // value in accounting

  if (!!bookingVersusRealWorldAssets || !!assetsLiabilitiesDifference) {
    logger.warn(
      {
        assetsLiabilitiesDifference,
        bookingVersusRealWorldAssets,
        assets,
        liabilities,
        bankOwnerBalance,
        lnd,
        lightning,
        bitcoind,
        bitcoin,
      },
      `not balanced`,
    )
  }

  return { assetsLiabilitiesDifference, bookingVersusRealWorldAssets }
}
