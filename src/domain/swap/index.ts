// checks if swap out is needed
export const SwapOutChecker = ({
  currentOnChainHotWalletBalance,
  minOnChainHotWalletBalanceConfig,
}) => {
  const isOnChainWalletDepleted = () => {
    if (currentOnChainHotWalletBalance < minOnChainHotWalletBalanceConfig) {
      return true
    } else {
      return false
    }
  }

  return {
    isOnChainWalletDepleted,
  }
}
