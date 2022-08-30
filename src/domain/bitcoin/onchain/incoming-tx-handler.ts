import {
  AmountCalculator,
  paymentAmountFromNumber,
  WalletCurrency,
  ZERO_SATS,
} from "@domain/shared"

const calc = AmountCalculator()

export const IncomingOnChainTxHandler = (
  txns: IncomingOnChainTransaction[],
): IncomingOnChainTxHandler => {
  const balanceByAddress = ():
    | { [key: OnChainAddress]: BtcPaymentAmount }
    | ValidationError => {
    const pendingBalances = txns.map(balanceFromIncomingTx)

    const balancesByAddress = {} as { [key: OnChainAddress]: BtcPaymentAmount }
    for (const balances of pendingBalances) {
      if (balances instanceof Error) return balances
      for (const key of Object.keys(balances)) {
        const address = key as OnChainAddress
        balancesByAddress[address] = calc.add(
          balancesByAddress[address] || ZERO_SATS,
          balances[address],
        )
      }
    }
    return balancesByAddress
  }

  const balanceByWallet = (
    wallets: Wallet[],
  ): { [key: WalletId]: BtcPaymentAmount } | ValidationError => {
    const balancesByAddress = balanceByAddress()
    if (balancesByAddress instanceof Error) return balancesByAddress

    const balancesByWallet = {} as { [key: WalletId]: BtcPaymentAmount }
    for (const wallet of wallets) {
      balancesByWallet[wallet.id] = ZERO_SATS
      for (const key of Object.keys(balancesByAddress)) {
        const address = key as OnChainAddress
        if (wallet.onChainAddresses().includes(address as OnChainAddress)) {
          balancesByWallet[wallet.id] = calc.add(
            balancesByWallet[wallet.id],
            balancesByAddress[address],
          )
        }
      }
    }

    return balancesByWallet
  }

  const balanceFromIncomingTx = (
    tx: IncomingOnChainTransaction,
  ): { [key: OnChainAddress]: BtcPaymentAmount } | ValidationError => {
    const balanceByAddress = {} as { [key: OnChainAddress]: BtcPaymentAmount }
    const {
      rawTx: { outs },
    } = tx
    for (const out of outs) {
      if (!out.address) continue
      balanceByAddress[out.address] = balanceByAddress[out.address] || ZERO_SATS
      const outAmount = paymentAmountFromNumber({
        amount: out.sats,
        currency: WalletCurrency.Btc,
      })
      if (outAmount instanceof Error) return outAmount

      balanceByAddress[out.address] = calc.add(balanceByAddress[out.address], outAmount)
    }
    return balanceByAddress
  }

  return {
    balanceByAddress,
    balanceByWallet,
  }
}
