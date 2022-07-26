import { AccountDataRepository } from "@services/mongoose"

export const updateAccountData = async ({
  accountId,
  transactionsCallback,
  customFields,
}: {
  accountId: AccountId
  transactionsCallback: string
  customFields: { [k: string]: string | number | boolean }
}): Promise<AccountData | ApplicationError> => {
  const accountDataRepo = AccountDataRepository()

  // TODO: add callback and custom fields input validations

  const accountData = await accountDataRepo.findById(accountId)
  if (accountData instanceof Error) return accountData

  const data = { ...accountData.customFields, ...customFields }

  return accountDataRepo.update({
    id: accountId,
    transactionsCallback,
    customFields: data,
  })
}
