import { once } from "events"

import { Wallets } from "@app"
import { addInvoiceForSelf, getBalanceForWallet } from "@app/wallets"

import {
  offchainLnds,
  onchainLnds,
  onChannelUpdated,
  updateEscrows,
} from "@services/lnd/utils"
import { baseLogger } from "@services/logger"
import { sleep } from "@utils"

import {
  authenticatedLndGrpc,
  closeChannel,
  createChainAddress,
  getChainBalance,
  getChannelBalance,
  getChannels,
  getInvoice,
  getWalletInfo,
  openChannel,
  pay,
  sendToChainAddress,
  subscribeToChannels,
  subscribeToGraph,
  updateRoutingFees,
} from "lightning"

import { parsePaymentRequest } from "invoices"

import {
  bitcoindClient,
  bitcoindOutside,
  RANDOM_ADDRESS,
  sendToAddressAndConfirm,
} from "./bitcoin-core"

export * from "lightning"

export const lnd1 = offchainLnds[0].lnd
export const lnd2 = offchainLnds[1].lnd
export const lndonchain = onchainLnds[0].lnd

export const getHash = (request: EncodedPaymentRequest) => {
  return parsePaymentRequest({ request }).id as PaymentHash
}

export const getAmount = (request: EncodedPaymentRequest) => {
  return parsePaymentRequest({ request }).tokens as Satoshis
}

export const getPubKey = (request: EncodedPaymentRequest) => {
  return parsePaymentRequest({ request }).destination as Pubkey
}
export const getInvoiceAttempt = async ({ lnd, id }) => {
  try {
    const result = await getInvoice({ lnd, id })
    return result
  } catch (err) {
    const invoiceNotFound = "unable to locate invoice"
    if (err.length === 3 && err[2]?.err?.details === invoiceNotFound) {
      return null
    }
    // must be wrapped error?
    throw err
  }
}

// TODO: this could be refactored with lndAuth
export const lndOutside1 = authenticatedLndGrpc({
  cert: process.env.TLSOUTSIDE1,
  macaroon: process.env.MACAROONOUTSIDE1,
  socket: `${process.env.LNDOUTSIDE1ADDR}:${process.env.LNDOUTSIDE1RPCPORT ?? 10009}`,
}).lnd

export const lndOutside2 = authenticatedLndGrpc({
  cert: process.env.TLSOUTSIDE2,
  macaroon: process.env.MACAROONOUTSIDE2,
  socket: `${process.env.LNDOUTSIDE2ADDR}:${process.env.LNDOUTSIDE2RPCPORT ?? 10009}`,
}).lnd

export const lnds = [lnd1, lnd2, lndOutside1, lndOutside2]

export const waitUntilBlockHeight = async ({ lnd, blockHeight = 0 }) => {
  let block = blockHeight
  if (block <= 0) {
    block = await bitcoindClient.getBlockCount()
  }

  let current_block_height: number, is_synced_to_chain: boolean
  ;({ current_block_height, is_synced_to_chain } = await getWalletInfo({ lnd }))

  let time = 0
  const ms = 50
  while (current_block_height < block || !is_synced_to_chain) {
    await sleep(ms)
    ;({ current_block_height, is_synced_to_chain } = await getWalletInfo({ lnd }))
    time++
  }

  baseLogger.debug(
    { current_block_height, is_synced_to_chain },
    `Seconds to sync blockheight ${block}: ${time / (1000 / ms)}`,
  )
}

export const openChannelTesting = async ({
  lnd,
  lndPartner,
  socket,
  is_private = false,
}) => {
  await waitUntilSync({ lnds: [lnd, lndPartner] })

  const local_tokens = 1000000
  const { public_key: partner_public_key } = await getWalletInfo({ lnd: lndPartner })

  const openChannelPromise = waitFor(async () => {
    try {
      return openChannel({
        lnd,
        local_tokens,
        is_private,
        partner_public_key,
        partner_socket: socket,
      })
    } catch (error) {
      baseLogger.warn({ error }, "openChannel failed. trying again.")
      return Promise.resolve(null)
    }
  })

  let lndNewChannel, lndPartnerNewChannel
  const sub = subscribeToChannels({ lnd })
  sub.once("channel_opened", (channel) => {
    lndNewChannel = channel
  })

  const subPartner = subscribeToChannels({ lnd: lndPartner })
  subPartner.once("channel_opened", (channel) => {
    lndPartnerNewChannel = channel
  })

  await Promise.all([once(sub, "channel_opening"), openChannelPromise])

  baseLogger.debug("mining blocks and waiting for channel being opened")
  await Promise.all([
    // error: https://github.com/alexbosworth/ln-service/issues/122
    // once(sub, 'channel_opened'),
    waitFor(() => lndNewChannel && lndPartnerNewChannel),
    mineBlockAndSync({ lnds: [lnd, lndPartner] }),
  ])

  if (lnd === lnd1) {
    baseLogger.debug({ lndNewChannel }, "lnd is lnd1 - onChannelUpdated")
    await onChannelUpdated({ channel: lndNewChannel, lnd, stateChange: "opened" })
  }

  if (lndPartner === lnd1) {
    expect(lndPartnerNewChannel.is_partner_initiated).toBe(true)
  }

  sub.removeAllListeners()
  subPartner.removeAllListeners()

  await updateEscrows()
  baseLogger.debug({ lndNewChannel, lndPartnerNewChannel }, "new channels")

  return { lndNewChannel, lndPartnerNewChannel }
}

// all the following uses of bitcoind client that send/receive coin must be "outside"

export const fundLnd = async (lnd, amount = 1) => {
  const { address } = (await createChainAddress({
    format: "p2wpkh",
    lnd,
  })) as { address: OnChainAddress }
  await sendToAddressAndConfirm({ walletClient: bitcoindOutside, address, amount })
  await waitUntilBlockHeight({ lnd })
}

export const resetLnds = async () => {
  // just in case pending transactions
  await mineBlockAndSync({ lnds })

  for (const lnd of lnds) {
    await closeAllChannels({ lnd })
    await waitUntilSync({ lnds })
  }

  await mineBlockAndSync({ lnds })

  for (const lnd of lnds) {
    const chainBalance = (await getChainBalance({ lnd })).chain_balance
    if (chainBalance > 0) {
      const address = await bitcoindOutside.getNewAddress()
      await sendToChainAddress({
        lnd,
        address,
        is_send_all: true,
        fee_tokens_per_vbyte: 1,
      })
    }
  }

  await mineBlockAndSync({ lnds })
}

export const closeAllChannels = async ({ lnd }) => {
  try {
    const { channels } = await getChannels({ lnd })
    for (const channel of channels) {
      if (channel.is_partner_initiated === false) {
        await closeChannel({ lnd, id: channel.id })
      }
    }
  } catch (error) {
    baseLogger.error(
      { error },
      "Channels could not be closed, please reset your environment",
    )
    throw error
  }
}

export const setChannelFees = async ({ lnd, channel, base = 1, rate = 1 }) => {
  const input = {
    fee_rate: rate,
    base_fee_mtokens: `${base * 1000}`,
    transaction_id: channel.transaction_id,
    transaction_vout: channel.transaction_vout,
  }

  const updateRoutingFeesPromise = waitFor(async () => {
    try {
      await updateRoutingFees({ lnd, ...input })
      return true
    } catch (error) {
      baseLogger.warn({ error }, "updateRoutingFees failed. trying again.")
      return false
    }
  })

  const sub = subscribeToGraph({ lnd })
  await Promise.all([updateRoutingFeesPromise, once(sub, "channel_updated")])

  sub.removeAllListeners()
}

export const mineBlockAndSync = async ({
  lnds,
  blockHeight = 0,
  newBlock = 6,
}: {
  lnds: Array<AuthenticatedLnd>
  blockHeight?: number
  newBlock?: number
}) => {
  await bitcoindOutside.generateToAddress({ nblocks: newBlock, address: RANDOM_ADDRESS })
  const promiseArray: Array<Promise<void>> = []
  for (const lnd of lnds) {
    promiseArray.push(waitUntilBlockHeight({ lnd, blockHeight }))
  }
  await Promise.all(promiseArray)
}

export const mineBlockAndSyncAll = (newBlock = 6) => mineBlockAndSync({ lnds, newBlock })

export const waitUntilSyncAll = () => waitUntilSync({ lnds })

export const waitUntilSync = async ({ lnds }: { lnds: Array<AuthenticatedLnd> }) => {
  const promiseArray: Array<Promise<void>> = []
  for (const lnd of lnds) {
    promiseArray.push(waitUntilBlockHeight({ lnd }))
  }
  await Promise.all(promiseArray)
}

export const waitUntilChannelBalanceSyncAll = async () => {
  const promiseArray: Array<Promise<void>> = []
  for (const lnd of lnds) {
    promiseArray.push(waitUntilChannelBalanceSync({ lnd }))
  }
  await Promise.all(promiseArray)
}

export const waitUntilChannelBalanceSync = ({ lnd }) =>
  waitFor(async () => {
    const { unsettled_balance } = await getChannelBalance({ lnd })
    return unsettled_balance === 0
  })

export const waitFor = async (f) => {
  let res
  while (!(res = await f())) await sleep(500)
  return res
}

export const fundWalletIdFromLightning = async ({
  walletId,
  amount,
}: {
  walletId: WalletId
  amount: number
}) => {
  const invoice = await addInvoiceForSelf({ walletId, amount })
  if (invoice instanceof Error) return invoice

  pay({ lnd: lndOutside1, request: invoice.paymentRequest })

  // TODO: we could use an event instead of a sleep
  await sleep(500)

  const hash = getHash(invoice.paymentRequest)

  expect(
    await Wallets.updatePendingInvoiceByPaymentHash({
      paymentHash: hash as PaymentHash,
      logger: baseLogger,
    }),
  ).not.toBeInstanceOf(Error)

  const balance = await getBalanceForWallet({ walletId, logger: baseLogger })
  if (balance instanceof Error) throw balance
}
