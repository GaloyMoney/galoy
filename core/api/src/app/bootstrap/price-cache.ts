import { UsdDisplayCurrency } from "@/domain/fiat"
import { LocalCacheService } from "@/services/cache"

export const seedPriceCache = async () => {
  const value: DisplayCurrencyPrices = {
    USD: {
      timestamp: new Date(),
      currency: UsdDisplayCurrency,
      price: 0.000124,
    },
    EUR: {
      timestamp: new Date(),
      currency: UsdDisplayCurrency,
      price: 0.000124,
    },
  }

  await LocalCacheService().set<DisplayCurrencyPrices>({
    key: "price:current:sat",
    value,
    ttlSecs: (60 * 60 * 24 * 365) as Seconds, // 1y
  })

  await LocalCacheService().set<DisplayCurrencyPrices>({
    key: "price:current:usdcent",
    value,
    ttlSecs: (60 * 60 * 24 * 365) as Seconds, // 1y
  })
}
