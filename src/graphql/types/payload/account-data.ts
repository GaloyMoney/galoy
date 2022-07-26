import { GT } from "@graphql/index"

import IError from "../abstract/error"
import AccountData from "../object/account-data"

const AccountDataPayload = GT.Object({
  name: "AccountDataPayload",
  fields: () => ({
    errors: {
      type: GT.NonNullList(IError),
    },
    accountData: {
      type: AccountData,
    },
  }),
})

export default AccountDataPayload
