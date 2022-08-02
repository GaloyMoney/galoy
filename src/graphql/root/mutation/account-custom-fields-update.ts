import { getAccountsConfig } from "@config"

import { Accounts } from "@app"

import { GT } from "@graphql/index"
import { mapError } from "@graphql/error-map"
import { parseCustomFieldsSchema } from "@graphql/helpers"
import AccountCustomFieldsUpdatePayload from "@graphql/types/payload/account-custom-fields"

const customFieldsSchema = getAccountsConfig().customFields

const AccountCustomFieldsUpdateInput = GT.Input({
  name: "AccountCustomFieldsUpdateInput",
  fields: () => {
    const customFields = parseCustomFieldsSchema({
      fields: customFieldsSchema,
      onlyEditable: true,
    })

    return { ...customFields }
  },
})

const AccountCustomFieldsUpdateMutation = GT.Field({
  type: GT.NonNull(AccountCustomFieldsUpdatePayload),
  args: {
    input: { type: GT.NonNull(AccountCustomFieldsUpdateInput) },
  },
  resolve: async (
    _,
    args,
    { domainUser, domainAccount }: { domainUser: User; domainAccount: Account },
  ) => {
    const { ...customFields } = args.input

    for (const key in customFields) {
      if (customFields[key] instanceof Error) {
        return { errors: [{ message: customFields[key].message }] }
      }
    }

    const result = await Accounts.updateAccountCustomFields({
      accountId: domainAccount.id,
      modifiedByUserId: domainUser.id,
      customFields,
    })

    if (result instanceof Error) {
      const appErr = mapError(result)
      return { errors: [{ message: appErr.message || appErr.name }] }
    }

    return {
      errors: [],
      accountCustomFields: result.customFields,
    }
  },
})

export default AccountCustomFieldsUpdateMutation
