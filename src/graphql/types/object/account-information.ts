import { getAccountsConfig } from "@config"

import { GT } from "@graphql/index"
import { parseCustomFieldsSchema } from "@graphql/helpers"

const customFieldsSchema = getAccountsConfig().customFields

const AccountInformation = GT.Object({
  name: "AccountInformation",
  fields: () => {
    const customFields = parseCustomFieldsSchema(customFieldsSchema)

    return {
      transactionsCallback: { type: GT.String },
      ...customFields,
    }
  },
})

export default AccountInformation
