import { getAccountsConfig } from "@config"

import { Accounts } from "@app"

import { GT } from "@graphql/index"
import { mapError } from "@graphql/error-map"
import { parseCustomFieldsSchema } from "@graphql/helpers"
import AccountCustomFieldsUpdatePayload from "@graphql/admin/types/payload/account-custom-fields"

const customFieldsSchema = getAccountsConfig().customFields

const AccountCustomFieldsUpdateInput = GT.Input({
  name: "AccountCustomFieldsUpdateInput",
  fields: () => {
    const customFields = parseCustomFieldsSchema({ fields: customFieldsSchema })

    return {
      accountId: { type: GT.NonNullID },
      ...customFields,
    }
  },
})

const AccountCustomFieldsUpdateMutation = GT.Field({
  type: GT.NonNull(AccountCustomFieldsUpdatePayload),
  args: {
    input: { type: GT.NonNull(AccountCustomFieldsUpdateInput) },
  },
  resolve: async (_, args, { domainUser }: { domainUser: User }) => {
    const { accountId, ...customFields } = args.input

    if (accountId instanceof Error) {
      return { errors: [{ message: accountId.message }] }
    }

    for (const key in customFields) {
      if (customFields[key] instanceof Error) {
        return { errors: [{ message: customFields[key].message }] }
      }
    }

    const result = await Accounts.updateAccountCustomFields({
      accountId,
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
