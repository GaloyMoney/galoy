import { constructPaymentFlowBuilder, getPriceRatioForLimits } from "./helpers"

import {
  IntraLedgerSendAttemptResult,
  LnSendAttemptResult,
  PaymentSendAttemptResultType,
} from "./ln-send-result"

import { reimburseFee } from "./reimburse-fee"

import { AccountValidator } from "@/domain/accounts"
import {
  decodeInvoice,
  defaultTimeToExpiryInSeconds,
  PaymentSendStatus,
  LnPaymentAttemptResult,
  LnPaymentAttemptResultType,
} from "@/domain/bitcoin/lightning"
import { ResourceExpiredLockServiceError } from "@/domain/lock"
import { AlreadyPaidError, CouldNotFindLightningPaymentFlowError } from "@/domain/errors"
import { DisplayAmountsConverter } from "@/domain/fiat"
import {
  InvalidLightningPaymentFlowBuilderStateError,
  LnFees,
  LnPaymentRequestInTransitError,
  LnPaymentRequestNonZeroAmountRequiredError,
  LnPaymentRequestZeroAmountRequiredError,
  WalletPriceRatio,
  toDisplayBaseAmount,
} from "@/domain/payments"
import {
  WalletCurrency,
  ErrorLevel,
  checkedToBtcPaymentAmount,
  checkedToUsdPaymentAmount,
} from "@/domain/shared"
import {
  checkedToWalletId,
  PaymentInitiationMethod,
  SettlementMethod,
} from "@/domain/wallets"

import { LndService } from "@/services/lnd"
import {
  LnPaymentsRepository,
  PaymentFlowStateRepository,
  WalletInvoicesRepository,
  WalletsRepository,
  UsersRepository,
  AccountsRepository,
} from "@/services/mongoose"

import { DealerPriceService } from "@/services/dealer-price"
import { LedgerService } from "@/services/ledger"
import { LockService } from "@/services/lock"
import { NotificationsService } from "@/services/notifications"

import * as LedgerFacade from "@/services/ledger/facade"
import {
  addAttributesToCurrentSpan,
  recordExceptionInCurrentSpan,
} from "@/services/tracing"

import {
  addContactsAfterSend,
  checkIntraledgerLimits,
  checkTradeIntraAccountLimits,
  checkWithdrawalLimits,
} from "@/app/accounts"
import { getCurrentPriceAsDisplayPriceRatio } from "@/app/prices"
import {
  getTransactionForWalletByJournalId,
  getTransactionsForWalletByPaymentHash,
  validateIsBtcWallet,
  validateIsUsdWallet,
} from "@/app/wallets"

const dealer = DealerPriceService()
const paymentFlowRepo = PaymentFlowStateRepository(defaultTimeToExpiryInSeconds)

export const payInvoiceByWalletId = async ({
  uncheckedPaymentRequest,
  memo,
  senderWalletId: uncheckedSenderWalletId,
  senderAccount,
}: PayInvoiceByWalletIdArgs): Promise<PaymentSendResult | ApplicationError> => {
  addAttributesToCurrentSpan({
    "payment.initiation_method": PaymentInitiationMethod.Lightning,
  })

  const validatedPaymentInputs = await validateInvoicePaymentInputs({
    uncheckedPaymentRequest,
    uncheckedSenderWalletId,
  })
  if (validatedPaymentInputs instanceof AlreadyPaidError) {
    const decodedInvoice = decodeInvoice(uncheckedPaymentRequest)
    if (decodedInvoice instanceof Error) return decodedInvoice
    return getAlreadyPaidResponse({
      walletId: uncheckedSenderWalletId,
      paymentHash: decodedInvoice.paymentHash,
    })
  }
  if (validatedPaymentInputs instanceof Error) {
    return validatedPaymentInputs
  }
  const paymentFlow = await getPaymentFlow(validatedPaymentInputs)
  if (paymentFlow instanceof Error) return paymentFlow

  // Get display currency price... add to payment flow builder?

  const {
    decodedInvoice,
    senderWallet: { id: senderWalletId },
  } = validatedPaymentInputs

  if (paymentFlow.settlementMethod !== SettlementMethod.IntraLedger) {
    return executePaymentViaLn({
      decodedInvoice,
      paymentFlow,
      senderAccount,
      memo,
    })
  }

  const { walletDescriptor: recipientWalletDescriptor } = paymentFlow.recipientDetails()
  if (!recipientWalletDescriptor) {
    return new InvalidLightningPaymentFlowBuilderStateError(
      "Expected recipient details missing",
    )
  }
  const recipientAccount = await AccountsRepository().findById(
    recipientWalletDescriptor.accountId,
  )
  if (recipientAccount instanceof Error) return recipientAccount

  const accountValidator = AccountValidator(recipientAccount)
  if (accountValidator instanceof Error) return accountValidator

  const paymentSendResult = await executePaymentViaIntraledger({
    paymentFlow,
    senderWalletId,
    senderAccount,
    recipientAccount,
    memo,
  })
  if (paymentSendResult instanceof Error) return paymentSendResult

  if (senderAccount.id !== recipientAccount.id) {
    const addContactResult = await addContactsAfterSend({
      senderAccount,
      recipientAccount,
    })
    if (addContactResult instanceof Error) {
      recordExceptionInCurrentSpan({ error: addContactResult, level: ErrorLevel.Warn })
    }
  }

  return paymentSendResult
}

const payNoAmountInvoiceByWalletId = async ({
  uncheckedPaymentRequest,
  amount,
  memo,
  senderWalletId: uncheckedSenderWalletId,
  senderAccount,
}: PayNoAmountInvoiceByWalletIdArgs): Promise<PaymentSendResult | ApplicationError> => {
  addAttributesToCurrentSpan({
    "payment.initiation_method": PaymentInitiationMethod.Lightning,
  })

  const validatedNoAmountPaymentInputs = await validateNoAmountInvoicePaymentInputs({
    uncheckedPaymentRequest,
    amount,
    uncheckedSenderWalletId,
    senderAccount,
  })
  if (validatedNoAmountPaymentInputs instanceof AlreadyPaidError) {
    const decodedInvoice = decodeInvoice(uncheckedPaymentRequest)
    if (decodedInvoice instanceof Error) return decodedInvoice
    return getAlreadyPaidResponse({
      walletId: uncheckedSenderWalletId,
      paymentHash: decodedInvoice.paymentHash,
    })
  }
  if (validatedNoAmountPaymentInputs instanceof Error) {
    return validatedNoAmountPaymentInputs
  }
  const paymentFlow = await getPaymentFlow(validatedNoAmountPaymentInputs)
  if (paymentFlow instanceof Error) return paymentFlow

  // Get display currency price... add to payment flow builder?

  const {
    decodedInvoice,
    senderWallet: { id: senderWalletId },
  } = validatedNoAmountPaymentInputs

  if (paymentFlow.settlementMethod !== SettlementMethod.IntraLedger) {
    return executePaymentViaLn({
      decodedInvoice,
      paymentFlow,
      senderAccount,
      memo,
    })
  }

  const { walletDescriptor: recipientWalletDescriptor } = paymentFlow.recipientDetails()
  if (!recipientWalletDescriptor) {
    return new InvalidLightningPaymentFlowBuilderStateError(
      "Expected recipient details missing",
    )
  }

  const recipientAccount = await AccountsRepository().findById(
    recipientWalletDescriptor.accountId,
  )
  if (recipientAccount instanceof Error) return recipientAccount

  const accountValidator = AccountValidator(recipientAccount)
  if (accountValidator instanceof Error) return accountValidator

  const paymentSendResult = await executePaymentViaIntraledger({
    paymentFlow,
    senderWalletId,
    senderAccount,
    recipientAccount,
    memo,
  })
  if (paymentSendResult instanceof Error) return paymentSendResult

  if (senderAccount.id !== recipientAccount.id) {
    const addContactResult = await addContactsAfterSend({
      senderAccount,
      recipientAccount,
    })
    if (addContactResult instanceof Error) {
      recordExceptionInCurrentSpan({ error: addContactResult, level: ErrorLevel.Warn })
    }
  }

  return paymentSendResult
}

export const payNoAmountInvoiceByWalletIdForBtcWallet = async (
  args: PayNoAmountInvoiceByWalletIdArgs,
): Promise<PaymentSendResult | ApplicationError> => {
  const validated = await validateIsBtcWallet(args.senderWalletId)
  return validated instanceof Error ? validated : payNoAmountInvoiceByWalletId(args)
}

export const payNoAmountInvoiceByWalletIdForUsdWallet = async (
  args: PayNoAmountInvoiceByWalletIdArgs,
): Promise<PaymentSendResult | ApplicationError> => {
  const validated = await validateIsUsdWallet(args.senderWalletId)
  return validated instanceof Error ? validated : payNoAmountInvoiceByWalletId(args)
}

const validateInvoicePaymentInputs = async ({
  uncheckedPaymentRequest,
  uncheckedSenderWalletId,
}: {
  uncheckedPaymentRequest: string
  uncheckedSenderWalletId: string
}): Promise<
  | {
      senderWallet: Wallet
      decodedInvoice: LnInvoice
      inputPaymentAmount: BtcPaymentAmount
    }
  | ApplicationError
> => {
  const senderWalletId = checkedToWalletId(uncheckedSenderWalletId)
  if (senderWalletId instanceof Error) return senderWalletId

  const decodedInvoice = decodeInvoice(uncheckedPaymentRequest)
  if (decodedInvoice instanceof Error) return decodedInvoice
  addAttributesToCurrentSpan({
    "payment.request.destination": decodedInvoice.destination,
    "payment.request.hash": decodedInvoice.paymentHash,
    "payment.request.description": decodedInvoice.description,
    "payment.request.expiresAt": decodedInvoice.expiresAt
      ? decodedInvoice.expiresAt.toISOString()
      : "undefined",
  })

  const { paymentAmount: lnInvoiceAmount } = decodedInvoice
  if (!(lnInvoiceAmount && lnInvoiceAmount.amount > 0n)) {
    return new LnPaymentRequestNonZeroAmountRequiredError()
  }

  const senderWallet = await WalletsRepository().findById(senderWalletId)
  if (senderWallet instanceof Error) return senderWallet

  const senderAccount = await AccountsRepository().findById(senderWallet.accountId)
  if (senderAccount instanceof Error) return senderAccount

  const accountValidator = AccountValidator(senderAccount)
  if (accountValidator instanceof Error) return accountValidator
  const validateWallet = accountValidator.validateWalletForAccount(senderWallet)
  if (validateWallet instanceof Error) return validateWallet

  return {
    senderWallet,
    decodedInvoice,
    inputPaymentAmount: lnInvoiceAmount,
  }
}

const validateNoAmountInvoicePaymentInputs = async <S extends WalletCurrency>({
  uncheckedPaymentRequest,
  amount,
  uncheckedSenderWalletId,
  senderAccount,
}: {
  uncheckedPaymentRequest: string
  amount: number
  uncheckedSenderWalletId: string
  senderAccount: Account
}): Promise<
  | {
      senderWallet: Wallet
      decodedInvoice: LnInvoice
      inputPaymentAmount: PaymentAmount<S>
      uncheckedAmount: number
    }
  | ApplicationError
> => {
  const senderWalletId = checkedToWalletId(uncheckedSenderWalletId)
  if (senderWalletId instanceof Error) return senderWalletId

  const decodedInvoice = decodeInvoice(uncheckedPaymentRequest)
  if (decodedInvoice instanceof Error) return decodedInvoice
  addAttributesToCurrentSpan({
    "payment.request.destination": decodedInvoice.destination,
    "payment.request.hash": decodedInvoice.paymentHash,
    "payment.request.description": decodedInvoice.description,
    "payment.request.expiresAt": decodedInvoice.expiresAt
      ? decodedInvoice.expiresAt.toISOString()
      : "undefined",
  })

  const { paymentAmount: lnInvoiceAmount } = decodedInvoice
  if (lnInvoiceAmount && lnInvoiceAmount.amount > 0n) {
    return new LnPaymentRequestZeroAmountRequiredError()
  }

  const senderWallet = await WalletsRepository().findById(senderWalletId)
  if (senderWallet instanceof Error) return senderWallet

  const accountValidator = AccountValidator(senderAccount)
  if (accountValidator instanceof Error) return accountValidator
  const validateWallet = accountValidator.validateWalletForAccount(senderWallet)
  if (validateWallet instanceof Error) return validateWallet

  const inputPaymentAmount =
    senderWallet.currency === WalletCurrency.Btc
      ? checkedToBtcPaymentAmount(amount)
      : checkedToUsdPaymentAmount(amount)
  if (inputPaymentAmount instanceof Error) return inputPaymentAmount

  return {
    senderWallet,
    decodedInvoice,
    inputPaymentAmount: inputPaymentAmount as PaymentAmount<S>,
    uncheckedAmount: amount,
  }
}

const getPaymentFlow = async <S extends WalletCurrency, R extends WalletCurrency>({
  senderWallet,
  decodedInvoice,
  inputPaymentAmount,
  uncheckedAmount,
}: {
  senderWallet: WalletDescriptor<S>
  decodedInvoice: LnInvoice
  inputPaymentAmount: PaymentAmount<S>
  uncheckedAmount?: number | undefined
}): Promise<PaymentFlow<S, R> | ApplicationError> => {
  let paymentFlow = await paymentFlowRepo.findLightningPaymentFlow<S, R>({
    walletId: senderWallet.id,
    paymentHash: decodedInvoice.paymentHash,
    inputAmount: inputPaymentAmount.amount,
  })
  addAttributesToCurrentSpan({
    "payment.paymentFlow.existsFromProbe": `${!(
      paymentFlow instanceof CouldNotFindLightningPaymentFlowError
    )}`,
  })

  if (paymentFlow instanceof CouldNotFindLightningPaymentFlowError) {
    const builderWithConversion = await constructPaymentFlowBuilder<S, R>({
      uncheckedAmount,
      senderWallet,
      invoice: decodedInvoice,
      hedgeBuyUsd: {
        usdFromBtc: dealer.getCentsFromSatsForImmediateBuy,
        btcFromUsd: dealer.getSatsFromCentsForImmediateBuy,
      },
      hedgeSellUsd: {
        usdFromBtc: dealer.getCentsFromSatsForImmediateSell,
        btcFromUsd: dealer.getSatsFromCentsForImmediateSell,
      },
    })
    if (builderWithConversion instanceof Error) return builderWithConversion

    paymentFlow = await builderWithConversion.withoutRoute()
    if (paymentFlow instanceof Error) return paymentFlow

    const persistedPayment = await paymentFlowRepo.persistNew(paymentFlow)
    if (persistedPayment instanceof Error) return persistedPayment
  }
  if (paymentFlow instanceof Error) return paymentFlow

  addAttributesToCurrentSpan({
    "payment.amount": paymentFlow.btcPaymentAmount.amount.toString(),
    "payment.finalRecipient": JSON.stringify(paymentFlow.recipientWalletDescriptor()),
  })

  return paymentFlow
}

const executePaymentViaIntraledger = async <
  S extends WalletCurrency,
  R extends WalletCurrency,
>({
  paymentFlow,
  senderAccount,
  senderWalletId,
  recipientAccount,
  memo,
}: {
  paymentFlow: PaymentFlow<S, R>
  senderAccount: Account
  senderWalletId: WalletId
  recipientAccount: Account
  memo: string | null
}): Promise<PaymentSendResult | ApplicationError> => {
  addAttributesToCurrentSpan({
    "payment.settlement_method": SettlementMethod.IntraLedger,
  })

  const priceRatioForLimits = await getPriceRatioForLimits(paymentFlow.paymentAmounts())
  if (priceRatioForLimits instanceof Error) return priceRatioForLimits

  const paymentHash = paymentFlow.paymentHashForFlow()
  if (paymentHash instanceof Error) return paymentHash

  const checkLimits =
    senderAccount.id === recipientAccount.id
      ? checkTradeIntraAccountLimits
      : checkIntraledgerLimits
  const limitCheck = await checkLimits({
    amount: paymentFlow.usdPaymentAmount,
    accountId: senderAccount.id,
    priceRatio: priceRatioForLimits,
  })
  if (limitCheck instanceof Error) return limitCheck

  const { walletDescriptor: recipientWalletDescriptor } = paymentFlow.recipientDetails()
  if (!recipientWalletDescriptor) {
    return new InvalidLightningPaymentFlowBuilderStateError(
      "Expected recipient details missing",
    )
  }

  const recipientAsNotificationRecipient = {
    accountId: recipientAccount.id,
    walletId: recipientWalletDescriptor.id,
    userId: recipientAccount.kratosUserId,
    level: recipientAccount.level,
  }

  const senderUser = await UsersRepository().findById(senderAccount.kratosUserId)
  if (senderUser instanceof Error) return senderUser

  const senderAsNotificationRecipient = {
    accountId: senderAccount.id,
    walletId: senderWalletId,
    userId: senderAccount.kratosUserId,
    level: senderAccount.level,
  }

  const paymentSendAttemptResult = await LockService().lockWalletId(
    senderWalletId,
    async (signal) =>
      lockedPaymentViaIntraledgerSteps({
        signal,

        paymentHash,
        paymentFlow,
        senderDisplayCurrency: senderAccount.displayCurrency,
        senderUsername: senderAccount.username,
        recipientDisplayCurrency: recipientAccount.displayCurrency,
        recipientUsername: recipientAccount.username,

        memo,
      }),
  )
  if (paymentSendAttemptResult instanceof Error) return paymentSendAttemptResult

  switch (paymentSendAttemptResult.type) {
    case PaymentSendAttemptResultType.Error:
      return paymentSendAttemptResult.error

    case PaymentSendAttemptResultType.AlreadyPaid:
      return getAlreadyPaidResponse({
        walletId: senderWalletId,
        paymentHash,
      })
  }

  const { journalId } = paymentSendAttemptResult

  const recipientWalletTransaction = await getTransactionForWalletByJournalId({
    walletId: recipientWalletDescriptor.id,
    journalId,
  })
  if (recipientWalletTransaction instanceof Error) {
    return recipientWalletTransaction
  }
  NotificationsService().sendTransaction({
    recipient: recipientAsNotificationRecipient,
    transaction: recipientWalletTransaction,
  })

  const senderWalletTransaction = await getTransactionForWalletByJournalId({
    walletId: senderWalletId,
    journalId,
  })
  if (senderWalletTransaction instanceof Error) {
    return senderWalletTransaction
  }
  NotificationsService().sendTransaction({
    recipient: senderAsNotificationRecipient,
    transaction: senderWalletTransaction,
  })

  return {
    status: PaymentSendStatus.Success,
    transaction: senderWalletTransaction,
  }
}

const lockedPaymentViaIntraledgerSteps = async ({
  signal,

  paymentHash,
  paymentFlow,
  senderDisplayCurrency,
  senderUsername,
  recipientDisplayCurrency,
  recipientUsername,

  memo,
}: {
  signal: WalletIdAbortSignal

  paymentHash: PaymentHash
  paymentFlow: PaymentFlow<WalletCurrency, WalletCurrency>
  senderDisplayCurrency: DisplayCurrency
  senderUsername: Username | undefined
  recipientDisplayCurrency: DisplayCurrency
  recipientUsername: Username | undefined

  memo: string | null
}): Promise<IntraLedgerSendAttemptResult> => {
  const senderWalletDescriptor = paymentFlow.senderWalletDescriptor()

  const { walletDescriptor: recipientWalletDescriptor, recipientPubkey } =
    paymentFlow.recipientDetails()
  if (!(recipientWalletDescriptor && recipientPubkey)) {
    return IntraLedgerSendAttemptResult.err(
      new InvalidLightningPaymentFlowBuilderStateError(
        "Expected recipient details missing",
      ),
    )
  }

  const ledgerService = LedgerService()

  const recorded = await ledgerService.isLnTxRecorded(paymentHash)
  if (recorded instanceof Error) return IntraLedgerSendAttemptResult.err(recorded)
  if (recorded) {
    return IntraLedgerSendAttemptResult.alreadyPaid()
  }

  const balance = await ledgerService.getWalletBalanceAmount(senderWalletDescriptor)
  if (balance instanceof Error) return IntraLedgerSendAttemptResult.err(balance)

  const balanceCheck = paymentFlow.checkBalanceForSend(balance)
  if (balanceCheck instanceof Error) return IntraLedgerSendAttemptResult.err(balanceCheck)

  const senderDisplayPriceRatio = await getCurrentPriceAsDisplayPriceRatio({
    currency: senderDisplayCurrency,
  })
  if (senderDisplayPriceRatio instanceof Error) {
    return IntraLedgerSendAttemptResult.err(senderDisplayPriceRatio)
  }
  const { displayAmount: senderDisplayAmount, displayFee: senderDisplayFee } =
    DisplayAmountsConverter(senderDisplayPriceRatio).convert(paymentFlow)

  const recipientDisplayPriceRatio = await getCurrentPriceAsDisplayPriceRatio({
    currency: recipientDisplayCurrency,
  })
  if (recipientDisplayPriceRatio instanceof Error) {
    return IntraLedgerSendAttemptResult.err(recipientDisplayPriceRatio)
  }
  const { displayAmount: recipientDisplayAmount, displayFee: recipientDisplayFee } =
    DisplayAmountsConverter(recipientDisplayPriceRatio).convert(paymentFlow)

  if (signal.aborted) {
    return IntraLedgerSendAttemptResult.err(
      new ResourceExpiredLockServiceError(signal.error?.message),
    )
  }

  let metadata: AddLnIntraledgerSendLedgerMetadata | AddLnTradeIntraAccountLedgerMetadata
  let additionalDebitMetadata: {
    [key: string]:
      | Username
      | DisplayCurrencyBaseAmount
      | DisplayCurrency
      | string
      | undefined
  } = {}
  let additionalCreditMetadata: {
    [key: string]: Username | DisplayCurrencyBaseAmount | DisplayCurrency | undefined
  } = {}
  let additionalInternalMetadata: {
    [key: string]: DisplayCurrencyBaseAmount | DisplayCurrency | undefined
  } = {}
  if (senderWalletDescriptor.accountId === recipientWalletDescriptor.accountId) {
    ;({
      metadata,
      debitAccountAdditionalMetadata: additionalDebitMetadata,
      creditAccountAdditionalMetadata: additionalCreditMetadata,
      internalAccountsAdditionalMetadata: additionalInternalMetadata,
    } = LedgerFacade.LnTradeIntraAccountLedgerMetadata({
      paymentHash,
      pubkey: recipientPubkey,
      paymentAmounts: paymentFlow,

      senderAmountDisplayCurrency: toDisplayBaseAmount(senderDisplayAmount),
      senderFeeDisplayCurrency: toDisplayBaseAmount(senderDisplayFee),
      senderDisplayCurrency,

      memoOfPayer: memo || undefined,
    }))
  } else {
    ;({
      metadata,
      debitAccountAdditionalMetadata: additionalDebitMetadata,
      creditAccountAdditionalMetadata: additionalCreditMetadata,
      internalAccountsAdditionalMetadata: additionalInternalMetadata,
    } = LedgerFacade.LnIntraledgerLedgerMetadata({
      paymentHash,
      pubkey: recipientPubkey,
      paymentAmounts: paymentFlow,

      senderAmountDisplayCurrency: toDisplayBaseAmount(senderDisplayAmount),
      senderFeeDisplayCurrency: toDisplayBaseAmount(senderDisplayFee),
      senderDisplayCurrency,

      recipientAmountDisplayCurrency: toDisplayBaseAmount(recipientDisplayAmount),
      recipientFeeDisplayCurrency: toDisplayBaseAmount(recipientDisplayFee),
      recipientDisplayCurrency,

      memoOfPayer: memo || undefined,
      senderUsername,
      recipientUsername,
    }))
  }

  const journal = await LedgerFacade.recordIntraledger({
    description: paymentFlow.descriptionFromInvoice,
    amount: {
      btc: paymentFlow.btcPaymentAmount,
      usd: paymentFlow.usdPaymentAmount,
    },
    senderWalletDescriptor,
    recipientWalletDescriptor,
    metadata,
    additionalDebitMetadata,
    additionalCreditMetadata,
    additionalInternalMetadata,
  })
  if (journal instanceof Error) return IntraLedgerSendAttemptResult.err(journal)

  const lndService = LndService()
  if (lndService instanceof Error) return IntraLedgerSendAttemptResult.err(lndService)

  const deletedLnInvoice = await lndService.cancelInvoice({
    pubkey: recipientPubkey,
    paymentHash,
  })
  if (deletedLnInvoice instanceof Error) {
    return IntraLedgerSendAttemptResult.err(deletedLnInvoice)
  }

  const newWalletInvoice = await WalletInvoicesRepository().markAsPaid(paymentHash)
  if (newWalletInvoice instanceof Error) {
    return IntraLedgerSendAttemptResult.err(newWalletInvoice)
  }

  return IntraLedgerSendAttemptResult.ok(journal.journalId)
}

const executePaymentViaLn = async ({
  decodedInvoice,
  paymentFlow,
  senderAccount,
  memo,
}: {
  decodedInvoice: LnInvoice
  paymentFlow: PaymentFlow<WalletCurrency, WalletCurrency>
  senderAccount: Account
  memo: string | null
}): Promise<PaymentSendResult | ApplicationError> => {
  addAttributesToCurrentSpan({
    "payment.settlement_method": SettlementMethod.Lightning,
  })

  const { id: senderWalletId } = paymentFlow.senderWalletDescriptor()

  const priceRatioForLimits = await getPriceRatioForLimits(paymentFlow.paymentAmounts())
  if (priceRatioForLimits instanceof Error) return priceRatioForLimits

  const limitCheck = await checkWithdrawalLimits({
    amount: paymentFlow.usdPaymentAmount,
    accountId: senderAccount.id,
    priceRatio: priceRatioForLimits,
  })
  if (limitCheck instanceof Error) return limitCheck

  const accountWalletDescriptors =
    await WalletsRepository().findAccountWalletsByAccountId(senderAccount.id)
  if (accountWalletDescriptors instanceof Error) return accountWalletDescriptors
  const walletIds = [accountWalletDescriptors.BTC.id, accountWalletDescriptors.USD.id]

  const notificationRecipient = {
    accountId: senderAccount.id,
    walletId: senderWalletId,
    userId: senderAccount.kratosUserId,
    level: senderAccount.level,
  }

  const paymentSendAttemptResult = await LockService().lockWalletId(
    senderWalletId,
    (signal) =>
      lockedPaymentViaLnSteps({
        signal,

        decodedInvoice,
        paymentFlow,
        senderDisplayCurrency: senderAccount.displayCurrency,
        memo,

        walletIds,
      }),
  )
  if (paymentSendAttemptResult instanceof Error) return paymentSendAttemptResult
  if (paymentSendAttemptResult.type === PaymentSendAttemptResultType.Error) {
    return paymentSendAttemptResult.error
  }

  const walletTransaction = await getTransactionForWalletByJournalId({
    walletId: senderWalletId,
    journalId: paymentSendAttemptResult.journalId,
  })
  if (walletTransaction instanceof Error) return walletTransaction
  NotificationsService().sendTransaction({
    recipient: notificationRecipient,
    transaction: walletTransaction,
  })

  const { paymentHash } = decodedInvoice
  switch (paymentSendAttemptResult.type) {
    case PaymentSendAttemptResultType.ErrorWithJournal:
      return paymentSendAttemptResult.error

    case PaymentSendAttemptResultType.Pending:
      return getPendingPaymentResponse({
        walletId: senderWalletId,
        paymentHash,
      })

    case PaymentSendAttemptResultType.AlreadyPaid:
      return getAlreadyPaidResponse({
        walletId: senderWalletId,
        paymentHash,
      })

    default:
      return {
        status: PaymentSendStatus.Success,
        transaction: walletTransaction,
      }
  }
}

const lockedPaymentViaLnSteps = async ({
  signal,

  decodedInvoice,
  paymentFlow,
  senderDisplayCurrency,
  memo,

  walletIds,
}: {
  signal: WalletIdAbortSignal

  decodedInvoice: LnInvoice
  paymentFlow: PaymentFlow<WalletCurrency, WalletCurrency>
  senderDisplayCurrency: DisplayCurrency
  memo: string | null

  walletIds: WalletId[]
}): Promise<LnSendAttemptResult> => {
  const { paymentHash } = decodedInvoice
  const { rawRoute, outgoingNodePubkey } = paymentFlow.routeDetails()
  const senderWalletDescriptor = paymentFlow.senderWalletDescriptor()

  addAttributesToCurrentSpan({
    "payment.context": "executePaymentViaLn",
    "payment.request": decodedInvoice.paymentRequest,
    "payment.request.description": decodedInvoice.description,
    "payment.request.destination": decodedInvoice.destination,
    "payment.request.paymentHash": paymentHash,
    "payment.btcAmount": paymentFlow.btcPaymentAmount.amount.toString(),
    "payment.btcFee": paymentFlow.btcProtocolAndBankFee.amount.toString(),
    "payment.usdAmount": paymentFlow.usdPaymentAmount.amount.toString(),
    "payment.usdFee": paymentFlow.usdProtocolAndBankFee.amount.toString(),
    "payment.senderWalletCurrency": senderWalletDescriptor.currency,
  })

  // Execute checks before payment
  const ledgerService = LedgerService()

  const ledgerTransactions = await ledgerService.getTransactionsByHash(paymentHash)
  if (ledgerTransactions instanceof Error) {
    return LnSendAttemptResult.err(ledgerTransactions)
  }

  const pendingPayment = ledgerTransactions.find((tx) => tx.pendingConfirmation)
  if (pendingPayment) return LnSendAttemptResult.err(new LnPaymentRequestInTransitError())

  const balance = await ledgerService.getWalletBalanceAmount(senderWalletDescriptor)
  if (balance instanceof Error) return LnSendAttemptResult.err(balance)
  const balanceCheck = paymentFlow.checkBalanceForSend(balance)
  if (balanceCheck instanceof Error) return LnSendAttemptResult.err(balanceCheck)

  // Prepare ledger transaction
  const lndService = LndService()
  if (lndService instanceof Error) return LnSendAttemptResult.err(lndService)

  const displayPriceRatio = await getCurrentPriceAsDisplayPriceRatio({
    currency: senderDisplayCurrency,
  })
  if (displayPriceRatio instanceof Error) {
    return LnSendAttemptResult.err(displayPriceRatio)
  }
  const { displayAmount, displayFee } =
    DisplayAmountsConverter(displayPriceRatio).convert(paymentFlow)

  if (signal.aborted) {
    return LnSendAttemptResult.err(
      new ResourceExpiredLockServiceError(signal.error?.message),
    )
  }

  const { metadata, debitAccountAdditionalMetadata, internalAccountsAdditionalMetadata } =
    LedgerFacade.LnSendLedgerMetadata({
      amountDisplayCurrency: toDisplayBaseAmount(displayAmount),
      feeDisplayCurrency: toDisplayBaseAmount(displayFee),
      displayCurrency: senderDisplayCurrency,

      paymentAmounts: paymentFlow,
      pubkey: outgoingNodePubkey,
      paymentHash,
      feeKnownInAdvance: !!rawRoute,

      memoOfPayer: memo || paymentFlow.descriptionFromInvoice,
    })

  const walletPriceRatio = WalletPriceRatio({
    usd: paymentFlow.usdPaymentAmount,
    btc: paymentFlow.btcPaymentAmount,
  })
  if (walletPriceRatio instanceof Error) return LnSendAttemptResult.err(walletPriceRatio)

  // Record pending payment entries
  const journal = await LedgerFacade.recordSendOffChain({
    description: paymentFlow.descriptionFromInvoice || memo || "",
    amountToDebitSender: {
      btc: {
        currency: paymentFlow.btcPaymentAmount.currency,
        amount:
          paymentFlow.btcPaymentAmount.amount + paymentFlow.btcProtocolAndBankFee.amount,
      },
      usd: {
        currency: paymentFlow.usdPaymentAmount.currency,
        amount:
          paymentFlow.usdPaymentAmount.amount + paymentFlow.usdProtocolAndBankFee.amount,
      },
    },
    senderWalletDescriptor,
    metadata,
    additionalDebitMetadata: debitAccountAdditionalMetadata,
    additionalInternalMetadata: internalAccountsAdditionalMetadata,
  })
  if (journal instanceof Error) return LnSendAttemptResult.err(journal)
  const { journalId } = journal

  // Execute payment
  let payResult: LnPaymentAttemptResult
  if (rawRoute) {
    payResult = await lndService.payInvoiceViaRoutes({
      paymentHash,
      rawRoute,
      pubkey: outgoingNodePubkey,
    })
  } else {
    const maxFeeCheckArgs = {
      maxFeeAmount: paymentFlow.btcProtocolAndBankFee,
      btcPaymentAmount: paymentFlow.btcPaymentAmount,
      usdPaymentAmount: paymentFlow.usdPaymentAmount,
      priceRatio: walletPriceRatio,
      senderWalletCurrency: senderWalletDescriptor.currency,
      isFromNoAmountInvoice:
        decodedInvoice.amount === 0 || decodedInvoice.amount === null,
    }
    const maxFeeCheck = LnFees().verifyMaxFee(maxFeeCheckArgs)

    payResult =
      maxFeeCheck instanceof Error
        ? LnPaymentAttemptResult.err(maxFeeCheck)
        : await lndService.payInvoiceViaPaymentDetails({
            ...maxFeeCheckArgs,
            decodedInvoice,
          })
  }

  if (!(payResult.type === LnPaymentAttemptResultType.AlreadyPaid)) {
    await LnPaymentsRepository().persistNew({
      paymentHash: decodedInvoice.paymentHash,
      paymentRequest: decodedInvoice.paymentRequest,
      sentFromPubkey:
        payResult.type === LnPaymentAttemptResultType.Error
          ? outgoingNodePubkey
          : payResult.result.sentFromPubkey,
    })

    if (payResult.type === LnPaymentAttemptResultType.Ok)
      await LedgerFacade.updateMetadataByHash({
        hash: paymentHash,
        revealedPreImage: payResult.result.revealedPreImage,
      })
  }

  if (
    outgoingNodePubkey === undefined &&
    !(payResult.type === LnPaymentAttemptResultType.Error)
  ) {
    const updatedPubkey = await LedgerFacade.updatePubkeyByHash({
      paymentHash,
      pubkey: payResult.result.sentFromPubkey,
    })
    if (updatedPubkey instanceof Error) {
      recordExceptionInCurrentSpan({ error: updatedPubkey })
    }
  }

  if (payResult.type === LnPaymentAttemptResultType.Pending) {
    paymentFlow.paymentSentAndPending = true
    const updateResult = await paymentFlowRepo.updateLightningPaymentFlow(paymentFlow)
    if (updateResult instanceof Error) {
      recordExceptionInCurrentSpan({ error: updateResult })
    }

    const updateJournalTxnsState = await LedgerFacade.updateLnPaymentState({
      walletIds,
      paymentHash,
      journalId,
    })
    if (updateJournalTxnsState instanceof Error) {
      return LnSendAttemptResult.err(updateJournalTxnsState)
    }
    return LnSendAttemptResult.pending(journalId)
  }

  // Settle and record reversion entries
  if (
    payResult.type === LnPaymentAttemptResultType.Error ||
    payResult.type === LnPaymentAttemptResultType.AlreadyPaid
  ) {
    const settled = await LedgerFacade.settlePendingLnSend(paymentHash)
    if (settled instanceof Error) return LnSendAttemptResult.err(settled)

    const voided = await LedgerFacade.recordLnSendRevert({
      journalId,
      paymentHash,
    })
    if (voided instanceof Error) return LnSendAttemptResult.err(voided)

    const updateJournalTxnsState = await LedgerFacade.updateLnPaymentState({
      walletIds,
      paymentHash,
      journalId,
    })
    if (updateJournalTxnsState instanceof Error) {
      return LnSendAttemptResult.err(updateJournalTxnsState)
    }

    return payResult.type === LnPaymentAttemptResultType.AlreadyPaid
      ? LnSendAttemptResult.alreadyPaid(journalId)
      : LnSendAttemptResult.errWithJournal({ journalId, error: payResult.error })
  }

  // Settle and conditionally record reimbursement entries
  const settled = await LedgerFacade.settlePendingLnSend(paymentHash)
  if (settled instanceof Error) return LnSendAttemptResult.err(settled)

  if (!rawRoute) {
    const reimbursed = await reimburseFee({
      paymentFlow,
      senderDisplayAmount: toDisplayBaseAmount(displayAmount),
      senderDisplayCurrency,
      journalId,
      actualFee: payResult.result.roundedUpFee,
      revealedPreImage: payResult.result.revealedPreImage,
    })
    if (reimbursed instanceof Error) return LnSendAttemptResult.err(reimbursed)
  }

  const updateJournalTxnsState = await LedgerFacade.updateLnPaymentState({
    walletIds,
    paymentHash,
    journalId,
  })
  if (updateJournalTxnsState instanceof Error) {
    return LnSendAttemptResult.err(updateJournalTxnsState)
  }
  return LnSendAttemptResult.ok(journalId)
}

const getAlreadyPaidResponse = async (args: {
  walletId: WalletId
  paymentHash: PaymentHash
}): Promise<PaymentSendResult | ApplicationError> =>
  getPaymentSendResponse({
    ...args,
    status: PaymentSendStatus.AlreadyPaid,
  })

const getPendingPaymentResponse = async (args: {
  walletId: WalletId
  paymentHash: PaymentHash
}): Promise<PaymentSendResult | ApplicationError> =>
  getPaymentSendResponse({
    ...args,
    status: PaymentSendStatus.Pending,
  })

const getPaymentSendResponse = async ({
  walletId,
  paymentHash,
  status,
}: {
  walletId: WalletId
  paymentHash: PaymentHash
  status: PaymentSendStatus
}): Promise<PaymentSendResult | ApplicationError> => {
  const transactions = await getTransactionsForWalletByPaymentHash({
    walletId,
    paymentHash,
  })
  if (transactions instanceof Error) return transactions
  return {
    status,
    transaction: transactions.find((t) => t.settlementAmount < 0) || transactions[0],
  }
}
