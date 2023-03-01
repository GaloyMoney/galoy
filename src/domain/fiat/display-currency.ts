export const CENTS_PER_USD = 100

export const MajorExponent = {
  STANDARD: 2n,
  ONE: 1n,
  THREE: 3n,
} as const

export const usdMinorToMajorUnit = (amount: number | bigint) =>
  Number((Number(amount) / CENTS_PER_USD).toFixed(2))

// TODO: update by display currency
export const usdMajorToMinorUnit = (amount: number | bigint) =>
  Number(Number(amount) * CENTS_PER_USD)

export const toDisplayCurrencyBaseAmount = (amount: number) =>
  amount as DisplayCurrencyBaseAmount

export const NewDisplayCurrencyConverter = (
  displayCurrencyPrice: DisplayCurrencyBasePerSat,
): NewDisplayCurrencyConverter => {
  return {
    fromBtcAmount: (btc: BtcPaymentAmount): DisplayCurrencyBaseAmount =>
      (Number(btc.amount) * displayCurrencyPrice) as DisplayCurrencyBaseAmount,
    fromUsdAmount: (usd: UsdPaymentAmount): DisplayCurrencyBaseAmount =>
      Number(usd.amount) as DisplayCurrencyBaseAmount,
  }
}
