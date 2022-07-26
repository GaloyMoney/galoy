import { getAccountsConfig } from "@config"

import { Accounts } from "@app"

import { GT } from "@graphql/index"
import { mapError } from "@graphql/error-map"
import { parseCustomFieldsSchema } from "@graphql/helpers"
import AccountDataUpdatePayload from "@graphql/types/payload/account-data"

const customFieldsSchema = getAccountsConfig().customFields

const AccountDataUpdateInput = GT.Input({
  name: "AccountDataUpdateInput",
  fields: () => {
    const customFields = parseCustomFieldsSchema(customFieldsSchema)

    return {
      transactionsCallback: { type: GT.String },
      ...customFields,
    }
  },
})

const AccountDataUpdateMutation = GT.Field({
  type: GT.NonNull(AccountDataUpdatePayload),
  args: {
    input: { type: GT.NonNull(AccountDataUpdateInput) },
  },
  resolve: async (_, args, { domainAccount }: { domainAccount: Account }) => {
    const { transactionsCallback, ...customFields } = args.input

    if (transactionsCallback instanceof Error) {
      return { errors: [{ message: transactionsCallback.message }] }
    }

    for (const field of customFields) {
      if (field instanceof Error) {
        return { errors: [{ message: field.message }] }
      }
    }

    const result = await Accounts.updateAccountData({
      accountId: domainAccount.id,
      transactionsCallback,
      customFields,
    })

    if (result instanceof Error) {
      const appErr = mapError(result)
      return { errors: [{ message: appErr.message || appErr.name }] }
    }

    return {
      errors: [],
      account: result,
    }
  },
})

export default AccountDataUpdateMutation
