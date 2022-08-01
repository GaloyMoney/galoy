import { getCurrentPrice } from "@app/prices"
import {
  BTC_NETWORK,
  getFeesConfig,
  getOnChainWalletConfig,
  ONCHAIN_SCAN_DEPTH_OUTGOING,
} from "@config"
import { checkedToSats, checkedToTargetConfs, toSats } from "@domain/bitcoin"
import { PaymentSendStatus } from "@domain/bitcoin/lightning"
import { checkedToOnChainAddress, TxDecoder } from "@domain/bitcoin/onchain"
import {
  InsufficientBalanceError,
  LessThanDustThresholdError,
  NotImplementedError,
  RebalanceNeededError,
  SelfPaymentError,
} from "@domain/errors"
import { DisplayCurrencyConverter } from "@domain/fiat/display-currency"
import { PaymentInputValidator, WithdrawalFeeCalculator } from "@domain/wallets"
import { WalletCurrency } from "@domain/shared"
import { LockService } from "@services/lock"
import { LedgerService } from "@services/ledger"
import { OnChainService } from "@services/lnd/onchain-service"
import { baseLogger } from "@services/logger"
import {
  AccountsRepository,
  UsersRepository,
  WalletsRepository,
} from "@services/mongoose"
import { NotificationsService } from "@services/notifications"
import { addAttributesToCurrentSpan } from "@services/tracing"

import { ImbalanceCalculator } from "@domain/ledger/imbalance-calculator"

import { ResourceExpiredLockServiceError } from "@domain/lock"

import { DisplayCurrency } from "@domain/fiat"

import {
  checkAndVerifyTwoFA,
  checkIntraledgerLimits,
  checkWithdrawalLimits,
} from "./check-limit-helpers"
import { getOnChainFee } from "./get-on-chain-fee"

const { dustThreshold } = getOnChainWalletConfig()

export const payOnChainByWalletIdWithTwoFA = async ({
  senderAccount,
  senderWalletId,
  amount: amountRaw,
  address,
  targetConfirmations,
  memo,
  sendAll,
  twoFAToken,
}: PayOnChainByWalletIdWithTwoFAArgs): Promise<PaymentSendStatus | ApplicationError> => {
  const amount = sendAll
    ? await LedgerService().getWalletBalance(senderWalletId)
    : checkedToSats(amountRaw)
  if (amount instanceof Error) return amount

  const user = await UsersRepository().findById(senderAccount.ownerId)
  if (user instanceof Error) return user
  const { twoFA } = user

  // FIXME: inefficient. wallet also fetched in lnSendPayment
  const senderWallet = await WalletsRepository().findById(senderWalletId)
  if (senderWallet instanceof Error) return senderWallet

  const displayCurrencyPerSat = await getCurrentPrice()
  if (displayCurrencyPerSat instanceof Error) return displayCurrencyPerSat

  const dCConverter = DisplayCurrencyConverter(displayCurrencyPerSat)
  // End FIXME

  const twoFACheck = twoFA?.secret
    ? await checkAndVerifyTwoFA({
        walletId: senderWalletId,
        walletCurrency: senderWallet.currency,
        dCConverter,
        amount,
        twoFASecret: twoFA.secret,
        twoFAToken,
        account: senderAccount,
      })
    : true
  if (twoFACheck instanceof Error) return twoFACheck

  return payOnChainByWalletId({
    senderAccount,
    senderWalletId,
    amount,
    address,
    targetConfirmations,
    memo,
    sendAll,
  })
}

export const payOnChainByWalletId = async ({
  senderAccount,
  senderWalletId,
  amount: amountRaw,
  address,
  targetConfirmations,
  memo,
  sendAll,
}: PayOnChainByWalletIdArgs): Promise<PaymentSendStatus | ApplicationError> => {
  const checkedAmount = sendAll
    ? await LedgerService().getWalletBalance(senderWalletId)
    : checkedToSats(amountRaw)
  if (checkedAmount instanceof Error) return checkedAmount

  const validator = PaymentInputValidator(WalletsRepository().findById)
  const validationResult = await validator.validatePaymentInput({
    amount: checkedAmount,
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
    amount,
    memo,
    sendAll,
  })
  const checkedAddress = checkedToOnChainAddress({
    network: BTC_NETWORK,
    value: address,
  })
  if (checkedAddress instanceof Error) return checkedAddress

  const checkedTargetConfirmations = checkedToTargetConfs(targetConfirmations)
  if (checkedTargetConfirmations instanceof Error) return checkedTargetConfirmations

  const wallets = WalletsRepository()
  const recipientWallet = await wallets.findByAddress(checkedAddress)
  const isIntraLedger = !(recipientWallet instanceof Error)

  if (isIntraLedger)
    return executePaymentViaIntraledger({
      senderAccount,
      senderWallet,
      recipientWallet,
      amount,
      address: checkedAddress,
      memo,
      sendAll,
      logger: onchainLogger,
    })

  return executePaymentViaOnChain({
    senderWallet,
    senderAccount,
    amount,
    address: checkedAddress,
    targetConfirmations: checkedTargetConfirmations,
    memo,
    sendAll,
    logger: onchainLogger,
  })
}

const executePaymentViaIntraledger = async ({
  senderAccount,
  senderWallet,
  recipientWallet,
  amount,
  address,
  memo,
  sendAll,
  logger,
}: {
  senderAccount: Account
  senderWallet: Wallet
  recipientWallet: Wallet
  amount: CurrencyBaseAmount
  address: OnChainAddress
  memo: string | null
  sendAll: boolean
  logger: Logger
}): Promise<PaymentSendStatus | ApplicationError> => {
  if (recipientWallet.id === senderWallet.id) return new SelfPaymentError()

  // TODO Usd use case
  if (
    !(
      recipientWallet.currency === WalletCurrency.Btc &&
      senderWallet.currency === WalletCurrency.Btc
    )
  ) {
    return new NotImplementedError("USD intraledger")
  }
  const amountSats = toSats(amount)

  const displayCurrencyPerSat = await getCurrentPrice()
  if (displayCurrencyPerSat instanceof Error) return displayCurrencyPerSat

  const dCConverter = DisplayCurrencyConverter(displayCurrencyPerSat)

  const intraledgerLimitCheck = await checkIntraledgerLimits({
    amount,
    dCConverter,
    walletId: senderWallet.id,
    walletCurrency: senderWallet.currency,
    account: senderAccount,
  })
  if (intraledgerLimitCheck instanceof Error) return intraledgerLimitCheck

  const amountDisplayCurrency = dCConverter.fromSats(amountSats)

  const recipientAccount = await AccountsRepository().findById(recipientWallet.accountId)
  if (recipientAccount instanceof Error) return recipientAccount

  return LockService().lockWalletId(senderWallet.id, async (signal) => {
    const balance = await LedgerService().getWalletBalance(senderWallet.id)
    if (balance instanceof Error) return balance
    if (balance < amount)
      return new InsufficientBalanceError(
        `Payment amount '${amount}' exceeds balance '${balance}'`,
      )

    const onchainLoggerOnUs = logger.child({ balance, onUs: true })

    if (signal.aborted) {
      return new ResourceExpiredLockServiceError(signal.error?.message)
    }

    const journal = await LedgerService().addOnChainIntraledgerTxTransfer({
      senderWalletId: senderWallet.id,
      senderWalletCurrency: senderWallet.currency,
      senderUsername: senderAccount.username,
      description: "",
      sats: amountSats,
      amountDisplayCurrency,
      payeeAddresses: [address],
      sendAll,
      recipientWalletId: recipientWallet.id,
      recipientWalletCurrency: recipientWallet.currency,
      recipientUsername: recipientAccount.username,
      memoPayer: memo || undefined,
    })

    if (journal instanceof Error) return journal

    const recipientUser = await UsersRepository().findById(recipientAccount.ownerId)
    if (recipientUser instanceof Error) return recipientUser

    const displayPaymentAmount: DisplayPaymentAmount<DisplayCurrency> = {
      amount: amountDisplayCurrency,
      currency: DisplayCurrency.Usd,
    }

    const notificationsService = NotificationsService()
    notificationsService.intraLedgerTxReceived({
      recipientAccountId: recipientWallet.accountId,
      recipientWalletId: recipientWallet.id,
      recipientDeviceTokens: recipientUser.deviceTokens,
      recipientLanguage: recipientUser.language,
      paymentAmount: { amount: BigInt(amountSats), currency: recipientWallet.currency },
      displayPaymentAmount,
    })

    onchainLoggerOnUs.info(
      {
        success: true,
        type: "onchain_on_us",
        pending: false,
        amountDisplayCurrency,
      },
      "onchain payment succeed",
    )

    return PaymentSendStatus.Success
  })
}

const executePaymentViaOnChain = async ({
  senderWallet,
  senderAccount,
  amount,
  address,
  targetConfirmations,
  memo,
  sendAll,
  logger,
}: {
  senderWallet: Wallet
  senderAccount: Account
  amount: CurrencyBaseAmount
  address: OnChainAddress
  targetConfirmations: TargetConfirmations
  memo: string | null
  sendAll: boolean
  logger: Logger
}): Promise<PaymentSendStatus | ApplicationError> => {
  // TODO Usd use case
  if (senderWallet.currency !== WalletCurrency.Btc) {
    return new NotImplementedError("USD Intraledger")
  }

  const amountSats = toSats(amount)

  const ledgerService = LedgerService()

  const feeConfig = getFeesConfig()

  const withdrawFeeCalculator = WithdrawalFeeCalculator({
    feeRatio: feeConfig.withdrawRatio,
    thresholdImbalance: feeConfig.withdrawThreshold,
  })

  const onChainService = OnChainService(TxDecoder(BTC_NETWORK))
  if (onChainService instanceof Error) return onChainService

  const displayCurrencyPerSat = await getCurrentPrice()
  if (displayCurrencyPerSat instanceof Error) return displayCurrencyPerSat

  const dCConverter = DisplayCurrencyConverter(displayCurrencyPerSat)

  const withdrawalLimitCheck = await checkWithdrawalLimits({
    amount,
    dCConverter,
    walletId: senderWallet.id,
    walletCurrency: senderWallet.currency,
    account: senderAccount,
  })
  if (withdrawalLimitCheck instanceof Error) return withdrawalLimitCheck

  const getFeeEstimate = () =>
    getOnChainFee({
      walletId: senderWallet.id,
      account: senderAccount,
      amount,
      address,
      targetConfirmations,
    })

  const onChainAvailableBalance = await onChainService.getBalance()
  if (onChainAvailableBalance instanceof Error) return onChainAvailableBalance

  const estimatedFee = await getFeeEstimate()
  if (estimatedFee instanceof Error) return estimatedFee

  const amountToSend = sendAll ? toSats(amount - estimatedFee) : amountSats
  if (onChainAvailableBalance < amountToSend + estimatedFee)
    return new RebalanceNeededError()

  if (amountToSend < dustThreshold)
    return new LessThanDustThresholdError(
      `Use lightning to send amounts less than ${dustThreshold}`,
    )

  return LockService().lockWalletId(senderWallet.id, async (signal) => {
    const balance = await LedgerService().getWalletBalance(senderWallet.id)
    if (balance instanceof Error) return balance
    const estimatedFee = await getFeeEstimate()
    if (estimatedFee instanceof Error) return estimatedFee
    if (balance < amountToSend + estimatedFee) {
      return new InsufficientBalanceError(
        `${amountToSend + estimatedFee} exceeds balance ${balance}`,
      )
    }

    if (signal.aborted) {
      return new ResourceExpiredLockServiceError(signal.error?.message)
    }

    const txHash = await onChainService.payToAddress({
      address,
      amount: amountToSend,
      targetConfirmations,
    })
    if (txHash instanceof Error) {
      logger.error(
        { err: txHash, address, tokens: amountToSend, success: false },
        "Impossible to sendToChainAddress",
      )
      return txHash
    }

    let minerFee: Satoshis

    const minerFee_ = await onChainService.lookupOnChainFee({
      txHash,
      scanDepth: ONCHAIN_SCAN_DEPTH_OUTGOING,
    })
    if (minerFee_ instanceof Error) {
      logger.error({ err: minerFee_ }, "impossible to get fee for onchain payment")
      addAttributesToCurrentSpan({
        "payOnChainByWalletId.errorGettingMinerFee": true,
      })
      minerFee = estimatedFee
    } else {
      minerFee = minerFee_
    }

    const imbalanceCalculator = ImbalanceCalculator({
      method: feeConfig.withdrawMethod,
      volumeLightningFn: LedgerService().lightningTxBaseVolumeSince,
      volumeOnChainFn: LedgerService().onChainTxBaseVolumeSince,
      sinceDaysAgo: feeConfig.withdrawDaysLookback,
    })

    const imbalance = await imbalanceCalculator.getSwapOutImbalance(senderWallet)
    if (imbalance instanceof Error) return imbalance

    const fees = withdrawFeeCalculator.onChainWithdrawalFee({
      amount: amountToSend,
      minerFee,
      minBankFee: toSats(senderAccount.withdrawFee || feeConfig.withdrawDefaultMin),
      imbalance,
    })

    const totalFee = fees.totalFee
    const bankFee = fees.bankFee

    addAttributesToCurrentSpan({
      "payOnChainByWalletId.actualMinerFee": `${minerFee}`,
      "payOnChainByWalletId.totalFee": `${totalFee}`,
      "payOnChainByWalletId.bankFee": `${bankFee}`,
    })

    const sats = toSats(amountToSend + totalFee)

    const amountDisplayCurrency = dCConverter.fromSats(sats)
    const totalFeeDisplayCurrency = dCConverter.fromSats(totalFee)

    const journal = await ledgerService.addOnChainTxSend({
      walletId: senderWallet.id,
      walletCurrency: senderWallet.currency,
      txHash,
      description: memo || "",
      sats,
      totalFee,
      bankFee,
      amountDisplayCurrency,
      payeeAddress: address,
      sendAll,
      totalFeeDisplayCurrency,
    })
    if (journal instanceof Error) return journal

    return PaymentSendStatus.Success
  })
}
