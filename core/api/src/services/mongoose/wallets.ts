import { AccountsRepository } from "./accounts"

import { Wallet } from "./schema"

import { parseRepositoryError } from "./utils"

import { WalletCurrency } from "@/domain/shared"
import { toWalletDescriptor } from "@/domain/wallets"
import {
  CouldNotFindWalletFromAccountIdAndCurrencyError,
  CouldNotFindWalletFromIdError,
  CouldNotFindWalletFromOnChainAddressError,
  CouldNotFindWalletFromOnChainAddressesError,
  CouldNotListWalletsFromAccountIdError,
  MultipleWalletsFoundForAccountIdAndCurrency,
} from "@/domain/errors"

export const WalletsRepository = (): IWalletsRepository => {
  const persistNew = async ({
    accountId,
    type,
    currency,
    createdAt,
  }: NewWalletInfo): Promise<Wallet | RepositoryError> => {
    const account = await AccountsRepository().findById(accountId)
    // verify that the account exist
    if (account instanceof Error) return account

    try {
      const wallet = new Wallet({
        accountId,
        type,
        currency,
        createdAt,
      })
      await wallet.save()
      return resultToWallet(wallet)
    } catch (err) {
      return parseRepositoryError(err)
    }
  }

  const findById = async (walletId: WalletId): Promise<Wallet | RepositoryError> => {
    try {
      const result: WalletRecord | null = await Wallet.findOne({ id: walletId })
      if (!result) {
        return new CouldNotFindWalletFromIdError()
      }
      return resultToWallet(result)
    } catch (err) {
      return parseRepositoryError(err)
    }
  }

  const findForAccountById = async ({
    accountId,
    walletId,
  }: {
    accountId: AccountId
    walletId: WalletId
  }): Promise<Wallet | RepositoryError> => {
    try {
      const result: WalletRecord | null = await Wallet.findOne({
        id: walletId,
        accountId,
      })
      if (!result) {
        return new CouldNotFindWalletFromIdError()
      }
      return resultToWallet(result)
    } catch (err) {
      return parseRepositoryError(err)
    }
  }

  const listByAccountId = async (
    accountId: AccountId,
  ): Promise<Wallet[] | RepositoryError> => {
    try {
      const result: WalletRecord[] = await Wallet.find({
        accountId,
      })
      if (!result || result.length === 0) {
        return new CouldNotListWalletsFromAccountIdError(`AccountId: ${accountId}}`)
      }
      return result.map(resultToWallet)
    } catch (err) {
      return parseRepositoryError(err)
    }
  }

  const findAccountWalletsByAccountId = async (
    accountId: AccountId,
  ): Promise<AccountWalletDescriptors | RepositoryError> => {
    const wallets = await listByAccountId(accountId)
    if (wallets instanceof Error) return wallets

    const btcWallets = wallets.filter((wallet) => wallet.currency === WalletCurrency.Btc)
    if (btcWallets.length === 0) {
      return new CouldNotFindWalletFromAccountIdAndCurrencyError(WalletCurrency.Btc)
    }
    if (btcWallets.length > 1) {
      return new MultipleWalletsFoundForAccountIdAndCurrency(WalletCurrency.Btc)
    }
    const btcWallet = btcWallets[0]

    const usdWallets = wallets.filter((wallet) => wallet.currency === WalletCurrency.Usd)
    if (usdWallets.length === 0) {
      return new CouldNotFindWalletFromAccountIdAndCurrencyError(WalletCurrency.Usd)
    }
    if (usdWallets.length > 1) {
      return new MultipleWalletsFoundForAccountIdAndCurrency(WalletCurrency.Usd)
    }
    const usdWallet = usdWallets[0]

    return {
      [WalletCurrency.Btc]: toWalletDescriptor(btcWallet),
      [WalletCurrency.Usd]: toWalletDescriptor(usdWallet),
    }
  }

  const findByAddress = async (
    address: OnChainAddress,
  ): Promise<Wallet | RepositoryError> => {
    try {
      const result: WalletRecord | null = await Wallet.findOne({
        "onchain.address": address,
      })
      if (!result) {
        return new CouldNotFindWalletFromOnChainAddressError()
      }
      return resultToWallet(result)
    } catch (err) {
      return parseRepositoryError(err)
    }
  }

  const listByAddresses = async (
    addresses: OnChainAddress[],
  ): Promise<Wallet[] | RepositoryError> => {
    try {
      const result: WalletRecord[] = await Wallet.find({
        "onchain.address": { $in: addresses },
      })
      if (!result || result.length === 0) {
        return new CouldNotFindWalletFromOnChainAddressesError()
      }
      return result.map(resultToWallet)
    } catch (err) {
      return parseRepositoryError(err)
    }
  }

  return {
    findById,
    findForAccountById,
    listByAccountId,
    findAccountWalletsByAccountId,
    findByAddress,
    listByAddresses,
    persistNew,
  }
}

const resultToWallet = (result: WalletRecord): Wallet => {
  const id = result.id as WalletId
  const accountId = result.accountId as AccountId
  const type = result.type as WalletType
  const currency = result.currency as WalletCurrency
  const createdAt = result.createdAt as Date
  const onChain = result.onchain || []
  const onChainAddressIdentifiers = onChain.map(({ pubkey, address }) => {
    return {
      pubkey: pubkey as Pubkey,
      address: address as OnChainAddress,
    }
  })
  const onChainAddresses = () => onChainAddressIdentifiers.map(({ address }) => address)

  return {
    id,
    accountId,
    type,
    onChainAddressIdentifiers,
    onChainAddresses,
    currency,
    createdAt,
  }
}
