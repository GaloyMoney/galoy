import { getCurrentPrice } from "@app/prices"
import { InvoiceNotFoundError } from "@domain/bitcoin/lightning"
import { CouldNotFindError } from "@domain/errors"
import { paymentAmountFromNumber, WalletCurrency } from "@domain/shared"
import { LockService } from "@services/lock"
import { NewDealerPriceService } from "@services/dealer-price"
import { LndService } from "@services/lnd"
import {
  AccountsRepository,
  UsersRepository,
  WalletInvoicesRepository,
  WalletsRepository,
} from "@services/mongoose"
import { NotificationsService } from "@services/notifications"
import { elapsedSinceTimestamp, runInParallel } from "@utils"
import { WalletInvoiceReceiver } from "@domain/wallet-invoices/wallet-invoice-receiver"
import * as LedgerFacade from "@services/ledger/facade"
import { usdFromBtcMidPriceFn } from "@app/shared"

export const declineHeldInvoices = async (logger: Logger): Promise<void> => {
  const invoicesRepo = WalletInvoicesRepository()

  const pendingInvoices = invoicesRepo.yieldPending()

  if (pendingInvoices instanceof Error) {
    logger.error(
      { error: pendingInvoices },
      "finish updating pending invoices with error",
    )
    return
  }

  await runInParallel({
    iterator: pendingInvoices,
    logger,
    processor: async (walletInvoice: WalletInvoice, index: number) => {
      logger.trace("updating pending invoices %s in worker %d", index)
      await declineHeldInvoice({ walletInvoice, logger })
    },
  })

  logger.info("finish updating pending invoices")
}

export const updatePendingInvoiceByPaymentHash = async ({
  paymentHash,
  logger,
}: {
  paymentHash: PaymentHash
  logger: Logger
}): Promise<boolean | ApplicationError> => {
  const invoicesRepo = WalletInvoicesRepository()
  const walletInvoice = await invoicesRepo.findByPaymentHash(paymentHash)
  if (walletInvoice instanceof CouldNotFindError) {
    logger.info({ paymentHash }, "WalletInvoice doesn't exist")
    return false
  }
  if (walletInvoice instanceof Error) return walletInvoice
  return updatePendingInvoice({ walletInvoice, logger })
}

const dealer = NewDealerPriceService()

const updatePendingInvoice = async ({
  walletInvoice,
  logger,
}: {
  walletInvoice: WalletInvoice
  logger: Logger
}): Promise<boolean | ApplicationError> => {
  const lndService = LndService()
  if (lndService instanceof Error) return lndService

  const walletInvoicesRepo = WalletInvoicesRepository()

  const { pubkey, paymentHash, secret, recipientWalletDescriptor } = walletInvoice

  const pendingInvoiceLogger = logger.child({
    hash: paymentHash,
    walletId: recipientWalletDescriptor.id,
    topic: "payment",
    protocol: "lightning",
    transactionType: "receipt",
    onUs: false,
  })

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

  const {
    lnInvoice: { description },
    roundedDownReceived,
  } = lnInvoiceLookup

  if (walletInvoice.paid) {
    pendingInvoiceLogger.info("invoice has already been processed")
    return true
  }

  if (!lnInvoiceLookup.isHeld) {
    pendingInvoiceLogger.info("invoice has not been paid yet")
    return false
  }

  const receivedBtc = paymentAmountFromNumber({
    amount: roundedDownReceived,
    currency: WalletCurrency.Btc,
  })
  if (receivedBtc instanceof Error) return receivedBtc

  const walletInvoiceReceiver = await WalletInvoiceReceiver({
    walletInvoice,
    receivedBtc,
    usdFromBtc: dealer.getCentsFromSatsForImmediateBuy,
    usdFromBtcMidPrice: usdFromBtcMidPriceFn,
  })
  if (walletInvoiceReceiver instanceof Error) return walletInvoiceReceiver

  const lockService = LockService()
  return lockService.lockPaymentHash(paymentHash, async () => {
    // we're getting the invoice another time, now behind the lock, to avoid potential race condition
    const invoiceToUpdate = await walletInvoicesRepo.findByPaymentHash(paymentHash)
    if (invoiceToUpdate instanceof CouldNotFindError) {
      pendingInvoiceLogger.error({ paymentHash }, "WalletInvoice doesn't exist")
      return false
    }
    if (invoiceToUpdate instanceof Error) return invoiceToUpdate
    if (walletInvoice.paid) {
      pendingInvoiceLogger.info("invoice has already been processed")
      return true
    }

    const displayCurrencyPerSat = await getCurrentPrice()
    if (displayCurrencyPerSat instanceof Error) return displayCurrencyPerSat

    const invoiceSettled = await lndService.settleInvoice({ pubkey, secret })
    if (invoiceSettled instanceof Error) return invoiceSettled

    const invoicePaid = await walletInvoicesRepo.markAsPaid(paymentHash)
    if (invoicePaid instanceof Error) return invoicePaid

    // TODO: this should be a in a mongodb transaction session with the ledger transaction below
    // markAsPaid could be done after the transaction, but we should in that case not only look
    // for walletInvoicesRepo, but also in the ledger to make sure in case the process crash in this
    // loop that an eventual consistency doesn't lead to a double credit

    const metadata = LedgerFacade.LnReceiveLedgerMetadata({
      paymentHash,
      fee: walletInvoiceReceiver.btcBankFee,
      feeDisplayCurrency: Number(
        walletInvoiceReceiver.usdBankFee.amount,
      ) as DisplayCurrencyBaseAmount,
      amountDisplayCurrency: Number(
        walletInvoiceReceiver.usdToCreditReceiver.amount,
      ) as DisplayCurrencyBaseAmount,
      pubkey: walletInvoiceReceiver.pubkey,
    })

    //TODO: add displayCurrency: displayPaymentAmount.currency,
    const result = await LedgerFacade.recordReceive({
      description,
      recipientWalletDescriptor: walletInvoiceReceiver.recipientWalletDescriptor,
      amountToCreditReceiver: {
        usd: walletInvoiceReceiver.usdToCreditReceiver,
        btc: walletInvoiceReceiver.btcToCreditReceiver,
      },
      bankFee: {
        usd: walletInvoiceReceiver.usdBankFee,
        btc: walletInvoiceReceiver.btcBankFee,
      },
      metadata,
      txMetadata: {
        hash: metadata.hash,
      },
    })

    if (result instanceof Error) return result

    const recipientWallet = await WalletsRepository().findById(
      recipientWalletDescriptor.id,
    )
    if (recipientWallet instanceof Error) return recipientWallet

    const { usdToCreditReceiver: displayAmount } = walletInvoiceReceiver
    const displayPaymentAmount: DisplayPaymentAmount<DisplayCurrency> = {
      amount: Number((Number(displayAmount.amount) / 100).toFixed(2)),
      currency: displayAmount.currency,
    } as DisplayPaymentAmount<DisplayCurrency>

    const recipientAccount = await AccountsRepository().findById(
      recipientWallet.accountId,
    )
    if (recipientAccount instanceof Error) return recipientAccount

    const recipientUser = await UsersRepository().findById(recipientAccount.ownerId)
    if (recipientUser instanceof Error) return recipientUser

    const notificationsService = NotificationsService()
    notificationsService.lightningTxReceived({
      recipientAccountId: recipientWallet.accountId,
      recipientWalletId: recipientWallet.id,
      paymentAmount: walletInvoiceReceiver.receivedAmount(),
      displayPaymentAmount,
      paymentHash,
      recipientDeviceTokens: recipientUser.deviceTokens,
      recipientLanguage: recipientUser.language,
    })

    return true
  })
}

const declineHeldInvoice = async ({
  walletInvoice,
  logger,
}: {
  walletInvoice: WalletInvoice
  logger: Logger
}): Promise<boolean | ApplicationError> => {
  const lndService = LndService()
  if (lndService instanceof Error) return lndService

  const walletInvoicesRepo = WalletInvoicesRepository()

  const { pubkey, paymentHash } = walletInvoice

  const lnInvoiceLookup = await lndService.lookupInvoice({ pubkey, paymentHash })

  const pendingInvoiceLogger = logger.child({
    hash: paymentHash,
    lnInvoiceLookup,
    walletInvoice,
    topic: "payment",
    protocol: "lightning",
    transactionType: "receipt",
    onUs: false,
  })

  if (lnInvoiceLookup instanceof InvoiceNotFoundError) {
    const isDeleted = await walletInvoicesRepo.deleteByPaymentHash(paymentHash)
    if (isDeleted instanceof Error) {
      pendingInvoiceLogger.error("impossible to delete WalletInvoice entry")
      return isDeleted
    }
    return false
  }
  if (lnInvoiceLookup instanceof Error) return lnInvoiceLookup

  if (!lnInvoiceLookup.isHeld) {
    pendingInvoiceLogger.info({ lnInvoiceLookup }, "invoice has not been paid yet")
    return false
  }

  let heldForMsg = ""
  if (lnInvoiceLookup.heldAt) {
    heldForMsg = `for ${elapsedSinceTimestamp(lnInvoiceLookup.heldAt)}s `
  }
  pendingInvoiceLogger.error(
    { lnInvoiceLookup },
    `invoice has been held ${heldForMsg}and is now been cancelled`,
  )

  const invoiceSettled = await lndService.cancelInvoice({ pubkey, paymentHash })
  if (invoiceSettled instanceof Error) return invoiceSettled

  const isDeleted = await walletInvoicesRepo.deleteByPaymentHash(paymentHash)
  if (isDeleted instanceof Error) {
    pendingInvoiceLogger.error("impossible to delete WalletInvoice entry")
  }

  return true
}
