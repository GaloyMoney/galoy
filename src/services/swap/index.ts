import { ISwapService } from "@domain/swap/index.types"

// @todo maybe move to app layer and pass in array of providers
import LoopSwapProvider from "./providers/lightning-labs/loop-swap-provider"

export const SwapService: ISwapService = {
  isSwapServerUp: async () => {
    return LoopSwapProvider.isSwapServerUp()
  },
  swapOut: async (amount) => {
    // @todo iterate providers and find best fee
    // const swapProviders = getSwapConfig().swapProviders
    const swapResult = await LoopSwapProvider.swapOut(amount)
    return swapResult
  },
  swapListener: () => {
    const listener = LoopSwapProvider.swapListener
    return listener()
  },
}
