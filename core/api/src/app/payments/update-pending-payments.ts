import { reimburseFee } from "./reimburse-fee"

import { reimburseFailedUsdPayment } from "./reimburse-failed-usd"

import { PaymentFlowFromLedgerTransaction } from "./translations"

import { getTransactionForWalletByJournalId } from "@/app/wallets"

import { toSats } from "@/domain/bitcoin"
import {
  decodeInvoice,
  defaultTimeToExpiryInSeconds,
  LookupPaymentTimedOutError,
  PaymentStatus,
} from "@/domain/bitcoin/lightning"
import { InconsistentDataError } from "@/domain/errors"
import {
  CouldNotFindTransactionError,
  inputAmountFromLedgerTransaction,
  LedgerTransactionType,
  MissingExpectedDisplayAmountsForTransactionError,
  MultiplePendingPaymentsForHashError,
} from "@/domain/ledger"
import { MissingPropsInTransactionForPaymentFlowError } from "@/domain/payments"
import { setErrorCritical, WalletCurrency } from "@/domain/shared"

import { LedgerService, getNonEndUserWalletIds } from "@/services/ledger"
import * as LedgerFacade from "@/services/ledger/facade"
import { LndService } from "@/services/lnd"
import { LockService } from "@/services/lock"
import {
  AccountsRepository,
  LnPaymentsRepository,
  PaymentFlowStateRepository,
  UsersRepository,
  WalletsRepository,
} from "@/services/mongoose"
import { NotificationsService } from "@/services/notifications"
import {
  addAttributesToCurrentSpan,
  recordExceptionInCurrentSpan,
  wrapAsyncToRunInSpan,
} from "@/services/tracing"
import { runInParallel } from "@/utils"

export const updatePendingPayments = async (logger: Logger): Promise<void> => {
  const ledgerService = LedgerService()
  const walletIdsWithPendingPayments = ledgerService.listWalletIdsWithPendingPayments()

  if (walletIdsWithPendingPayments instanceof Error) {
    logger.error(
      { error: walletIdsWithPendingPayments },
      "finish updating pending payments with error",
    )
    return
  }

  await runInParallel({
    iterator: walletIdsWithPendingPayments,
    logger,
    processor: async (walletId: WalletId, index: number) => {
      logger.trace(
        "updating pending payments for walletId %s in worker %d",
        walletId,
        index,
      )
      await updatePendingPaymentsByWalletId({ walletId, logger })
    },
  })

  logger.info("finish updating pending payments")
}

export const updatePendingPaymentsByWalletId = wrapAsyncToRunInSpan({
  namespace: "app.payments",
  fnName: "updatePendingPaymentsByWalletId",
  fn: async ({
    walletId,
    logger,
  }: {
    walletId: WalletId
    logger: Logger
  }): Promise<void | ApplicationError> => {
    const ledgerService = LedgerService()
    const count = await ledgerService.getPendingPaymentsCount(walletId)
    if (count instanceof Error) return count

    addAttributesToCurrentSpan({ pendingPaymentsCount: count })
    if (count === 0) return

    const pendingPayments = await ledgerService.listPendingPayments(walletId)
    if (pendingPayments instanceof Error) return pendingPayments

    for (const pendingPayment of pendingPayments) {
      await updatePendingPayment({
        walletId,
        pendingPayment,
        logger,
      })
    }
  },
})

export const updatePendingPaymentByHash = wrapAsyncToRunInSpan({
  namespace: "app.payments",
  fnName: "updatePendingPaymentByHash",
  fn: async ({
    paymentHash,
    logger,
  }: {
    paymentHash: PaymentHash
    logger: Logger
  }): Promise<void | ApplicationError> => {
    const walletId = await LedgerService().getWalletIdByPaymentHash(paymentHash)
    if (walletId instanceof Error) return walletId

    return updatePendingPaymentsByWalletId({
      walletId,
      logger,
    })
  },
})

const updatePendingPayment = wrapAsyncToRunInSpan({
  namespace: "app.payments",
  fnName: "updatePendingPayment",
  fn: async ({
    walletId,
    pendingPayment,
    logger,
  }: {
    walletId: WalletId
    pendingPayment: LedgerTransaction<WalletCurrency>
    logger: Logger
  }): Promise<true | ApplicationError> => {
    const { paymentHash, pubkey, type: txType } = pendingPayment
    // If we had PaymentLedgerType => no need for checking the fields
    if (!paymentHash) {
      return new InconsistentDataError("paymentHash missing from payment transaction")
    }
    if (!pubkey) {
      return new InconsistentDataError("pubkey missing from payment transaction")
    }

    addAttributesToCurrentSpan({
      "payment.walletId": walletId,
      "payment.request.paymentHash": paymentHash,
      "payment.txType": txType,
    })

    let paymentRequest: EncodedPaymentRequest | undefined = undefined
    let sentFromPubkey: Pubkey | undefined = undefined
    const persistedLookup = await LnPaymentsRepository().findByPaymentHash(paymentHash)
    if (persistedLookup instanceof Error) {
      recordExceptionInCurrentSpan({
        error: persistedLookup,
      })
    } else {
      ;({ paymentRequest, sentFromPubkey } = persistedLookup)
    }

    const lookedUpDecodedInvoice = paymentRequest
      ? decodeInvoice(paymentRequest)
      : undefined
    const decodedInvoice =
      lookedUpDecodedInvoice instanceof Error ? undefined : lookedUpDecodedInvoice

    addAttributesToCurrentSpan({
      "payment.request": paymentRequest,
      "payment.request.description": decodedInvoice?.description,
    })

    const lndService = LndService()
    if (lndService instanceof Error) return lndService
    const lnPaymentLookup = await lndService.lookupPayment({
      pubkey,
      paymentHash,
    })
    if (lnPaymentLookup instanceof Error) {
      logger.error(
        {
          err: lnPaymentLookup,
          topic: "payment",
          protocol: "lightning",
          transactionType: "payment",
          onUs: false,
        },
        "issue fetching payment",
      )

      // NOTE: Handle edge htlc bug case that causes stuck payments. This can be removed
      // when we can upgrade to lnd 0.18.0.
      // See issue for details: https://github.com/lightningnetwork/lnd/issues/7697
      if (lnPaymentLookup instanceof LookupPaymentTimedOutError) {
        addAttributesToCurrentSpan({
          ["error.actionRequired.message"]:
            `Check lnd using '$ lncli trackpayment --json ${paymentHash}' to see if there are any ` +
            "htlcs in the array for that field. If it is empty, the status is IN_FLIGHT and the invoice " +
            "is expired then the ledger transaction can be voided and the payment removed from lnd.",
          "error.potentialHtlcBug.isExpired": decodedInvoice?.isExpired,
          "error.potentialHtlcBug.paymentRequest": paymentRequest,
          "error.potentialHtlcBug.sentFromPubkey": sentFromPubkey,
        })
      }

      return lnPaymentLookup
    }

    if (lnPaymentLookup.status === PaymentStatus.Pending) {
      return true
    }

    // Prepare notifications args
    const senderWallet = await WalletsRepository().findById(walletId)
    if (senderWallet instanceof Error) return senderWallet

    const senderAccount = await AccountsRepository().findById(senderWallet.accountId)
    if (senderAccount instanceof Error) return senderAccount

    const senderUser = await UsersRepository().findById(senderAccount.kratosUserId)
    if (senderUser instanceof Error) return senderUser

    const notificationRecipient = {
      accountId: senderWallet.accountId,
      walletId,
      userId: senderUser.id,
      level: senderAccount.level,
    }

    // Prepare updateLnPaymentState args
    const accountWalletDescriptors =
      await WalletsRepository().findAccountWalletsByAccountId(senderAccount.id)
    if (accountWalletDescriptors instanceof Error) return accountWalletDescriptors

    // Pass on to lock
    return LockService().lockWalletId(walletId, () =>
      lockedPendingPaymentSteps({
        paymentHash,
        destination: decodedInvoice?.destination,
        pendingPayment,
        lnPaymentLookup,

        walletIds: [accountWalletDescriptors.BTC.id, accountWalletDescriptors.USD.id],
        notificationRecipient,

        logger,
      }),
    )
  },
})

const lockedPendingPaymentSteps = async ({
  paymentHash,
  destination,
  pendingPayment,
  lnPaymentLookup,

  walletIds,
  notificationRecipient,

  logger,
}: {
  paymentHash: PaymentHash
  destination: Pubkey | undefined
  pendingPayment: LedgerTransaction<WalletCurrency>
  lnPaymentLookup: LnPaymentLookup | LnFailedPartialPaymentLookup

  walletIds: WalletId[]
  notificationRecipient: NotificationRecipient

  logger: Logger
}): Promise<true | ApplicationError> => {
  const { journalId } = pendingPayment
  const { walletId } = notificationRecipient

  addAttributesToCurrentSpan({
    "payment.context": "updatePendingPayment",
    "payment.request.paymentHash": paymentHash,
    "payment.request.destination": destination,
    "payment.senderWalletCurrency": pendingPayment.currency,
  })

  const paymentLogger = logger.child({
    topic: "payment",
    protocol: "lightning",
    transactionType: "payment",
    onUs: false,
    payment: pendingPayment,
  })

  const ledgerService = LedgerService()
  const recorded = await ledgerService.isLnTxRecorded(paymentHash)
  if (recorded instanceof Error) {
    paymentLogger.error({ error: recorded }, "we couldn't query pending transaction")
    return recorded
  }

  if (recorded) {
    paymentLogger.info("payment has already been processed")
    return true
  }

  const inputAmount = inputAmountFromLedgerTransaction(pendingPayment)
  if (inputAmount instanceof Error) return inputAmount

  const paymentFlowIndex: PaymentFlowStateIndex = {
    paymentHash,
    walletId,
    inputAmount,
  }

  let paymentFlow = await PaymentFlowStateRepository(
    defaultTimeToExpiryInSeconds,
  ).markLightningPaymentFlowNotPending(paymentFlowIndex)
  if (paymentFlow instanceof Error) {
    paymentFlow = await reconstructPendingPaymentFlow({
      paymentHash,
      inputAmount: Number(inputAmount),
    })
    if (paymentFlow instanceof Error) return paymentFlow
  }

  addAttributesToCurrentSpan({
    "payment.btcAmount": paymentFlow.btcPaymentAmount.amount.toString(),
    "payment.btcFee": paymentFlow.btcProtocolAndBankFee.amount.toString(),
    "payment.usdAmount": paymentFlow.usdPaymentAmount.amount.toString(),
    "payment.usdFee": paymentFlow.usdProtocolAndBankFee.amount.toString(),
  })

  const settled = await LedgerFacade.settlePendingLnSend(paymentHash)
  if (settled instanceof Error) {
    paymentLogger.error({ error: settled }, "no transaction to update")
    return settled
  }

  let roundedUpFee: Satoshis = toSats(0)
  let satsAmount: Satoshis | undefined = undefined
  if (lnPaymentLookup.status != PaymentStatus.Failed) {
    roundedUpFee = lnPaymentLookup.confirmedDetails?.roundedUpFee || toSats(0)
    satsAmount = toSats(lnPaymentLookup.roundedUpAmount - roundedUpFee)
  }

  if (
    lnPaymentLookup.status === PaymentStatus.Failed ||
    // pendingPayment is a different version to latest payment from lnd
    satsAmount !== toSats(paymentFlow.btcPaymentAmount.amount)
  ) {
    paymentLogger.warn(
      { success: false, id: paymentHash, payment: pendingPayment },
      "payment has failed. reverting transaction",
    )
    if (paymentFlow.senderWalletCurrency === WalletCurrency.Btc) {
      const voided = await ledgerService.revertLightningPayment({
        journalId,
        paymentHash,
      })
      if (voided instanceof Error) {
        const error = `error voiding payment entry`
        paymentLogger.fatal({ success: false, result: lnPaymentLookup }, error)
        return setErrorCritical(voided)
      }

      return finalizePaymentUpdate({
        result: voided,
        walletIds,
        paymentHash,
        journalId,
        notificationRecipient,
      })
    }

    const reimbursed = await reimburseFailedUsdPayment({
      walletId,
      pendingPayment,
      paymentFlow,
    })
    if (reimbursed instanceof Error) {
      const error = `error reimbursing usd payment entry`
      paymentLogger.fatal({ success: false, result: lnPaymentLookup }, error)
      return setErrorCritical(reimbursed)
    }

    return finalizePaymentUpdate({
      result: reimbursed,
      walletIds,
      paymentHash,
      journalId,
      notificationRecipient,
    })
  }

  paymentLogger.info(
    { success: true, id: paymentHash, payment: pendingPayment },
    "payment has been confirmed",
  )

  const revealedPreImage = lnPaymentLookup.confirmedDetails?.revealedPreImage
  if (revealedPreImage) {
    await LedgerService().updateMetadataByHash({
      hash: paymentHash,
      revealedPreImage,
    })
  }

  if (pendingPayment.feeKnownInAdvance) {
    return finalizePaymentUpdate({
      result: true,
      walletIds,
      paymentHash,
      journalId,
      notificationRecipient,
    })
  }

  const { displayAmount, displayFee, displayCurrency } = pendingPayment
  if (!displayAmount || !displayFee || !displayCurrency) {
    return new MissingExpectedDisplayAmountsForTransactionError()
  }

  const reimbursed = await reimburseFee({
    paymentFlow,
    senderDisplayAmount: displayAmount,
    senderDisplayCurrency: displayCurrency,
    journalId,
    actualFee: roundedUpFee,
    revealedPreImage,
  })
  if (reimbursed instanceof Error) return reimbursed

  return finalizePaymentUpdate({
    result: reimbursed,
    walletIds,
    paymentHash,
    journalId,
    notificationRecipient,
  })
}

const reconstructPendingPaymentFlow = async <
  S extends WalletCurrency,
  R extends WalletCurrency,
>({
  paymentHash,
  inputAmount,
}: {
  paymentHash: PaymentHash
  inputAmount: number
}): Promise<PaymentFlow<S, R> | ApplicationError> => {
  const ledgerTxns = await LedgerService().getTransactionsByHash(paymentHash)
  if (ledgerTxns instanceof Error) return ledgerTxns

  const nonEndUserWalletIds = Object.values(await getNonEndUserWalletIds())

  const payments = ledgerTxns.filter(
    (tx) =>
      tx.pendingConfirmation === true &&
      tx.type === LedgerTransactionType.Payment &&
      tx.debit > 0 &&
      tx.walletId !== undefined &&
      !nonEndUserWalletIds.includes(tx.walletId),
  ) as LedgerTransaction<S>[] | undefined
  if (!(payments && payments.length)) return new CouldNotFindTransactionError()

  const { walletId: senderWalletId } = payments[0]
  if (!senderWalletId) return new MissingPropsInTransactionForPaymentFlowError()
  const senderWallet = await WalletsRepository().findById(senderWalletId)
  if (senderWallet instanceof Error) return senderWallet
  const senderAccount = await AccountsRepository().findById(senderWallet.accountId)
  if (senderAccount instanceof Error) return senderAccount

  const filteredPayments = payments.filter((tx) =>
    senderWallet.currency === WalletCurrency.Btc
      ? tx.satsAmount === inputAmount
      : tx.centsAmount === inputAmount,
  )
  if (!(filteredPayments && filteredPayments.length)) {
    return new CouldNotFindTransactionError()
  }
  // Note: Assumptions that rely on there being 1 pending payment
  //       - no more than one transaction gets settled for a given single lnd payment
  //       - fees are for the latest lnd payment attempt
  if (filteredPayments.length !== 1) {
    return new MultiplePendingPaymentsForHashError()
  }

  const payment = filteredPayments[0]

  return PaymentFlowFromLedgerTransaction({
    ledgerTxn: payment,
    senderAccountId: senderAccount.id,
  })
}

const finalizePaymentUpdate = async ({
  result,
  walletIds,
  paymentHash,
  journalId,
  notificationRecipient,
}: {
  result: true | ApplicationError
  walletIds: WalletId[]
  paymentHash: PaymentHash
  journalId: LedgerJournalId
  notificationRecipient: NotificationRecipient
}) => {
  const { walletId } = notificationRecipient
  const updateJournalTxnsState = await LedgerFacade.updateLnPaymentState({
    walletIds,
    paymentHash,
    journalId,
  })
  if (updateJournalTxnsState instanceof Error) return updateJournalTxnsState

  const walletTransaction = await getTransactionForWalletByJournalId({
    walletId,
    journalId,
  })
  if (walletTransaction instanceof Error) return walletTransaction
  NotificationsService().sendTransaction({
    recipient: notificationRecipient,
    transaction: walletTransaction,
  })

  return result
}
