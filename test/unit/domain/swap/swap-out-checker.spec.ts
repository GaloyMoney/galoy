import { SwapOutChecker } from "@domain/swap"

describe("SwapOutChecker", () => {
  it("checks if a Swap Out is needed", async () => {
    const checker = SwapOutChecker({
      currentOnChainHotWalletBalance: 10000,
      minOnChainHotWalletBalanceConfig: 50000,
    })
    expect(checker.isOnChainWalletDepleted()).toEqual(true)
  })
})
