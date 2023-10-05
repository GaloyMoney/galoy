import { LedgerTransactionType } from "@domain/ledger"
import { WalletCurrency, ZERO_BANK_FEE } from "@domain/shared"

import { toSats } from "@domain/bitcoin"

import { toCents } from "@domain/fiat"

import { MainBook } from "../books"

import { EntryBuilder } from "../domain"
import { persistAndReturnEntry } from "../helpers"

import { staticAccountIds } from "./static-account-ids"

export const recordSettleBankownerDebt = async ({
  description,
  amount,
}: RecordBankownerDebtArgs) => {
  const accountIds = await staticAccountIds()
  if (accountIds instanceof Error) return accountIds

  const bankOwnerAccountDescriptor: LedgerAccountDescriptor<WalletCurrency> = {
    id: accountIds.bankOwnerAccountId,
    currency: WalletCurrency.Btc,
  }
  const metadata = {
    type: LedgerTransactionType.BankOwnerDebt,
    currency: WalletCurrency.Btc,
    pending: false,
    satsAmount: toSats(amount.btc.amount),
    satsFee: toSats(0),
    centsAmount: toCents(amount.usd.amount),
    centsFee: toCents(0),
  }

  let entry = MainBook.entry(description)
  const builder = EntryBuilder({
    staticAccountIds: accountIds,
    entry,
    metadata,
    additionalInternalMetadata: {},
  })

  entry = builder
    .withTotalAmount({ usdWithFees: amount.usd, btcWithFees: amount.btc })
    .withBankFee(ZERO_BANK_FEE)
    .debitAccount({
      accountDescriptor: bankOwnerAccountDescriptor,
      additionalMetadata: {},
    })
    .creditOffChain()

  return persistAndReturnEntry({ entry })
}
