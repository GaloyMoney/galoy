import { SECS_PER_10_MINS } from "@/config"

import { CacheKeys } from "@/domain/cache"
import { WalletCurrency } from "@/domain/shared"
import { PriceNotAvailableError } from "@/domain/price"
import { checkedToDisplayCurrency, getCurrencyMajorExponent } from "@/domain/fiat"
import { toDisplayPriceRatio, toWalletPriceRatio } from "@/domain/payments"

import { PriceService } from "@/services/price"
import { LocalCacheService } from "@/services/cache/local-cache"

export const getCurrentSatPrice = ({
  currency,
}: GetCurrentSatPriceArgs): Promise<RealTimePrice<DisplayCurrency> | ApplicationError> =>
  getCurrentPrice({
    walletCurrency: WalletCurrency.Btc,
    displayCurrency: currency,
  })

export const getCurrentUsdCentPrice = ({
  currency,
}: GetCurrentUsdCentPriceArgs): Promise<
  RealTimePrice<DisplayCurrency> | ApplicationError
> =>
  getCurrentPrice({
    walletCurrency: WalletCurrency.Usd,
    displayCurrency: currency,
  })

const getCurrentPrice = async ({
  walletCurrency,
  displayCurrency,
}: GetCurrentPriceArgs): Promise<RealTimePrice<DisplayCurrency> | ApplicationError> => {
  const checkedDisplayCurrency = checkedToDisplayCurrency(displayCurrency)
  if (checkedDisplayCurrency instanceof Error) return checkedDisplayCurrency

  const priceService = PriceService()
  let cacheKey: CacheKeys = CacheKeys.CurrentSatPrice
  let getRealTimePrice = () =>
    priceService.getSatRealTimePrice({
      displayCurrency: checkedDisplayCurrency,
    })
  if (walletCurrency === WalletCurrency.Usd) {
    cacheKey = CacheKeys.CurrentUsdCentPrice
    getRealTimePrice = () =>
      priceService.getUsdCentRealTimePrice({
        displayCurrency: checkedDisplayCurrency,
      })
  }

  const realtimePrice = await getRealTimePrice()
  if (realtimePrice instanceof Error)
    return getCachedPrice({ key: cacheKey, currency: checkedDisplayCurrency })

  let cachedPrices = await getCachedPrices(cacheKey)
  cachedPrices = cachedPrices instanceof Error ? {} : cachedPrices

  cachedPrices[displayCurrency] = realtimePrice

  // keep prices in cache for 10 mins in case the price pod is not online
  await LocalCacheService().set<DisplayCurrencyPrices>({
    key: cacheKey,
    value: cachedPrices,
    ttlSecs: SECS_PER_10_MINS,
  })
  return cachedPrices[displayCurrency]
}

export const getCurrentPriceAsWalletPriceRatio = async ({
  currency,
}: GetCurrentSatPriceArgs): Promise<WalletPriceRatio | PriceServiceError> => {
  const price = await getCurrentSatPrice({ currency })
  if (price instanceof Error) return price

  const exponent = getCurrencyMajorExponent(currency)

  return toWalletPriceRatio(price.price * 10 ** exponent)
}

export const getCurrentPriceAsDisplayPriceRatio = async <T extends DisplayCurrency>({
  currency,
}: GetCurrentSatPriceArgs): Promise<DisplayPriceRatio<"BTC", T> | PriceServiceError> => {
  const price = await getCurrentSatPrice({ currency })
  if (price instanceof Error) return price

  const exponent = getCurrencyMajorExponent(currency)

  return toDisplayPriceRatio({
    ratio: price.price * 10 ** exponent,
    displayCurrency: currency as T,
  })
}

export const getCurrentUsdCentPriceAsDisplayPriceRatio = async <
  T extends DisplayCurrency,
>({
  currency,
}: GetCurrentSatPriceArgs): Promise<DisplayPriceRatio<"USD", T> | ApplicationError> => {
  const price = await getCurrentUsdCentPrice({ currency })
  if (price instanceof Error) return price

  const exponent = getCurrencyMajorExponent(currency)

  return toDisplayPriceRatio({
    ratio: price.price * 10 ** exponent,
    displayCurrency: currency as T,
  })
}

const getCachedPrice = async ({
  key,
  currency,
}: GetCachedPriceArgs): Promise<
  RealTimePrice<DisplayCurrency> | PriceNotAvailableError
> => {
  const cachedPrices = await getCachedPrices(key)
  if (cachedPrices instanceof Error || !cachedPrices[currency])
    return new PriceNotAvailableError()
  return cachedPrices[currency]
}

const getCachedPrices = async (
  key: CacheKeys,
): Promise<DisplayCurrencyPrices | PriceNotAvailableError> => {
  const cachedPrices = await LocalCacheService().get<DisplayCurrencyPrices>({ key })
  if (cachedPrices instanceof Error) return new PriceNotAvailableError()
  return cachedPrices
}
