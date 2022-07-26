import { getAccountsConfig } from "@config"

import { GT } from "@graphql/index"
import { parseCustomFieldsSchema } from "@graphql/helpers"

const customFieldsSchema = getAccountsConfig().customFields

const AccountData = GT.Object({
  name: "AccountData",
  fields: () => {
    const customFields = parseCustomFieldsSchema(customFieldsSchema)

    return {
      transactionsCallback: { type: GT.String },
      ...customFields,
    }
  },
})

export default AccountData
