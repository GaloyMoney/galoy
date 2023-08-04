import { getActiveLnd } from "@services/lnd/utils"
import { SwapErrorNoActiveLoopdNode } from "@domain/swap/errors"
import { getSwapConfig, getLoopConfig, env } from "@config"

export const getActiveLoopd = (): LoopdConfig => {
  const activeOffChainNode = getActiveLnd()
  if (activeOffChainNode instanceof Error) throw new SwapErrorNoActiveLoopdNode()
  switch (activeOffChainNode.name) {
    case "LND1": {
      return lnd1LoopConfig()
    }
    case "LND2": {
      return lnd2LoopConfig()
    }
    default: {
      throw new SwapErrorNoActiveLoopdNode()
    }
  }
}

export const lnd1LoopConfig = (): LoopdConfig => ({
  btcNetwork: env.NETWORK as BtcNetwork,
  grpcEndpoint: getSwapConfig().lnd1loopRpcEndpoint,
  tlsCert: getLoopConfig().lnd1LoopTls,
  macaroon: getLoopConfig().lnd1LoopMacaroon,
  lndInstanceName: "LND1",
})

export const lnd2LoopConfig = (): LoopdConfig => ({
  btcNetwork: env.NETWORK as BtcNetwork,
  grpcEndpoint: getSwapConfig().lnd2loopRpcEndpoint,
  tlsCert: getLoopConfig().lnd2LoopTls,
  macaroon: getLoopConfig().lnd2LoopMacaroon,
  lndInstanceName: "LND2",
})
