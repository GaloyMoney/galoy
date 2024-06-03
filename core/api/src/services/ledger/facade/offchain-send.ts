import { MainBook, Transaction } from "../books"

import { EntryBuilder, toLedgerAccountDescriptor } from "../domain"
import { NoTransactionToSettleError } from "../domain/errors"
import { TransactionsMetadataRepository } from "../services"
import { persistAndReturnEntry } from "../helpers"

import { translateToLedgerJournal } from ".."

import { staticAccountIds } from "./static-account-ids"

import { UnknownLedgerError } from "@/domain/ledger"
import { ZERO_CENTS, ZERO_SATS } from "@/domain/shared"
import { NoTransactionToUpdateError } from "@/domain/errors"

export const recordSendOffChain = async ({
  description,
  senderWalletDescriptor,
  amountToDebitSender,
  bankFee,
  metadata,
  additionalDebitMetadata,
  additionalInternalMetadata,
}: RecordSendArgs) => {
  const actualFee = bankFee || { usd: ZERO_CENTS, btc: ZERO_SATS }
  const accountIds = await staticAccountIds()
  if (accountIds instanceof Error) return accountIds

  let entry = MainBook.entry(description)
  const builder = EntryBuilder({
    staticAccountIds: accountIds,
    entry,
    metadata,
    additionalInternalMetadata,
  })

  entry = builder
    .withTotalAmount({
      usdWithFees: amountToDebitSender.usd,
      btcWithFees: amountToDebitSender.btc,
    })
    .withBankFee({ usdBankFee: actualFee.usd, btcBankFee: actualFee.btc })
    .debitAccount({
      accountDescriptor: toLedgerAccountDescriptor(senderWalletDescriptor),
      additionalMetadata: additionalDebitMetadata,
    })
    .creditOffChain()

  return persistAndReturnEntry({ entry, hash: metadata.hash })
}

export const recordLnSendRevert = async ({
  journalId,
  paymentHash,
}: RevertLightningPaymentArgs): Promise<true | LedgerServiceError> => {
  const reason = "Payment canceled"
  try {
    const txMetadataRepo = TransactionsMetadataRepository()

    const savedEntry = await MainBook.void(journalId, reason)
    const journalEntry = translateToLedgerJournal(savedEntry)

    const txsMetadataToPersist = journalEntry.transactionIds.map((id) => ({
      id,
      hash: paymentHash,
    }))
    txMetadataRepo.persistAll(txsMetadataToPersist)
    return true
  } catch (err) {
    return new UnknownLedgerError(err)
  }
}

export const updateMetadataByHash = async (
  ledgerTxMetadata:
    | OnChainLedgerTransactionMetadataUpdate
    | LnLedgerTransactionMetadataUpdate,
): Promise<true | LedgerServiceError | RepositoryError> =>
  TransactionsMetadataRepository().updateByHash(ledgerTxMetadata)

export const settlePendingLnSend = async (
  paymentHash: PaymentHash,
): Promise<true | LedgerServiceError> => {
  try {
    const result = await Transaction.updateMany({ hash: paymentHash }, { pending: false })
    const success = result.modifiedCount > 0
    if (!success) {
      return new NoTransactionToSettleError()
    }
    return true
  } catch (err) {
    return new UnknownLedgerError(err)
  }
}

export const updatePubkeyByHash = async ({
  paymentHash,
  pubkey,
}: {
  paymentHash: PaymentHash
  pubkey: Pubkey
}): Promise<true | LedgerServiceError> => {
  try {
    const result = await Transaction.updateMany({ hash: paymentHash }, { pubkey })
    const success = result.modifiedCount > 0
    if (!success) {
      return new NoTransactionToUpdateError(paymentHash)
    }
    return true
  } catch (err) {
    return new UnknownLedgerError(err)
  }
}
