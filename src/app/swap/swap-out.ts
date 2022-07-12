import { BTC_NETWORK, getSwapConfig } from "@config"
import { TxDecoder } from "@domain/bitcoin/onchain"
import { SwapServiceError } from "@domain/swap/errors"
import { SwapOutResult } from "@domain/swap/index.types"
import { SwapService } from "@services/swap"
import { OnChainService } from "@services/lnd/onchain-service"

export const swapOut = async ({
  amount,
}: SwapOutArgs): Promise<SwapOutResult | SwapServiceError> => {
  const onChainService = OnChainService(TxDecoder(BTC_NETWORK))
  if (onChainService instanceof Error) return onChainService

  const onChainBalance = await onChainService.getBalance()
  if (onChainBalance instanceof Error) return onChainBalance

  const minOutboundLiquidityBalance = getSwapConfig().minOutboundLiquidityBalance
  if (onChainBalance < minOutboundLiquidityBalance) {
    const swapResult = await SwapService.swapOut(amount)
    return swapResult
  } else {
    return null
  }
}
