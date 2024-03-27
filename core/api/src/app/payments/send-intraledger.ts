import { getPriceRatioForLimits } from "./helpers"

import { getValuesToSkipProbe } from "@/config"

import {
  addContactsAfterSend,
  checkIntraledgerLimits,
  checkTradeIntraAccountLimits,
} from "@/app/accounts"
import {
  btcFromUsdMidPriceFn,
  getCurrentPriceAsDisplayPriceRatio,
  usdFromBtcMidPriceFn,
} from "@/app/prices"
import {
  getTransactionForWalletByJournalId,
  validateIsBtcWallet,
  validateIsUsdWallet,
} from "@/app/wallets"

import {
  InvalidLightningPaymentFlowBuilderStateError,
  LightningPaymentFlowBuilder,
  toDisplayBaseAmount,
} from "@/domain/payments"
import { AccountValidator } from "@/domain/accounts"
import { DisplayAmountsConverter } from "@/domain/fiat"
import { ErrorLevel } from "@/domain/shared"
import { PaymentSendStatus } from "@/domain/bitcoin/lightning"
import { ResourceExpiredLockServiceError } from "@/domain/lock"
import { checkedToWalletId, SettlementMethod } from "@/domain/wallets"

import { LockService } from "@/services/lock"
import { LedgerService } from "@/services/ledger"
import * as LedgerFacade from "@/services/ledger/facade"
import { DealerPriceService } from "@/services/dealer-price"
import {
  addAttributesToCurrentSpan,
  recordExceptionInCurrentSpan,
} from "@/services/tracing"
import { AccountsRepository, WalletsRepository } from "@/services/mongoose"
import { NotificationsService } from "@/services/notifications"

const dealer = DealerPriceService()

const intraledgerPaymentSendWalletId = async ({
  recipientWalletId: uncheckedRecipientWalletId,
  senderAccount,
  amount: uncheckedAmount,
  memo,
  senderWalletId: uncheckedSenderWalletId,
}: IntraLedgerPaymentSendWalletIdArgs): Promise<PaymentSendResult | ApplicationError> => {
  const validatedPaymentInputs = await validateIntraledgerPaymentInputs({
    uncheckedSenderWalletId,
    uncheckedRecipientWalletId,
  })
  if (validatedPaymentInputs instanceof Error) return validatedPaymentInputs

  const { senderWallet, recipientWallet, recipientAccount } = validatedPaymentInputs

  const { currency: recipientWalletCurrency } = recipientWallet
  const {
    id: recipientAccountId,
    username: recipientUsername,
    kratosUserId: recipientUserId,
  } = recipientAccount

  const paymentBuilder = LightningPaymentFlowBuilder({
    localNodeIds: [],
    skipProbe: getValuesToSkipProbe(),
  })
  const builderWithInvoice = paymentBuilder.withoutInvoice({
    uncheckedAmount,
    description: memo || "",
  })

  const builderWithSenderWallet = builderWithInvoice.withSenderWallet(senderWallet)

  const wallets =
    await WalletsRepository().findAccountWalletsByAccountId(recipientAccountId)
  if (wallets instanceof Error) return wallets
  const recipientArgsForBuilder = {
    defaultWalletCurrency: recipientWalletCurrency,
    recipientWalletDescriptors: wallets,
    username: recipientUsername,
    userId: recipientUserId,
    pubkey: undefined,
    usdPaymentAmount: undefined,
  }

  const builderAfterRecipientStep = builderWithSenderWallet.withRecipientWallet(
    recipientArgsForBuilder,
  )

  const builderWithConversion = builderAfterRecipientStep.withConversion({
    mid: { usdFromBtc: usdFromBtcMidPriceFn, btcFromUsd: btcFromUsdMidPriceFn },
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

  const paymentFlow = await builderWithConversion.withoutRoute()
  if (paymentFlow instanceof Error) return paymentFlow

  addAttributesToCurrentSpan({
    "payment.intraLedger.inputAmount": paymentFlow.inputAmount.toString(),
    "payment.intraLedger.hash": paymentFlow.intraLedgerHash,
    "payment.intraLedger.description": memo || "",
    "payment.finalRecipient": JSON.stringify(paymentFlow.recipientWalletDescriptor()),
  })

  const paymentSendResult = await executePaymentViaIntraledger({
    paymentFlow,
    senderAccount,
    senderWalletId: senderWallet.id,
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

export const intraledgerPaymentSendWalletIdForBtcWallet = async (
  args: IntraLedgerPaymentSendWalletIdArgs,
): Promise<PaymentSendResult | ApplicationError> => {
  const validated = await validateIsBtcWallet(args.senderWalletId)
  return validated instanceof Error ? validated : intraledgerPaymentSendWalletId(args)
}

export const intraledgerPaymentSendWalletIdForUsdWallet = async (
  args: IntraLedgerPaymentSendWalletIdArgs,
): Promise<PaymentSendResult | ApplicationError> => {
  const validated = await validateIsUsdWallet(args.senderWalletId)
  return validated instanceof Error ? validated : intraledgerPaymentSendWalletId(args)
}

const validateIntraledgerPaymentInputs = async ({
  uncheckedSenderWalletId,
  uncheckedRecipientWalletId,
}: {
  uncheckedSenderWalletId: string
  uncheckedRecipientWalletId: string
}): Promise<
  | { senderWallet: Wallet; recipientWallet: Wallet; recipientAccount: Account }
  | ApplicationError
> => {
  const senderWalletId = checkedToWalletId(uncheckedSenderWalletId)
  if (senderWalletId instanceof Error) return senderWalletId

  const senderWallet = await WalletsRepository().findById(senderWalletId)
  if (senderWallet instanceof Error) return senderWallet

  const senderAccount = await AccountsRepository().findById(senderWallet.accountId)
  if (senderAccount instanceof Error) return senderAccount

  const senderAccountValidator = AccountValidator(senderAccount)
  if (senderAccountValidator instanceof Error) return senderAccountValidator

  const recipientWalletId = checkedToWalletId(uncheckedRecipientWalletId)
  if (recipientWalletId instanceof Error) return recipientWalletId

  const recipientWallet = await WalletsRepository().findById(recipientWalletId)
  if (recipientWallet instanceof Error) return recipientWallet

  const recipientAccount = await AccountsRepository().findById(recipientWallet.accountId)
  if (recipientAccount instanceof Error) return recipientAccount

  const recipientAccountValidator = AccountValidator(recipientAccount)
  if (recipientAccountValidator instanceof Error) return recipientAccountValidator

  addAttributesToCurrentSpan({
    "payment.intraLedger.senderWalletId": senderWalletId,
    "payment.intraLedger.senderWalletCurrency": senderWallet.currency,
    "payment.intraLedger.recipientWalletId": recipientWalletId,
    "payment.intraLedger.recipientWalletCurrency": recipientWallet.currency,
  })

  return {
    senderWallet,
    recipientWallet,
    recipientAccount,
  }
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

  const senderAsNotificationRecipient = {
    accountId: senderAccount.id,
    walletId: senderWalletId,
    userId: senderAccount.kratosUserId,
    level: senderAccount.level,
  }

  const journalId = await LockService().lockWalletId(senderWalletId, async (signal) =>
    lockedPaymentViaIntraledgerSteps({
      signal,

      paymentFlow,
      senderDisplayCurrency: senderAccount.displayCurrency,
      senderUsername: senderAccount.username,
      recipientDisplayCurrency: recipientAccount.displayCurrency,
      recipientUsername: recipientAccount.username,

      memo,
    }),
  )
  if (journalId instanceof Error) return journalId

  const recipientWalletTransaction = await getTransactionForWalletByJournalId({
    walletId: recipientWalletDescriptor.id,
    journalId,
  })
  if (recipientWalletTransaction instanceof Error) return recipientWalletTransaction
  NotificationsService().sendTransaction({
    recipient: recipientAsNotificationRecipient,
    transaction: recipientWalletTransaction,
  })

  const senderWalletTransaction = await getTransactionForWalletByJournalId({
    walletId: senderWalletId,
    journalId,
  })
  if (senderWalletTransaction instanceof Error) return senderWalletTransaction
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

  paymentFlow,
  senderDisplayCurrency,
  senderUsername,
  recipientDisplayCurrency,
  recipientUsername,

  memo,
}: {
  signal: WalletIdAbortSignal

  paymentFlow: PaymentFlow<WalletCurrency, WalletCurrency>
  senderDisplayCurrency: DisplayCurrency
  senderUsername: Username | undefined
  recipientDisplayCurrency: DisplayCurrency
  recipientUsername: Username | undefined

  memo: string | null
}): Promise<LedgerJournalId | ApplicationError> => {
  const senderWalletDescriptor = paymentFlow.senderWalletDescriptor()
  const recipientWalletDescriptor = paymentFlow.recipientWalletDescriptor()
  if (!recipientWalletDescriptor) {
    return new InvalidLightningPaymentFlowBuilderStateError(
      "Expected recipient details missing",
    )
  }

  const balance = await LedgerService().getWalletBalanceAmount(senderWalletDescriptor)
  if (balance instanceof Error) return balance

  const balanceCheck = paymentFlow.checkBalanceForSend(balance)
  if (balanceCheck instanceof Error) return balanceCheck

  const senderDisplayPriceRatio = await getCurrentPriceAsDisplayPriceRatio({
    currency: senderDisplayCurrency,
  })
  if (senderDisplayPriceRatio instanceof Error) return senderDisplayPriceRatio
  const { displayAmount: senderDisplayAmount, displayFee: senderDisplayFee } =
    DisplayAmountsConverter(senderDisplayPriceRatio).convert(paymentFlow)

  const recipientDisplayPriceRatio = await getCurrentPriceAsDisplayPriceRatio({
    currency: recipientDisplayCurrency,
  })
  if (recipientDisplayPriceRatio instanceof Error) return recipientDisplayPriceRatio
  const { displayAmount: recipientDisplayAmount, displayFee: recipientDisplayFee } =
    DisplayAmountsConverter(recipientDisplayPriceRatio).convert(paymentFlow)

  if (signal.aborted) {
    return new ResourceExpiredLockServiceError(signal.error?.message)
  }

  let metadata:
    | AddWalletIdIntraledgerSendLedgerMetadata
    | AddWalletIdTradeIntraAccountLedgerMetadata
  let additionalDebitMetadata: {
    [key: string]: Username | DisplayCurrencyBaseAmount | DisplayCurrency | undefined
  } = {}
  let additionalCreditMetadata: {
    [key: string]: DisplayCurrencyBaseAmount | DisplayCurrency | undefined
  }
  let additionalInternalMetadata: {
    [key: string]: DisplayCurrencyBaseAmount | DisplayCurrency | undefined
  } = {}
  if (senderWalletDescriptor.accountId === recipientWalletDescriptor.accountId) {
    ;({
      metadata,
      debitAccountAdditionalMetadata: additionalDebitMetadata,
      creditAccountAdditionalMetadata: additionalCreditMetadata,
      internalAccountsAdditionalMetadata: additionalInternalMetadata,
    } = LedgerFacade.WalletIdTradeIntraAccountLedgerMetadata({
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
    } = LedgerFacade.WalletIdIntraledgerLedgerMetadata({
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
  if (journal instanceof Error) return journal

  return journal.journalId
}
