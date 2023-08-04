import {
  ConfigError,
  env,
  getAdminAccounts,
  getDefaultAccountsConfig,
  isRunningJest,
} from "@config"
import { AccountLevel } from "@domain/accounts"
import { WalletType } from "@domain/wallets"
import { baseLogger } from "@services/logger"
import {
  AccountsRepository,
  WalletsRepository,
  UsersRepository,
} from "@services/mongoose"
import { TWILIO_ACCOUNT_TEST, TwilioClient } from "@services/twilio"

const initializeCreatedAccount = async ({
  account,
  config,
  phone,
}: {
  account: Account
  config: AccountsConfig
  phone?: PhoneNumber
}): Promise<Account | ApplicationError> => {
  const newWallet = (currency: WalletCurrency) =>
    WalletsRepository().persistNew({
      accountId: account.id,
      type: WalletType.Checking,
      currency,
    })

  const walletsEnabledConfig = config.initialWallets

  // Create all wallets
  const enabledWallets: Partial<Record<WalletCurrency, Wallet>> = {}
  for (const currency of walletsEnabledConfig) {
    const wallet = await newWallet(currency)
    if (wallet instanceof Error) return wallet
    enabledWallets[currency] = wallet
  }

  // Set default wallet as 1st element in walletsEnabledConfig array.
  const defaultWalletId = enabledWallets[walletsEnabledConfig[0]]?.id

  if (defaultWalletId === undefined) {
    return new ConfigError("NoWalletsEnabledInConfigError")
  }
  account.defaultWalletId = defaultWalletId

  // TODO: improve bootstrap process
  // the script below is to dynamically attribute the editor account at runtime
  // this is only if editor is set in the config - typically only in test env
  const role = getAdminAccounts().find(({ phone: phone2 }) => phone2 === phone)?.role
  account.role = role || "user"
  // end TODO

  account.contactEnabled = account.role === "user" || account.role === "editor"

  account.statusHistory = [{ status: config.initialStatus, comment: "Initial Status" }]
  account.level = config.initialLevel

  const updatedAccount = await AccountsRepository().update(account)
  if (updatedAccount instanceof Error) return updatedAccount

  return updatedAccount
}

export const createAccountForDeviceAccount = async ({
  userId,
  deviceId,
}: {
  userId: UserId
  deviceId: DeviceId
}): Promise<Account | RepositoryError> => {
  const user = await UsersRepository().update({ id: userId, deviceId })
  if (user instanceof Error) return user

  const accountNew = await AccountsRepository().persistNew(userId)
  if (accountNew instanceof Error) return accountNew

  const levelZeroAccountsConfig = getDefaultAccountsConfig()
  levelZeroAccountsConfig.initialLevel = AccountLevel.Zero

  return initializeCreatedAccount({
    account: accountNew,
    config: levelZeroAccountsConfig,
  })
}

export const createAccountWithPhoneIdentifier = async ({
  newAccountInfo: { kratosUserId, phone },
  config,
}: {
  newAccountInfo: NewAccountWithPhoneIdentifier
  config: AccountsConfig
}): Promise<Account | RepositoryError> => {
  let phoneMetadata: PhoneMetadata | PhoneProviderServiceError | undefined

  // we can't mock getCarrier properly because in the end to end test,
  // the server is been launched as a sub process,
  // so it's not been mocked by jest
  if (
    env.TWILIO_ACCOUNT_SID !== TWILIO_ACCOUNT_TEST ||
    isRunningJest /* TwilioClient will be mocked */
  ) {
    phoneMetadata = await TwilioClient().getCarrier(phone)
  }

  if (phoneMetadata instanceof Error) {
    baseLogger.warn({ phone }, "impossible to fetch carrier")
    phoneMetadata = undefined
  }

  const user = await UsersRepository().update({ id: kratosUserId, phone, phoneMetadata })
  if (user instanceof Error) return user

  const accountNew = await AccountsRepository().persistNew(kratosUserId)
  if (accountNew instanceof Error) return accountNew

  const account = await initializeCreatedAccount({
    account: accountNew,
    config,
    phone,
  })
  if (account instanceof Error) return account

  return account
}
