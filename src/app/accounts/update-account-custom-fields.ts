import { CouldNotFindError } from "@domain/errors"
import { AccountCustomFieldsRepository, AccountsRepository } from "@services/mongoose"

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

  const account = await AccountsRepository().findById(accountId)
  if (account instanceof Error) return account

  const accountCustomFields = await accountCustomFieldsRepo.findById(account.id)
  const isEmpty = accountCustomFields instanceof CouldNotFindError
  if (accountCustomFields instanceof Error && !isEmpty) return accountCustomFields

  let data = customFields
  if (!isEmpty) {
    data = { ...accountCustomFields.customFields, ...customFields }
  }

  return accountCustomFieldsRepo.persistNew({
    accountId: account.id,
    modifiedByUserId,
    customFields: data,
  })
}
