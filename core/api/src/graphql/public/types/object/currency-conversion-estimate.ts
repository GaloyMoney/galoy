import getUuidByString from "uuid-by-string"

import Currency from "./currency"

import { GT } from "@/graphql/index"
import Timestamp from "@/graphql/shared/types/scalar/timestamp"
import SatAmount from "@/graphql/shared/types/scalar/sat-amount"
import CentAmount from "@/graphql/public/types/scalar/cent-amount"

const CurrencyConversionEstimate = GT.Object({
  name: "CurrencyConversionEstimate",
  fields: () => ({
    id: {
      type: GT.NonNullID,
      resolve: (source) => getUuidByString(`${source.timestamp}-${source.currency.id}`),
    },
    timestamp: {
      type: GT.NonNull(Timestamp),
      description:
        "Unix timestamp (number of seconds elapsed since January 1, 1970 00:00:00 UTC)",
    },
    currency: { type: GT.NonNull(Currency) },
    btcSatAmount: { type: GT.NonNull(SatAmount), description: "Amount in satoshis." },
    usdCentAmount: { type: GT.NonNull(CentAmount), description: "Amount in USD cents." },
  }),
})

export default CurrencyConversionEstimate
