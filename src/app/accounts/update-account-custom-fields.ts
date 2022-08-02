import { CouldNotFindError } from "@domain/errors"
import { AccountCustomFieldsRepository } from "@services/mongoose"

export const updateAccountCustomFields = async ({
  accountId,
  modifiedByUserId,
  customFields,
}: {
  accountId: AccountId
  modifiedByUserId: UserId
  customFields: { [k: string]: string | number | boolean }
}): Promise<AccountCustomFields | ApplicationError> => {
  const accountCustomFieldsRepo = AccountCustomFieldsRepository()

  const accountCustomFields = await accountCustomFieldsRepo.findById(accountId)
  const isEmpty = accountCustomFields instanceof CouldNotFindError
  if (accountCustomFields instanceof Error && !isEmpty) return accountCustomFields

  let data = customFields
  if (!isEmpty) {
    data = { ...accountCustomFields.customFields, ...customFields }
  }

  return accountCustomFieldsRepo.persistNew({
    accountId: accountId,
    modifiedByUserId,
    customFields: data,
  })
}
