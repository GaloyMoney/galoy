import { AccountsRepository, WalletsRepository } from "@services/mongoose"

export * from "./get-account-data"
export * from "./get-account-transactions-for-contact"
export * from "./update-account-data"
export * from "./update-account-level"
export * from "./update-account-status"
export * from "./update-business-map-info"
export * from "./send-default-wallet-balance-to-users"
export * from "./add-earn"
export * from "./set-username"
export * from "./username-available"
export * from "./get-contact-by-username"
export * from "./update-contact-alias"
export * from "./add-new-contact"
export * from "./update-default-walletid"
export * from "./get-csv-for-account"
export * from "./get-transactions-for-account"
export * from "./add-wallet"

const accounts = AccountsRepository()

export const getAccount = async (
  accountId: AccountId,
): Promise<Account | RepositoryError> => {
  return accounts.findById(accountId)
}

export const hasPermissions = async (
  userId: UserId,
  walletId: WalletId,
): Promise<boolean | ApplicationError> => {
  const userAccount = await accounts.findByUserId(userId)
  if (userAccount instanceof Error) return userAccount

  const wallet = await WalletsRepository().findById(walletId)
  if (wallet instanceof Error) return wallet

  return userAccount.id === wallet.accountId
}

export const getBusinessMapMarkers = async () => {
  return accounts.listBusinessesForMap()
}

export const getUsernameFromWalletId = async (
  walletId: WalletId,
): Promise<Username | ApplicationError> => {
  const wallet = await WalletsRepository().findById(walletId)
  if (wallet instanceof Error) return wallet

  const account = await accounts.findById(wallet.accountId)
  if (account instanceof Error) return account
  return account.username
}
