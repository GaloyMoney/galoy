import { getAccountsConfig } from "@config"

import { GT } from "@graphql/index"
import { parseDynamicFieldSchema } from "@graphql/helpers"

const dynamicFieldsSchema = getAccountsConfig().information

const AccountInformation = GT.Object({
  name: "AccountInformation",
  fields: () => {
    const dynamicFields = parseDynamicFieldSchema(dynamicFieldsSchema)

    return {
      transactionsCallback: { type: GT.String },
      ...dynamicFields,
    }
  },
})

export default AccountInformation
