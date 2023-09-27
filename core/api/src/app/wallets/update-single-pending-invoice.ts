// Package-internal method, not re-exported from index.ts but used in tests

import { removeDeviceTokens } from "@app/users/remove-device-tokens"
import { getCurrentPriceAsDisplayPriceRatio, usdFromBtcMidPriceFn } from "@app/prices"

import { CouldNotFindError, CouldNotFindWalletInvoiceError } from "@domain/errors"
import { checkedToSats } from "@domain/bitcoin"
import { DisplayAmountsConverter } from "@domain/fiat"
import { InvoiceNotFoundError } from "@domain/bitcoin/lightning"
import { paymentAmountFromNumber, WalletCurrency } from "@domain/shared"
import { WalletInvoiceReceiver } from "@domain/wallet-invoices/wallet-invoice-receiver"
import { DeviceTokensNotRegisteredNotificationsServiceError } from "@domain/notifications"

import {
  addAttributesToCurrentSpan,
  recordExceptionInCurrentSpan,
  wrapAsyncToRunInSpan,
} from "@services/tracing"
import {
  AccountsRepository,
  WalletInvoicesRepository,
  WalletsRepository,
  UsersRepository,
} from "@services/mongoose"
import { LndService } from "@services/lnd"
import { LockService } from "@services/lock"
import * as LedgerFacade from "@services/ledger/facade"
import { DealerPriceService } from "@services/dealer-price"
import { NotificationsService } from "@services/notifications"

import { CallbackEventType } from "@domain/callback"
import { AccountLevel } from "@domain/accounts"
import { CallbackService } from "@services/svix"
import { getCallbackServiceConfig } from "@config"
import { toDisplayBaseAmount } from "@domain/payments"

import { declineHeldInvoice } from "./decline-single-pending-invoice"

const lockedUpdatePendingInvoiceSteps = async ({
  paymentHash,
  recipientWalletId,
  receivedBtc,
  description,
  isSettledInLnd,
  logger,
}: {
  paymentHash: PaymentHash
  recipientWalletId: WalletId
  receivedBtc: BtcPaymentAmount
  description: string
  isSettledInLnd: boolean
  logger: Logger
}) => {
  const walletInvoices = WalletInvoicesRepository()

  const walletInvoiceInsideLock = await walletInvoices.findByPaymentHash(paymentHash)
  if (walletInvoiceInsideLock instanceof CouldNotFindError) {
    logger.error({ paymentHash }, "WalletInvoice doesn't exist")
    return false
  }
  if (walletInvoiceInsideLock instanceof Error) return walletInvoiceInsideLock
  if (walletInvoiceInsideLock.paid) {
    logger.info("invoice has already been processed")
    return true
  }

  // Prepare metadata and record transaction
  const recipientInvoiceWallet = await WalletsRepository().findById(recipientWalletId)
  if (recipientInvoiceWallet instanceof Error) return recipientInvoiceWallet
  const { accountId: recipientAccountId } = recipientInvoiceWallet

  const accountWallets =
    await WalletsRepository().findAccountWalletsByAccountId(recipientAccountId)
  if (accountWallets instanceof Error) return accountWallets

  const receivedWalletInvoice = await WalletInvoiceReceiver({
    walletInvoice: walletInvoiceInsideLock,
    receivedBtc,
    recipientWalletDescriptors: accountWallets,
  }).withConversion({
    mid: { usdFromBtc: usdFromBtcMidPriceFn },
    hedgeBuyUsd: { usdFromBtc: DealerPriceService().getCentsFromSatsForImmediateBuy },
  })
  if (receivedWalletInvoice instanceof Error) return receivedWalletInvoice

  const {
    recipientWalletDescriptor,
    btcToCreditReceiver,
    btcBankFee,
    usdToCreditReceiver,
    usdBankFee,
  } = receivedWalletInvoice

  addAttributesToCurrentSpan({
    "invoices.finalRecipient": JSON.stringify(recipientWalletDescriptor),
  })

  if (!isSettledInLnd) {
    const lndService = LndService()
    if (lndService instanceof Error) return lndService
    const invoiceSettled = await lndService.settleInvoice({
      pubkey: walletInvoiceInsideLock.pubkey,
      secret: walletInvoiceInsideLock.secret,
    })
    if (invoiceSettled instanceof Error) return invoiceSettled
  }

  const invoicePaid = await walletInvoices.markAsPaid(paymentHash)
  if (invoicePaid instanceof Error) return invoicePaid

  const recipientAccount = await AccountsRepository().findById(recipientAccountId)
  if (recipientAccount instanceof Error) return recipientAccount
  const { displayCurrency: recipientDisplayCurrency } = recipientAccount
  const displayPriceRatio = await getCurrentPriceAsDisplayPriceRatio({
    currency: recipientDisplayCurrency,
  })
  if (displayPriceRatio instanceof Error) return displayPriceRatio

  const { displayAmount: displayPaymentAmount, displayFee } = DisplayAmountsConverter(
    displayPriceRatio,
  ).convert({
    btcPaymentAmount: btcToCreditReceiver,
    btcProtocolAndBankFee: btcBankFee,
    usdPaymentAmount: usdToCreditReceiver,
    usdProtocolAndBankFee: usdBankFee,
  })

  // TODO: this should be a in a mongodb transaction session with the ledger transaction below
  // markAsPaid could be done after the transaction, but we should in that case not only look
  // for walletInvoicesRepo, but also in the ledger to make sure in case the process crash in this
  // loop that an eventual consistency doesn't lead to a double credit

  const {
    metadata,
    creditAccountAdditionalMetadata,
    internalAccountsAdditionalMetadata,
  } = LedgerFacade.LnReceiveLedgerMetadata({
    paymentHash,
    pubkey: walletInvoiceInsideLock.pubkey,
    paymentAmounts: {
      btcPaymentAmount: btcToCreditReceiver,
      usdPaymentAmount: usdToCreditReceiver,
      btcProtocolAndBankFee: btcBankFee,
      usdProtocolAndBankFee: usdBankFee,
    },

    feeDisplayCurrency: toDisplayBaseAmount(displayFee),
    amountDisplayCurrency: toDisplayBaseAmount(displayPaymentAmount),
    displayCurrency: recipientDisplayCurrency,
  })

  //TODO: add displayCurrency: displayPaymentAmount.currency,
  const result = await LedgerFacade.recordReceiveOffChain({
    description,
    recipientWalletDescriptor,
    amountToCreditReceiver: {
      usd: usdToCreditReceiver,
      btc: btcToCreditReceiver,
    },
    bankFee: {
      usd: usdBankFee,
      btc: btcBankFee,
    },
    metadata,
    txMetadata: {
      hash: metadata.hash,
    },
    additionalCreditMetadata: creditAccountAdditionalMetadata,
    additionalInternalMetadata: internalAccountsAdditionalMetadata,
  })
  if (result instanceof Error) return result

  // Prepare and send notification
  const recipientUser = await UsersRepository().findById(recipientAccount.kratosUserId)
  if (recipientUser instanceof Error) return recipientUser

  const notificationResult = await NotificationsService().lightningTxReceived({
    recipientAccountId,
    recipientWalletId: recipientWalletDescriptor.id,
    paymentAmount: receivedWalletInvoice.receivedAmount(),
    displayPaymentAmount,
    paymentHash,
    recipientDeviceTokens: recipientUser.deviceTokens,
    recipientNotificationSettings: recipientAccount.notificationSettings,
    recipientLanguage: recipientUser.language,
  })

  if (notificationResult instanceof DeviceTokensNotRegisteredNotificationsServiceError) {
    await removeDeviceTokens({
      userId: recipientUser.id,
      deviceTokens: notificationResult.tokens,
    })
  }

  if (
    recipientAccount.level === AccountLevel.One ||
    recipientAccount.level === AccountLevel.Two
  ) {
    const callbackService = CallbackService(getCallbackServiceConfig())
    callbackService.sendMessage({
      accountUuid: recipientAccount.uuid,
      eventType: CallbackEventType.ReceiveLightning,
      payload: {
        // FIXME: [0] might not be correct
        txid: result.transactionIds[0],
      },
    })
  }

  return true
}

const updatePendingInvoiceBeforeFinally = async ({
  walletInvoice,
  logger,
}: {
  walletInvoice: WalletInvoice
  logger: Logger
}): Promise<boolean | ApplicationError> => {
  addAttributesToCurrentSpan({
    paymentHash: walletInvoice.paymentHash,
    pubkey: walletInvoice.pubkey,
  })

  const walletInvoicesRepo = WalletInvoicesRepository()

  const {
    pubkey,
    paymentHash,
    recipientWalletDescriptor: recipientInvoiceWalletDescriptor,
  } = walletInvoice

  addAttributesToCurrentSpan({
    "invoices.originalRecipient": JSON.stringify(recipientInvoiceWalletDescriptor),
  })

  const pendingInvoiceLogger = logger.child({
    hash: paymentHash,
    walletId: recipientInvoiceWalletDescriptor.id,
    topic: "payment",
    protocol: "lightning",
    transactionType: "receipt",
    onUs: false,
  })

  const lndService = LndService()
  if (lndService instanceof Error) return lndService
  const lnInvoiceLookup = await lndService.lookupInvoice({ pubkey, paymentHash })
  if (lnInvoiceLookup instanceof InvoiceNotFoundError) {
    const isDeleted = await walletInvoicesRepo.deleteByPaymentHash(paymentHash)
    if (isDeleted instanceof Error) {
      pendingInvoiceLogger.error("impossible to delete WalletInvoice entry")
      return isDeleted
    }
    return false
  }
  if (lnInvoiceLookup instanceof Error) return lnInvoiceLookup

  if (walletInvoice.paid) {
    pendingInvoiceLogger.info("invoice has already been processed")
    return true
  }

  const {
    lnInvoice: { description },
    roundedDownReceived: uncheckedRoundedDownReceived,
  } = lnInvoiceLookup

  if (!lnInvoiceLookup.isHeld && !lnInvoiceLookup.isSettled) {
    pendingInvoiceLogger.info("invoice has not been paid yet")
    return false
  }

  // TODO: validate roundedDownReceived as user input
  const roundedDownReceived = checkedToSats(uncheckedRoundedDownReceived)
  if (roundedDownReceived instanceof Error) {
    recordExceptionInCurrentSpan({
      error: roundedDownReceived,
      level: roundedDownReceived.level,
    })
    return declineHeldInvoice({ walletInvoice, logger })
  }

  const receivedBtc = paymentAmountFromNumber({
    amount: roundedDownReceived,
    currency: WalletCurrency.Btc,
  })
  if (receivedBtc instanceof Error) return receivedBtc

  const lockService = LockService()
  return lockService.lockPaymentHash(paymentHash, async () =>
    lockedUpdatePendingInvoiceSteps({
      recipientWalletId: recipientInvoiceWalletDescriptor.id,
      paymentHash,
      receivedBtc,
      description,
      isSettledInLnd: lnInvoiceLookup.isSettled,
      logger,
    }),
  )
}

export const updatePendingInvoice = wrapAsyncToRunInSpan({
  namespace: "app.invoices",
  fnName: "updatePendingInvoice",
  fn: async ({
    walletInvoice,
    logger,
  }: {
    walletInvoice: WalletInvoice
    logger: Logger
  }): Promise<boolean | ApplicationError> => {
    const result = await updatePendingInvoiceBeforeFinally({
      walletInvoice,
      logger,
    })
    if (result) {
      if (!walletInvoice.paid) {
        const invoicePaid = await WalletInvoicesRepository().markAsPaid(
          walletInvoice.paymentHash,
        )
        if (
          invoicePaid instanceof Error &&
          !(invoicePaid instanceof CouldNotFindWalletInvoiceError)
        ) {
          return invoicePaid
        }
      }
    }
    return result
  },
})
