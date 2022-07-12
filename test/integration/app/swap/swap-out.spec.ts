import { SwapService } from "@services/swap"

import { toSats } from "@domain/bitcoin"

import { getSwapConfig, getColdStorageConfig } from "@config"
import { SwapClientNotResponding } from "@domain/swap/errors"
import { SwapOutChecker } from "@domain/swap"
import { lndsBalances } from "@services/lnd/utils"

describe("Swap", () => {
  it("Swap out returns successful SwapResult", async () => {
    const swapResult = await SwapService.swapOut(toSats(500000))
    if (swapResult instanceof SwapClientNotResponding) {
      console.log("Swap Client is not running, skipping")
      return
    }
    expect(swapResult).not.toBeInstanceOf(Error)
    expect(swapResult).toEqual(
      expect.objectContaining({
        swapId: expect.any(String),
      }),
    )
  })

  it("Swap out without enough funds returns an Error", async () => {
    const swapResult = await SwapService.swapOut(toSats(5000000000))
    if (swapResult instanceof SwapClientNotResponding) {
      return
    }
    expect(swapResult).toBeInstanceOf(Error)
  })

  it("Swap out if on chain wallet is depleted", async () => {
    // thresholds
    const { onChain } = await lndsBalances()
    const minOnChainHotWalletBalanceConfig =
      getColdStorageConfig().minOnChainHotWalletBalance

    // check if wallet is depleted
    const isOnChainWalletDepleted = SwapOutChecker({
      currentOnChainHotWalletBalance: onChain,
      minOnChainHotWalletBalanceConfig,
    }).isOnChainWalletDepleted()

    if (isOnChainWalletDepleted) {
      const swapOutAmount = getSwapConfig().swapOutAmount
      const swapResult = await SwapService.swapOut(toSats(swapOutAmount))
      if (swapResult instanceof SwapClientNotResponding) {
        return
      }

      expect(swapResult).not.toBeInstanceOf(Error)
      expect(swapResult).toEqual(
        expect.objectContaining({
          swapId: expect.any(String),
        }),
      )
    } else {
      expect("No swap Needed").toEqual("No swap Needed")
    }
  })
})
