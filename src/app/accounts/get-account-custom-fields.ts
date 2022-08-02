import { AccountCustomFieldsRepository } from "@services/mongoose"

export const getAccountCustomFields = async (
  accountId: AccountId,
): Promise<AccountCustomFields | ApplicationError> => {
  return AccountCustomFieldsRepository().findById(accountId)
}
