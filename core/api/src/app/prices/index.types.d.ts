type GetCurrencyArgs = {
  currency: string
}

type GetCurrentPriceArgs = {
  walletCurrency: WalletCurrency
  displayCurrency: string
}

type GetCurrentSatPriceArgs = {
  currency: DisplayCurrency
}

type GetCurrentUsdCentPriceArgs = {
  currency: string
}

type GetCachedPriceArgs = {
  key: CacheKeys
  currency: DisplayCurrency
}

type DisplayCurrencyPrices = { [k: string]: RealTimePrice<DisplayCurrency> }

type EstimateWalletsAmountsArgs = {
  amount: number
  currency: string
}

type WalletsAmounts = {
  timestamp: Date
  currency: PriceCurrency
  btcSatAmount: PaymentAmount<"BTC">
  usdCentAmount: PaymentAmount<"USD">
}
