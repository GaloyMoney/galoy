import { getPriceRatioForLimits } from "./helpers"

import { NETWORK, getOnChainWalletConfig } from "@/config"

import {
  checkIntraledgerLimits,
  checkTradeIntraAccountLimits,
  checkWithdrawalLimits,
} from "@/app/accounts"
import {
  btcFromUsdMidPriceFn,
  getCurrentPriceAsDisplayPriceRatio,
  usdFromBtcMidPriceFn,
} from "@/app/prices"
import {
  getMinerFeeAndPaymentFlow,
  getTransactionForWalletByJournalId,
  validateIsBtcWallet,
  validateIsUsdWallet,
} from "@/app/wallets"

import { AccountValidator } from "@/domain/accounts"
import { PaymentSendStatus } from "@/domain/bitcoin/lightning"
import { checkedToOnChainAddress } from "@/domain/bitcoin/onchain"
import { CouldNotFindError, InsufficientBalanceError } from "@/domain/errors"
import { DisplayAmountsConverter } from "@/domain/fiat"
import { ResourceExpiredLockServiceError } from "@/domain/lock"
import {
  InvalidLightningPaymentFlowBuilderStateError,
  WalletPriceRatio,
  toDisplayBaseAmount,
} from "@/domain/payments"
import { OnChainPaymentFlowBuilder } from "@/domain/payments/onchain-payment-flow-builder"
import { WalletCurrency } from "@/domain/shared"
import {
  PaymentInputValidator,
  SettlementMethod,
  toWalletDescriptor,
} from "@/domain/wallets"

import * as LedgerFacade from "@/services/ledger/facade"

import { OnChainService } from "@/services/bria"
import { DealerPriceService } from "@/services/dealer-price"
import { LedgerService } from "@/services/ledger"
import { LockService } from "@/services/lock"
import { baseLogger } from "@/services/logger"
import { AccountsRepository, WalletsRepository } from "@/services/mongoose"
import { NotificationsService } from "@/services/notifications"
import { addAttributesToCurrentSpan } from "@/services/tracing"

const { dustThreshold } = getOnChainWalletConfig()
const dealer = DealerPriceService()

const payOnChainByWalletId = async ({
  senderAccount,
  senderWalletId,
  amount: amountRaw,
  amountCurrency: amountCurrencyRaw,
  address,
  speed,
  memo,
  sendAll,
}: PayOnChainByWalletIdArgs): Promise<PaymentSendResult | ApplicationError> => {
  const latestAccountState = await AccountsRepository().findById(senderAccount.id)
  if (latestAccountState instanceof Error) return latestAccountState
  const accountValidator = AccountValidator(latestAccountState)
  if (accountValidator instanceof Error) return accountValidator

  const ledger = LedgerService()

  const amountToSendRaw = sendAll
    ? await ledger.getWalletBalance(senderWalletId)
    : amountRaw
  if (amountToSendRaw instanceof Error) return amountToSendRaw

  if (sendAll && amountToSendRaw === 0) {
    return new InsufficientBalanceError(`No balance left to send.`)
  }

  const validator = PaymentInputValidator(WalletsRepository().findById)
  const validationResult = await validator.validatePaymentInput({
    amount: amountToSendRaw,
    amountCurrency: amountCurrencyRaw,
    senderAccount,
    senderWalletId,
  })
  if (validationResult instanceof Error) return validationResult

  const { amount, senderWallet } = validationResult

  const onchainLogger = baseLogger.child({
    topic: "payment",
    protocol: "onchain",
    transactionType: "payment",
    address,
    amount: Number(amount.amount), // separating here because BigInts don't always parse well
    currencyForAmount: amount.currency,
    memo,
    sendAll,
  })
  const checkedAddress = checkedToOnChainAddress({
    network: NETWORK,
    value: address,
  })
  if (checkedAddress instanceof Error) return checkedAddress

  const recipientWallet = await WalletsRepository().findByAddress(checkedAddress)
  if (
    recipientWallet instanceof Error &&
    !(recipientWallet instanceof CouldNotFindError)
  ) {
    return recipientWallet
  }

  const isExternalAddress = async () => recipientWallet instanceof CouldNotFindError

  const withSenderBuilder = OnChainPaymentFlowBuilder({
    netInVolumeAmountLightningFn: LedgerFacade.netInLightningTxBaseVolumeAmountSince,
    netInVolumeAmountOnChainFn: LedgerFacade.netInOnChainTxBaseVolumeAmountSince,
    isExternalAddress,
    sendAll,
    dustThreshold,
  })
    .withAddress(checkedAddress)
    .withSenderWalletAndAccount({
      wallet: senderWallet,
      account: senderAccount,
    })

  const withConversionArgs = {
    hedgeBuyUsd: {
      usdFromBtc: dealer.getCentsFromSatsForImmediateBuy,
      btcFromUsd: dealer.getSatsFromCentsForImmediateBuy,
    },
    hedgeSellUsd: {
      usdFromBtc: dealer.getCentsFromSatsForImmediateSell,
      btcFromUsd: dealer.getSatsFromCentsForImmediateSell,
    },
    mid: { usdFromBtc: usdFromBtcMidPriceFn, btcFromUsd: btcFromUsdMidPriceFn },
  }

  if (await withSenderBuilder.isIntraLedger()) {
    if (recipientWallet instanceof CouldNotFindError) return recipientWallet

    const recipientWalletDescriptor = toWalletDescriptor(recipientWallet)

    addAttributesToCurrentSpan({
      "payment.originalRecipient": JSON.stringify(recipientWalletDescriptor),
    })

    const accountWallets = await WalletsRepository().findAccountWalletsByAccountId(
      recipientWallet.accountId,
    )
    if (accountWallets instanceof Error) return accountWallets

    const recipientAccount = await AccountsRepository().findById(
      recipientWallet.accountId,
    )
    if (recipientAccount instanceof Error) return recipientAccount

    const builder = withSenderBuilder
      .withRecipientWallet({
        defaultWalletCurrency: recipientWallet.currency,
        recipientWalletDescriptors: accountWallets,
        userId: recipientAccount.kratosUserId,
        username: recipientAccount.username,
      })
      .withAmount(amount)
      .withConversion(withConversionArgs)

    return executePaymentViaIntraledger({
      builder,
      senderAccount,
      memo,
      sendAll,
    })
  }

  const builder = withSenderBuilder
    .withoutRecipientWallet()
    .withAmount(amount)
    .withConversion(withConversionArgs)

  return executePaymentViaOnChain({
    builder,
    senderDisplayCurrency: senderAccount.displayCurrency,
    speed,
    memo,
    sendAll,
    logger: onchainLogger,
  })
}

export const payOnChainByWalletIdForBtcWallet = async (
  args: PayOnChainByWalletIdWithoutCurrencyArgs,
): Promise<PaymentSendResult | ApplicationError> => {
  const validated = await validateIsBtcWallet(args.senderWalletId)
  return validated instanceof Error
    ? validated
    : payOnChainByWalletId({
        ...args,
        amountCurrency: WalletCurrency.Btc,
        sendAll: false,
      })
}

export const payOnChainByWalletIdForUsdWallet = async (
  args: PayOnChainByWalletIdWithoutCurrencyArgs,
): Promise<PaymentSendResult | ApplicationError> => {
  const validated = await validateIsUsdWallet(args.senderWalletId)
  return validated instanceof Error
    ? validated
    : payOnChainByWalletId({
        ...args,
        amountCurrency: WalletCurrency.Usd,
        sendAll: false,
      })
}

export const payOnChainByWalletIdForUsdWalletAndBtcAmount = async (
  args: PayOnChainByWalletIdWithoutCurrencyArgs,
): Promise<PaymentSendResult | ApplicationError> => {
  const validated = await validateIsUsdWallet(args.senderWalletId)
  return validated instanceof Error
    ? validated
    : payOnChainByWalletId({
        ...args,
        amountCurrency: WalletCurrency.Btc,
        sendAll: false,
      })
}

export const payAllOnChainByWalletId = async (
  args: PayAllOnChainByWalletIdArgs,
): Promise<PaymentSendResult | ApplicationError> =>
  payOnChainByWalletId({ ...args, amount: 0, amountCurrency: undefined, sendAll: true })

const executePaymentViaIntraledger = async <
  S extends WalletCurrency,
  R extends WalletCurrency,
>({
  builder,
  senderAccount,
  memo,
  sendAll,
}: {
  builder: OPFBWithConversion<S, R> | OPFBWithError
  senderAccount: Account
  memo: string | null
  sendAll: boolean
}): Promise<PaymentSendResult | ApplicationError> => {
  const paymentFlow = await builder.withoutMinerFee()
  if (paymentFlow instanceof Error) return paymentFlow

  addAttributesToCurrentSpan({
    "payment.settlement_method": SettlementMethod.IntraLedger,
    "payment.finalRecipient": JSON.stringify(paymentFlow.recipientWalletDescriptor()),
  })

  const { id: senderWalletId } = paymentFlow.senderWalletDescriptor()

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

  // Limit check
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

  const journalId = await LockService().lockWalletId(senderWalletId, async (signal) =>
    lockedPaymentViaIntraledgerSteps({
      signal,

      paymentFlow,
      senderDisplayCurrency: senderAccount.displayCurrency,
      senderUsername: senderAccount.username,
      recipientDisplayCurrency: recipientAccount.displayCurrency,
      recipientUsername: recipientAccount.username,

      memo,
      sendAll,
    }),
  )
  if (journalId instanceof Error) return journalId

  const recipientAsNotificationRecipient = {
    accountId: recipientAccount.id,
    walletId: recipientWalletDescriptor.id,
    userId: recipientAccount.kratosUserId,
    level: recipientAccount.level,
  }

  const recipientWalletTransaction = await getTransactionForWalletByJournalId({
    walletId: recipientWalletDescriptor.id,
    journalId,
  })
  if (recipientWalletTransaction instanceof Error) return recipientWalletTransaction

  // Send 'received'-side intraledger notification
  NotificationsService().sendTransaction({
    recipient: recipientAsNotificationRecipient,
    transaction: recipientWalletTransaction,
  })

  const senderAsNotificationRecipient = {
    accountId: senderAccount.id,
    walletId: senderWalletId,
    userId: senderAccount.kratosUserId,
    level: senderAccount.level,
  }

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

const lockedPaymentViaIntraledgerSteps = async <
  S extends WalletCurrency,
  R extends WalletCurrency,
>({
  signal,

  paymentFlow,
  senderDisplayCurrency,
  senderUsername,
  recipientDisplayCurrency,
  recipientUsername,

  memo,
  sendAll,
}: {
  signal: WalletIdAbortSignal

  paymentFlow: OnChainPaymentFlow<S, R>
  senderDisplayCurrency: DisplayCurrency
  senderUsername: Username | undefined
  recipientDisplayCurrency: DisplayCurrency
  recipientUsername: Username | undefined

  memo: string | null
  sendAll: boolean
}): Promise<LedgerJournalId | ApplicationError> => {
  const senderWalletDescriptor = paymentFlow.senderWalletDescriptor()

  const { walletDescriptor: recipientWalletDescriptor } = paymentFlow.recipientDetails()
  if (!recipientWalletDescriptor) {
    return new InvalidLightningPaymentFlowBuilderStateError(
      "Expected recipient details missing",
    )
  }

  // Check user balance
  const balance = await LedgerService().getWalletBalanceAmount(senderWalletDescriptor)
  if (balance instanceof Error) return balance

  const balanceCheck = paymentFlow.checkBalanceForSend(balance)
  if (balanceCheck instanceof Error) return balanceCheck

  // Check lock still intact
  if (signal.aborted) {
    return new ResourceExpiredLockServiceError(signal.error?.message)
  }

  // Construct metadata
  const address = await paymentFlow.addressForFlow()
  if (address instanceof Error) return address
  const payeeAddresses = [address]

  const priceRatio = WalletPriceRatio({
    usd: paymentFlow.usdPaymentAmount,
    btc: paymentFlow.btcPaymentAmount,
  })
  if (priceRatio instanceof Error) return priceRatio

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

  let metadata:
    | AddOnChainIntraledgerSendLedgerMetadata
    | AddOnChainTradeIntraAccountLedgerMetadata
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
    } = LedgerFacade.OnChainTradeIntraAccountLedgerMetadata({
      payeeAddresses,
      sendAll,
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
    } = LedgerFacade.OnChainIntraledgerLedgerMetadata({
      payeeAddresses,
      sendAll,
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

  // Record transaction
  const journal = await LedgerFacade.recordIntraledger({
    description: "",
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

const executePaymentViaOnChain = async <
  S extends WalletCurrency,
  R extends WalletCurrency,
>({
  builder,
  senderDisplayCurrency,
  speed,
  memo,
  sendAll,
  logger,
}: {
  builder: OPFBWithConversion<S, R> | OPFBWithError
  senderDisplayCurrency: DisplayCurrency
  speed: PayoutSpeed
  memo: string | null
  sendAll: boolean
  logger: Logger
}): Promise<PaymentSendResult | ApplicationError> => {
  const senderWalletDescriptor = await builder.senderWalletDescriptor()
  if (senderWalletDescriptor instanceof Error) return senderWalletDescriptor

  // Limit check
  const proposedAmounts = await builder.proposedAmounts()
  if (proposedAmounts instanceof Error) return proposedAmounts

  const priceRatioForLimits = await getPriceRatioForLimits(proposedAmounts)
  if (priceRatioForLimits instanceof Error) return priceRatioForLimits

  const limitCheck = await checkWithdrawalLimits({
    amount: proposedAmounts.usd,
    accountId: senderWalletDescriptor.accountId,
    priceRatio: priceRatioForLimits,
  })
  if (limitCheck instanceof Error) return limitCheck

  const journalId = await LockService().lockWalletId(
    senderWalletDescriptor.id,
    async (signal) =>
      lockedPaymentViaOnChainSteps({
        signal,

        builder,
        speed,

        senderDisplayCurrency,
        memo,
        sendAll,

        logger,
      }),
  )
  if (journalId instanceof Error) return journalId

  const walletTransaction = await getTransactionForWalletByJournalId({
    walletId: senderWalletDescriptor.id,
    journalId,
  })
  if (walletTransaction instanceof Error) return walletTransaction

  return { status: PaymentSendStatus.Success, transaction: walletTransaction }
}

const lockedPaymentViaOnChainSteps = async <
  S extends WalletCurrency,
  R extends WalletCurrency,
>({
  signal,

  builder,
  speed,

  senderDisplayCurrency,
  memo,
  sendAll,

  logger,
}: {
  signal: WalletIdAbortSignal

  builder: OPFBWithConversion<S, R> | OPFBWithError
  speed: PayoutSpeed

  senderDisplayCurrency: DisplayCurrency
  memo: string | null
  sendAll: boolean

  logger: Logger
}): Promise<LedgerJournalId | ApplicationError> => {
  const address = await builder.addressForFlow()

  // Get estimated miner fee and create 'paymentFlow'
  const paymentFlow = await getMinerFeeAndPaymentFlow({
    builder,
    speed,
  })
  if (paymentFlow instanceof Error) return paymentFlow

  const senderWalletDescriptor = paymentFlow.senderWalletDescriptor()

  // Check user balance
  const balance = await LedgerService().getWalletBalanceAmount(senderWalletDescriptor)
  if (balance instanceof Error) return balance

  const balanceCheck = paymentFlow.checkBalanceForSend(balance)
  if (balanceCheck instanceof Error) return balanceCheck

  // Check lock still intact
  if (signal.aborted) {
    return new ResourceExpiredLockServiceError(signal.error?.message)
  }

  const bankFee = paymentFlow.bankFees()
  if (bankFee instanceof Error) return bankFee
  const btcBankFee = bankFee.btc

  const btcTotalFee = paymentFlow.btcProtocolAndBankFee
  if (btcTotalFee instanceof Error) return btcTotalFee

  addAttributesToCurrentSpan({
    "payOnChainByWalletId.btcAmount": `${paymentFlow.btcPaymentAmount.amount}`,
    "payOnChainByWalletId.estimatedFee": `${paymentFlow.btcProtocolAndBankFee.amount}`,
    "payOnChainByWalletId.estimatedMinerFee": `${paymentFlow.btcMinerFee?.amount}`,
    "payOnChainByWalletId.totalFee": `${btcTotalFee.amount}`,
    "payOnChainByWalletId.bankFee": `${btcBankFee.amount}`,
  })

  // Construct metadata
  const displayPriceRatio = await getCurrentPriceAsDisplayPriceRatio({
    currency: senderDisplayCurrency,
  })
  if (displayPriceRatio instanceof Error) return displayPriceRatio
  const { displayAmount, displayFee } =
    DisplayAmountsConverter(displayPriceRatio).convert(paymentFlow)

  const { metadata, debitAccountAdditionalMetadata, internalAccountsAdditionalMetadata } =
    LedgerFacade.OnChainSendLedgerMetadata({
      paymentAmounts: paymentFlow,

      amountDisplayCurrency: toDisplayBaseAmount(displayAmount),
      feeDisplayCurrency: toDisplayBaseAmount(displayFee),
      displayCurrency: senderDisplayCurrency,

      payeeAddresses: [paymentFlow.address],
      sendAll,
      memoOfPayer: memo || undefined,
    })

  // Record transaction
  const journal = await LedgerFacade.recordSendOnChain({
    description: memo || "",
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
    bankFee,
    senderWalletDescriptor: paymentFlow.senderWalletDescriptor(),
    metadata,
    additionalDebitMetadata: debitAccountAdditionalMetadata,
    additionalInternalMetadata: internalAccountsAdditionalMetadata,
  })
  if (journal instanceof Error) return journal

  const { journalId } = journal

  // Execute payment onchain
  const payout = await OnChainService().queuePayoutToAddress({
    walletDescriptor: senderWalletDescriptor,
    address: paymentFlow.address,
    amount: paymentFlow.btcPaymentAmount,
    speed,
    journalId,
  })
  if (payout instanceof Error) {
    logger.error(
      {
        err: payout,
        externalId: journalId,
        address,
        tokens: Number(paymentFlow.btcPaymentAmount.amount),
        success: false,
      },
      `Could not queue payout with id ${payout}`,
    )
    const reverted = await LedgerService().revertOnChainPayment({
      journalId,
    })
    if (reverted instanceof Error) return reverted
    return payout
  }

  return journalId
}
