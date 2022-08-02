import { GT } from "@graphql/index"
import IError from "@graphql/types/abstract/error"

import AccountCustomFields from "../object/account-custom-fields"

const AccountCustomFieldsPayload = GT.Object({
  name: "AccountCustomFieldsPayload",
  fields: () => ({
    errors: {
      type: GT.NonNullList(IError),
    },
    accountCustomFields: {
      type: AccountCustomFields,
    },
  }),
})

export default AccountCustomFieldsPayload
