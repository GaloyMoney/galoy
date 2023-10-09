import { randomUUID } from "crypto"

import { seedPriceCache } from "./price-cache"

import { createAccountWithPhoneIdentifier } from "@/app/accounts"

import {
  ConfigError,
  UNSECURE_PRICE_CACHE,
  getAdminAccounts,
  getDefaultAccountsConfig,
} from "@/config"

import { CouldNotFindAccountFromKratosIdError, CouldNotFindError } from "@/domain/errors"
import { WalletCurrency } from "@/domain/shared"

import { initialStaticAccountIds } from "@/services/ledger/facade"
import {
  AccountsRepository,
  UsersRepository,
  WalletsRepository,
} from "@/services/mongoose"
import { Account } from "@/services/mongoose/schema"
import { toObjectId } from "@/services/mongoose/utils"

export const randomUserId = () => randomUUID() as UserId

const adminUsers = getAdminAccounts()

export const bootstrap = async () => {
  const adminAccountIds = await initialStaticAccountIds()

  for (const accountNameString of Object.keys(adminAccountIds)) {
    const accountName = accountNameString as keyof InitialStaticAccountIds
    const accountId = adminAccountIds[accountName]
    if (!(accountId instanceof Error)) continue

    let adminConfig: AdminAccount | undefined = undefined
    switch (accountName) {
      case "bankOwnerAccountId":
        adminConfig = adminUsers.find((val) => val.role === "bankowner")
        break

      case "dealerBtcAccountId":
      case "dealerUsdAccountId":
        adminConfig = adminUsers.find((val) => val.role === "dealer")
        break

      case "funderAccountId":
        adminConfig = adminUsers.find((val) => val.role === "funder")
        break
    }
    if (adminConfig === undefined) {
      return new ConfigError("Missing required admin account config")
    }

    const { phone, role } = adminConfig
    const user = await UsersRepository().findByPhone(phone)
    let kratosUserId: UserId
    if (user instanceof CouldNotFindError) {
      const randomKratosUserId = randomUserId()

      const res = await UsersRepository().update({
        id: randomKratosUserId,
        deviceTokens: [`token-${randomKratosUserId}`] as DeviceToken[],
        phone,
      })
      kratosUserId = randomKratosUserId
      if (res instanceof Error) return res
    } else {
      if (user instanceof Error) return user

      kratosUserId = user.id
    }

    let account = await AccountsRepository().findByUserId(kratosUserId)
    if (account instanceof CouldNotFindAccountFromKratosIdError) {
      account = await createAccountWithPhoneIdentifier({
        newAccountInfo: { phone, kratosUserId },
        config: getDefaultAccountsConfig(),
      })
    }
    if (account instanceof Error) return account

    await Account.findOneAndUpdate(
      { _id: toObjectId<AccountId>(account.id) },
      { role, contactEnabled: false },
    )

    const wallet = await WalletsRepository().findById(account.defaultWalletId)
    if (wallet instanceof Error) return wallet
    if (wallet.currency !== WalletCurrency.Btc) {
      return new Error("Expected BTC-currency default wallet")
    }

    UNSECURE_PRICE_CACHE && (await seedPriceCache())
  }
}
