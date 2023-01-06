import { USER_ACTIVENESS_MONTHLY_VOLUME_THRESHOLD } from "@config"

import { getCurrentPrice } from "@app/prices"

import { ErrorLevel } from "@domain/shared"
import { DisplayCurrency } from "@domain/fiat"
import { ActivityChecker } from "@domain/ledger"
import { DisplayCurrencyConverter } from "@domain/fiat/display-currency"

import { LedgerService } from "@services/ledger"
import { recordExceptionInCurrentSpan } from "@services/tracing"
import { WalletsRepository, AccountsRepository } from "@services/mongoose"

export const getRecentlyActiveAccounts = async function* ():
  | AsyncGenerator<Account>
  | ApplicationError {
  const unlockedAccounts = AccountsRepository().listUnlockedAccounts()
  if (unlockedAccounts instanceof Error) return unlockedAccounts

  const displayCurrencyPerSat = await getCurrentPrice({ currency: DisplayCurrency.Usd })
  if (displayCurrencyPerSat instanceof Error) return displayCurrencyPerSat

  const dCConverter = DisplayCurrencyConverter(displayCurrencyPerSat)

  const ledger = LedgerService()
  const activityChecker = ActivityChecker({
    getVolumeFn: ledger.allTxBaseVolumeSince,
    dCConverter,
    monthlyVolumeThreshold: USER_ACTIVENESS_MONTHLY_VOLUME_THRESHOLD,
  })
  for await (const account of unlockedAccounts) {
    // FIXME: this is a very slow query (not critical as only run daily on cron currently).
    // a mongodb query would be able to get the wallet in aggregate directly
    // from medici_transactions instead

    const wallets = await WalletsRepository().listByAccountId(account.id)
    if (wallets instanceof Error) {
      recordExceptionInCurrentSpan({
        error: "impossible to listByAccountId",
        level: ErrorLevel.Critical,
        attributes: { account: account.id },
      })
      continue
    }

    const isActive = await activityChecker.aboveThreshold(wallets)
    if (isActive instanceof Error) {
      recordExceptionInCurrentSpan({
        error: "impossible to get aboveThreshold value",
        level: ErrorLevel.Critical,
        attributes: { account: account.id, wallets: JSON.stringify(wallets) },
      })
      continue
    }
    if (isActive) {
      yield account
    }
  }
}
