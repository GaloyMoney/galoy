import { getAccountsConfig } from "@config"

import { GT } from "@graphql/index"
import { parseCustomFieldsSchema } from "@graphql/helpers"

const customFieldsSchema = getAccountsConfig().customFields

const AccountCustomFields = GT.Object({
  name: "AccountCustomFields",
  fields: () => {
    const customFields = parseCustomFieldsSchema({ fields: customFieldsSchema })

    return { ...customFields }
  },
})

export default AccountCustomFields
