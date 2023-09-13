import { GT } from "@graphql/index"

import IError from "../../../shared/types/abstract/error"
import ConsumerAccount from "../object/consumer-account"

const AccountUpdatePushNotificationSettingsPayload = GT.Object({
  name: "AccountUpdatePushNotificationSettingsPayload",
  fields: () => ({
    errors: {
      type: GT.NonNullList(IError),
    },
    account: {
      type: ConsumerAccount,
    },
  }),
})

export default AccountUpdatePushNotificationSettingsPayload
