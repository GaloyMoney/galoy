import { safeBigInt, WalletCurrency } from "@/domain/shared"

export const CENTS_PER_USD = 100

export const SAT_PRICE_PRECISION_OFFSET = 12
export const USD_PRICE_PRECISION_OFFSET = 6
export const BTC_PRICE_PRECISION_OFFSET = 4

export const MajorExponent = {
  STANDARD: 2,
  ZERO: 0,
  ONE: 1,
  THREE: 3,
  FOUR: 4,
} as const

export const majorToMinorUnit = ({
  amount,
  displayCurrency,
}: {
  amount: number | bigint
  displayCurrency: DisplayCurrency
}): number => {
  const displayMajorExponent = getCurrencyMajorExponent(displayCurrency)
  return Math.round(Number(amount) * 10 ** displayMajorExponent)
}

export const getCurrencyMajorExponent = (
  currency: DisplayCurrency,
): CurrencyMajorExponent => {
  try {
    const formatter = new Intl.NumberFormat("en-US", { style: "currency", currency })
    const { minimumFractionDigits } = formatter.resolvedOptions()
    switch (minimumFractionDigits) {
      case 0:
        return MajorExponent.ZERO
      case 1:
        return MajorExponent.ONE
      case 3:
        return MajorExponent.THREE
      case 4:
        return MajorExponent.FOUR
      default:
        return MajorExponent.STANDARD
    }
  } catch {
    // this is necessary for non-standard currencies
    return MajorExponent.STANDARD
  }
}

const displayMinorToMajor = ({
  amountInMinor,
  displayMajorExponent,
}: {
  amountInMinor: bigint
  displayMajorExponent: CurrencyMajorExponent
}) => (Number(amountInMinor) / 10 ** displayMajorExponent).toFixed(displayMajorExponent)

export const displayAmountFromNumber = <T extends DisplayCurrency>({
  amount,
  currency,
}: {
  amount: number
  currency: T
}): DisplayAmount<T> | ValidationError => {
  const amountInMinor = safeBigInt(amount)
  if (amountInMinor instanceof Error) return amountInMinor

  const displayMajorExponent = getCurrencyMajorExponent(currency)

  return {
    amountInMinor,
    currency,
    displayInMajor: displayMinorToMajor({ amountInMinor, displayMajorExponent }),
  }
}

export const displayAmountFromWalletAmount = <D extends DisplayCurrency>(
  walletAmount: PaymentAmount<WalletCurrency>,
): DisplayAmount<D> => {
  const { amount: amountInMinor, currency } = walletAmount

  const displayMajorExponent = getCurrencyMajorExponent(currency as D)

  return {
    amountInMinor,
    currency: currency as D,
    displayInMajor: displayMinorToMajor({ amountInMinor, displayMajorExponent }),
  }
}

export const priceAmountFromNumber = <
  S extends WalletCurrency,
  T extends DisplayCurrency,
>({
  priceInMinorUnit,
  displayCurrency,
  walletCurrency,
}: {
  priceInMinorUnit: number
  displayCurrency: T
  walletCurrency: S
}): WalletMinorUnitDisplayPrice<S, T> => {
  const offset =
    walletCurrency === WalletCurrency.Btc
      ? SAT_PRICE_PRECISION_OFFSET
      : USD_PRICE_PRECISION_OFFSET

  return {
    base: BigInt(Math.floor(priceInMinorUnit * 10 ** offset)),
    offset: BigInt(offset),
    displayCurrency,
    walletCurrency,
  }
}

export const priceAmountFromDisplayPriceRatio = <
  S extends WalletCurrency,
  T extends DisplayCurrency,
>(
  displayPriceRatio: DisplayPriceRatio<S, T>,
): WalletMinorUnitDisplayPrice<S, T> =>
  priceAmountFromNumber({
    priceInMinorUnit: displayPriceRatio.displayMinorUnitPerWalletUnit(),
    displayCurrency: displayPriceRatio.displayCurrency,
    walletCurrency: displayPriceRatio.walletCurrency,
  })
