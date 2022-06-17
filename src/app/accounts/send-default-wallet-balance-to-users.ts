import { wrapAsyncToRunInSpan } from "@services/tracing"
import { getCurrentPrice } from "@app/prices"
import { NotificationsService } from "@services/notifications"
import { LedgerService } from "@services/ledger"

import {
  AccountsRepository,
  UsersRepository,
  WalletsRepository,
} from "@services/mongoose"

import { DisplayCurrency, DisplayCurrencyConverter } from "@domain/fiat"
import { WalletCurrency } from "@domain/shared"
import { toSats } from "@domain/bitcoin"

import { getRecentlyActiveAccounts } from "./active-accounts"

export const sendDefaultWalletBalanceToUsers = async () => {
  const accounts = await getRecentlyActiveAccounts()
  if (accounts instanceof Error) throw accounts

  const price = await getCurrentPrice()
  const displayCurrencyPerSat = price instanceof Error ? undefined : price
  const converter = displayCurrencyPerSat
    ? DisplayCurrencyConverter(displayCurrencyPerSat)
    : undefined

  const notifyUser = async (account: Account) => {
    const balance = await LedgerService().getWalletBalance(account.defaultWalletId)
    if (balance instanceof Error) return balance

    const wallet = await WalletsRepository().findById(account.defaultWalletId)
    if (wallet instanceof Error) return wallet

    const recipientAccount = await AccountsRepository().findById(wallet.accountId)
    if (recipientAccount instanceof Error) return recipientAccount

    const recipientUser = await UsersRepository().findById(recipientAccount.ownerId)
    if (recipientUser instanceof Error) return recipientUser

    const balanceAmount: BalanceAmount<WalletCurrency> = {
      amount: BigInt(balance),
      currency: wallet.currency,
    }

    let displayBalanceAmount: DisplayBalanceAmount<DisplayCurrency> | undefined
    if (converter && wallet.currency === WalletCurrency.Btc) {
      const amount = converter.fromSats(toSats(balance))
      displayBalanceAmount = { amount, currency: DisplayCurrency.Usd }
    }

    await NotificationsService().sendBalance({
      balanceAmount,
      recipientDeviceTokens: recipientUser.deviceTokens,
      displayBalanceAmount,
      recipientLanguage: recipientUser.language,
    })
  }

  for (const account of accounts) {
    await wrapAsyncToRunInSpan({
      namespace: "daily-balance-notification",
      fn: async () => notifyUser(account),
    })()
  }
}
