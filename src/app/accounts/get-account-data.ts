import { AccountDataRepository } from "@services/mongoose"

export const getAccountData = async (
  accountId: AccountId,
): Promise<AccountData | ApplicationError> => {
  return AccountDataRepository().findById(accountId)
}
