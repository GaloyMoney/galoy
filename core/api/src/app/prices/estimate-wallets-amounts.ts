import { getCurrency } from "./get-currency"
import {
  getCurrentPriceAsDisplayPriceRatio,
  getCurrentSatPrice,
  getCurrentUsdCentPrice,
  getCurrentUsdCentPriceAsDisplayPriceRatio,
} from "./get-current-price"

import { displayAmountFromNumber, majorToMinorUnit } from "@/domain/fiat"

export const estimateWalletsAmounts = async ({
  amount,
  currency: uncheckedCurrency,
}: EstimateWalletsAmountsArgs): Promise<WalletsAmounts | ApplicationError> => {
  const priceCurrency = await getCurrency({ currency: uncheckedCurrency })
  if (priceCurrency instanceof Error) return priceCurrency

  const currency = priceCurrency.code

  const btcPrice = await getCurrentSatPrice({ currency })
  if (btcPrice instanceof Error) return btcPrice

  const usdPrice = await getCurrentUsdCentPrice({ currency })
  if (usdPrice instanceof Error) return usdPrice

  const satPriceRatio = await getCurrentPriceAsDisplayPriceRatio({ currency })
  if (satPriceRatio instanceof Error) return satPriceRatio

  const centPriceRatio = await getCurrentUsdCentPriceAsDisplayPriceRatio({
    currency,
  })
  if (centPriceRatio instanceof Error) return centPriceRatio

  const amountInMinor = displayAmountFromNumber({
    amount: majorToMinorUnit({ amount, displayCurrency: currency }),
    currency,
  })
  if (amountInMinor instanceof Error) return amountInMinor

  const btcSatAmount = satPriceRatio.convertFromDisplayMinorUnit(amountInMinor)
  const usdCentAmount = centPriceRatio.convertFromDisplayMinorUnit(amountInMinor)

  return {
    timestamp: btcPrice.timestamp,
    currency: priceCurrency,
    btcSatAmount,
    usdCentAmount,
  }
}
