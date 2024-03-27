import { Prices } from "@/app"

import { GT } from "@/graphql/index"
import { mapError } from "@/graphql/error-map"
import DisplayCurrencyGT from "@/graphql/shared/types/scalar/display-currency"
import CurrencyConversionEstimation from "@/graphql/public/types/object/currency-conversion-estimation"

const CurrencyConversionEstimationQuery = GT.Field<
  null,
  GraphQLPublicContext,
  {
    amount: number | InputValidationError
    currency: string | InputValidationError
  }
>({
  type: GT.NonNull(CurrencyConversionEstimation),
  description: `Returns an estimated conversion rate for the given amount and currency`,
  args: {
    amount: {
      type: GT.NonNull(GT.Float),
      description: "Amount in major unit.",
    },
    currency: {
      type: GT.NonNull(DisplayCurrencyGT),
      description: "Currency of the amount to be converted.",
    },
  },
  resolve: async (_, args) => {
    const { amount: amountInMajorUnit, currency: uncheckedCurrency } = args
    if (amountInMajorUnit instanceof Error) throw amountInMajorUnit
    if (uncheckedCurrency instanceof Error) throw uncheckedCurrency

    const estimation = await Prices.estimateWalletsAmounts({
      amount: amountInMajorUnit,
      currency: uncheckedCurrency,
    })
    if (estimation instanceof Error) throw mapError(estimation)

    return {
      timestamp: estimation.timestamp,
      currency: estimation.currency,
      btcSatAmount: Number(estimation.btcSatAmount.amount),
      usdCentAmount: Number(estimation.usdCentAmount.amount),
    }
  },
})

export default CurrencyConversionEstimationQuery
