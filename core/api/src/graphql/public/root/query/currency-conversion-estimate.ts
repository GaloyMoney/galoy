import { Prices } from "@/app"

import {
  majorToMinorUnit,
  UsdDisplayCurrency,
  displayAmountFromNumber,
} from "@/domain/fiat"

import { GT } from "@/graphql/index"
import { mapError } from "@/graphql/error-map"
import DisplayCurrencyGT from "@/graphql/shared/types/scalar/display-currency"
import CurrencyConversionEstimate from "@/graphql/public/types/object/currency-conversion-estimate"

const CurrencyConversionEstimateQuery = GT.Field<
  null,
  GraphQLPublicContext,
  {
    amount: number | InputValidationError
    currency: string | InputValidationError
  }
>({
  type: GT.NonNull(CurrencyConversionEstimate),
  description: `Returns an estimated conversion rate for the given amount and currency`,
  args: {
    amount: {
      type: GT.NonNull(GT.Float),
      description: "Amount in major unit.",
    },
    currency: {
      type: DisplayCurrencyGT,
      defaultValue: UsdDisplayCurrency,
      description: "Currency of the amount to be converted.",
    },
  },
  resolve: async (_, args) => {
    const { amount: amountInMajorUnit, currency: uncheckedCurrency } = args
    if (amountInMajorUnit instanceof Error) throw amountInMajorUnit
    if (uncheckedCurrency instanceof Error) throw uncheckedCurrency

    const priceCurrency = await Prices.getCurrency({ currency: uncheckedCurrency })
    if (priceCurrency instanceof Error) throw mapError(priceCurrency)

    const currency = priceCurrency.code

    const btcPrice = await Prices.getCurrentSatPrice({ currency })
    if (btcPrice instanceof Error) throw mapError(btcPrice)

    const usdPrice = await Prices.getCurrentUsdCentPrice({ currency })
    if (usdPrice instanceof Error) throw mapError(usdPrice)

    const satPriceRatio = await Prices.getCurrentPriceAsDisplayPriceRatio({ currency })
    if (satPriceRatio instanceof Error) throw mapError(satPriceRatio)

    const centPriceRatio = await Prices.getCurrentUsdCentPriceAsDisplayPriceRatio({
      currency,
    })
    if (centPriceRatio instanceof Error) throw mapError(centPriceRatio)

    const amountInMinor = displayAmountFromNumber({
      amount: majorToMinorUnit({
        amount: amountInMajorUnit,
        displayCurrency: currency,
      }),
      currency,
    })
    if (amountInMinor instanceof Error) throw mapError(amountInMinor)

    const amountInSats = satPriceRatio.convertFromDisplayMinorUnit(amountInMinor)
    const amountInCents = centPriceRatio.convertFromDisplayMinorUnit(amountInMinor)

    return {
      timestamp: btcPrice.timestamp,
      currency: priceCurrency,
      btcSatAmount: Number(amountInSats.amount),
      usdCentAmount: Number(amountInCents.amount),
    }
  },
})

export default CurrencyConversionEstimateQuery
