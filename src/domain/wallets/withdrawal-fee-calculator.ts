import { toSats } from "@domain/bitcoin"
import { AmountCalculator, ZERO_CENTS, ZERO_SATS } from "@domain/shared"

const calc = AmountCalculator()

export const WithdrawalFeeCalculator = ({
  thresholdImbalance,
  feeRatio,
}: OnchainWithdrawalConfig): WithdrawalFeeCalculator => {
  const onChainWithdrawalFee = ({
    minerFee,
    amount,
    minBankFee,
    imbalance,
  }: {
    minerFee: Satoshis
    amount: Satoshis
    minBankFee: Satoshis
    imbalance: SwapOutImbalance
  }) => {
    const baseAmount = Math.max(
      Math.min(imbalance - thresholdImbalance + amount, amount),
      0,
    )
    const bankFee = toSats(Math.max(minBankFee, Math.ceil(baseAmount * feeRatio)))
    return {
      totalFee: toSats(bankFee + minerFee),
      bankFee,
    }
  }

  return {
    onChainWithdrawalFee,
    onChainIntraLedgerFee: (): Satoshis => toSats(0),
  }
}

export const OnChainFees = ({
  thresholdImbalance,
  feeRatioAsBasisPoints,
}: NewOnchainWithdrawalConfig): OnChainFeeCalculator => {
  const withdrawalFee = ({
    minerFee,
    amount,
    minBankFee,
    imbalance,
  }: {
    minerFee: BtcPaymentAmount
    amount: BtcPaymentAmount
    minBankFee: BtcPaymentAmount
    imbalance: BtcPaymentAmount
  }) => {
    const amountWithImbalanceCalcs = {
      amount: imbalance.amount - thresholdImbalance.amount + amount.amount,
      currency: amount.currency,
    }
    const baseAmount = calc.max(calc.min(amountWithImbalanceCalcs, amount), ZERO_SATS)
    const bankFee = calc.max(
      minBankFee,
      calc.mulBasisPoints(baseAmount, feeRatioAsBasisPoints),
    )

    return {
      totalFee: calc.add(bankFee, minerFee),
      bankFee,
    }
  }

  return {
    withdrawalFee,
    intraLedgerFees: () => ({
      btc: ZERO_SATS,
      usd: ZERO_CENTS,
    }),
  }
}
