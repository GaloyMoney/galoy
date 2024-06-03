import { toSats } from "@/domain/bitcoin"
import { UsdDisplayCurrency, toCents } from "@/domain/fiat"
import { LedgerTransactionType } from "@/domain/ledger"

const displayArgsFromArgs = ({
  senderAmountDisplayCurrency,
  senderFeeDisplayCurrency,
  senderDisplayCurrency,

  recipientAmountDisplayCurrency,
  recipientFeeDisplayCurrency,
  recipientDisplayCurrency,
}: {
  senderAmountDisplayCurrency: DisplayCurrencyBaseAmount
  senderFeeDisplayCurrency: DisplayCurrencyBaseAmount
  senderDisplayCurrency: DisplayCurrency

  recipientAmountDisplayCurrency: DisplayCurrencyBaseAmount
  recipientFeeDisplayCurrency: DisplayCurrencyBaseAmount
  recipientDisplayCurrency: DisplayCurrency
}) => ({
  sender: {
    displayAmount: senderAmountDisplayCurrency,
    displayFee: senderFeeDisplayCurrency,
    displayCurrency: senderDisplayCurrency,
  },
  recipient: {
    displayAmount: recipientAmountDisplayCurrency,
    displayFee: recipientFeeDisplayCurrency,
    displayCurrency: recipientDisplayCurrency,
  },
})

const internalMetadataAmounts = ({
  centsAmount,
  centsFee,
}: {
  centsAmount: bigint
  centsFee: bigint
}): DisplayTxnAmounts => ({
  displayAmount: Number(centsAmount) as DisplayCurrencyBaseAmount,
  displayFee: Number(centsFee) as DisplayCurrencyBaseAmount,
  displayCurrency: UsdDisplayCurrency,
})

const debitOrCreditMetadataAmounts = ({
  centsAmount,
  centsFee,

  displayAmount,
  displayFee,
  displayCurrency,
}: {
  centsAmount: bigint
  centsFee: bigint
} & DisplayTxnAmounts): {
  debitOrCreditAdditionalMetadata: DisplayTxnAmounts
  internalAccountsAdditionalMetadata: DisplayTxnAmounts
} => {
  const walletUsdAmount = Number(centsAmount) as DisplayCurrencyBaseAmount
  const walletUsdFee = Number(centsFee) as DisplayCurrencyBaseAmount

  const resultDisplayAmount =
    displayCurrency === UsdDisplayCurrency ? walletUsdAmount : displayAmount
  const resultDisplayFee =
    displayCurrency === UsdDisplayCurrency ? walletUsdFee : displayFee

  return {
    debitOrCreditAdditionalMetadata: {
      displayAmount: resultDisplayAmount,
      displayFee: resultDisplayFee,
      displayCurrency,
    },
    internalAccountsAdditionalMetadata: internalMetadataAmounts({
      centsAmount,
      centsFee,
    }),
  }
}

const additionalMetadataAmounts = ({
  centsAmount,
  centsFee,
  sender,
  recipient,
}: {
  centsAmount: bigint
  centsFee: bigint
  sender: DisplayTxnAmounts
  recipient: DisplayTxnAmounts
}): {
  debitAccountAdditionalMetadata: DisplayTxnAmounts
  creditAccountAdditionalMetadata: DisplayTxnAmounts
  internalAccountsAdditionalMetadata: DisplayTxnAmounts
} => {
  const {
    debitOrCreditAdditionalMetadata: debitAccountAdditionalMetadata,
    internalAccountsAdditionalMetadata,
  } = debitOrCreditMetadataAmounts({
    centsAmount,
    centsFee,
    ...sender,
  })

  const { debitOrCreditAdditionalMetadata: creditAccountAdditionalMetadata } =
    debitOrCreditMetadataAmounts({
      centsAmount,
      centsFee,
      ...recipient,
    })

  return {
    debitAccountAdditionalMetadata,
    creditAccountAdditionalMetadata,
    internalAccountsAdditionalMetadata,
  }
}

export const LnSendLedgerMetadata = ({
  paymentHash,
  pubkey,
  paymentAmounts,
  feeDisplayCurrency: displayFee,
  amountDisplayCurrency: displayAmount,
  displayCurrency,
  feeKnownInAdvance,
  memoOfPayer,
}: {
  paymentHash: PaymentHash
  pubkey: Pubkey | undefined
  paymentAmounts: AmountsAndFees

  feeDisplayCurrency: DisplayCurrencyBaseAmount
  amountDisplayCurrency: DisplayCurrencyBaseAmount
  displayCurrency: DisplayCurrency

  feeKnownInAdvance: boolean
  memoOfPayer?: string
}) => {
  const {
    btcPaymentAmount: { amount: satsAmount },
    usdPaymentAmount: { amount: centsAmount },
    btcProtocolAndBankFee: { amount: satsFee },
    usdProtocolAndBankFee: { amount: centsFee },
  } = paymentAmounts

  const metadata: AddLnSendLedgerMetadata = {
    type: LedgerTransactionType.Payment,
    pending: true,
    hash: paymentHash,
    pubkey,
    feeKnownInAdvance,
    memoPayer: memoOfPayer,

    satsAmount: toSats(satsAmount),
    satsFee: toSats(satsFee),
    centsAmount: toCents(centsAmount),
    centsFee: toCents(centsFee),
  }

  const {
    debitOrCreditAdditionalMetadata: debitAccountAdditionalMetadata,
    internalAccountsAdditionalMetadata,
  } = debitOrCreditMetadataAmounts({
    centsAmount,
    centsFee,

    displayAmount,
    displayFee,
    displayCurrency,
  })

  return {
    metadata,
    debitAccountAdditionalMetadata,
    internalAccountsAdditionalMetadata,
  }
}

export const OnChainSendLedgerMetadata = ({
  paymentAmounts,
  feeDisplayCurrency: displayFee,
  amountDisplayCurrency: displayAmount,
  displayCurrency,
  payeeAddresses,
  sendAll,
  memoOfPayer,
}: {
  paymentAmounts: AmountsAndFees

  feeDisplayCurrency: DisplayCurrencyBaseAmount
  amountDisplayCurrency: DisplayCurrencyBaseAmount
  displayCurrency: DisplayCurrency

  payeeAddresses: OnChainAddress[]
  sendAll: boolean
  memoOfPayer?: string
}) => {
  const {
    btcPaymentAmount: { amount: satsAmount },
    usdPaymentAmount: { amount: centsAmount },
    btcProtocolAndBankFee: { amount: satsFee },
    usdProtocolAndBankFee: { amount: centsFee },
  } = paymentAmounts

  const metadata: AddOnchainSendLedgerMetadata = {
    type: LedgerTransactionType.OnchainPayment,
    pending: true,
    hash: undefined,
    payee_addresses: payeeAddresses,
    sendAll,
    memoPayer: memoOfPayer,

    satsAmount: toSats(satsAmount),
    satsFee: toSats(satsFee),
    centsAmount: toCents(centsAmount),
    centsFee: toCents(centsFee),
  }

  const {
    debitOrCreditAdditionalMetadata: debitAccountAdditionalMetadata,
    internalAccountsAdditionalMetadata,
  } = debitOrCreditMetadataAmounts({
    centsAmount,
    centsFee,

    displayAmount,
    displayFee,
    displayCurrency,
  })

  return {
    metadata,
    debitAccountAdditionalMetadata,
    internalAccountsAdditionalMetadata,
  }
}

export const OnChainReceiveLedgerMetadata = ({
  onChainTxHash,
  onChainTxVout,
  paymentAmounts,
  feeDisplayCurrency: displayFee,
  amountDisplayCurrency: displayAmount,
  displayCurrency,

  payeeAddresses,
  newAddressRequestId,
}: {
  onChainTxHash: OnChainTxHash
  onChainTxVout: OnChainTxVout
  paymentAmounts: AmountsAndFees

  feeDisplayCurrency: DisplayCurrencyBaseAmount
  amountDisplayCurrency: DisplayCurrencyBaseAmount
  displayCurrency: DisplayCurrency

  payeeAddresses: OnChainAddress[]
  newAddressRequestId: OnChainAddressRequestId | undefined
}) => {
  const {
    btcPaymentAmount: { amount: satsAmount },
    usdPaymentAmount: { amount: centsAmount },
    btcProtocolAndBankFee: { amount: satsFee },
    usdProtocolAndBankFee: { amount: centsFee },
  } = paymentAmounts

  const metadata: OnChainReceiveLedgerMetadata = {
    type: LedgerTransactionType.OnchainReceipt,
    pending: false,
    hash: onChainTxHash,
    vout: onChainTxVout,
    payee_addresses: payeeAddresses,
    request_id: newAddressRequestId,

    // Amounts are after fee is deducted
    satsAmount: toSats(satsAmount),
    satsFee: toSats(satsFee),
    centsAmount: toCents(centsAmount),
    centsFee: toCents(centsFee),
  }

  const {
    debitOrCreditAdditionalMetadata: creditAccountAdditionalMetadata,
    internalAccountsAdditionalMetadata,
  } = debitOrCreditMetadataAmounts({
    centsAmount,
    centsFee,

    displayAmount,
    displayFee,
    displayCurrency,
  })

  return {
    metadata,
    creditAccountAdditionalMetadata,
    internalAccountsAdditionalMetadata,
  }
}

export const LnReceiveLedgerMetadata = ({
  paymentHash,
  pubkey,
  paymentAmounts,

  feeDisplayCurrency: displayFee,
  amountDisplayCurrency: displayAmount,
  displayCurrency,
}: {
  paymentHash: PaymentHash
  pubkey: Pubkey
  paymentAmounts: AmountsAndFees

  feeDisplayCurrency: DisplayCurrencyBaseAmount
  amountDisplayCurrency: DisplayCurrencyBaseAmount
  displayCurrency: DisplayCurrency
}) => {
  const {
    btcPaymentAmount: { amount: satsAmount },
    usdPaymentAmount: { amount: centsAmount },
    btcProtocolAndBankFee: { amount: satsFee },
    usdProtocolAndBankFee: { amount: centsFee },
  } = paymentAmounts

  const metadata: LnReceiveLedgerMetadata = {
    type: LedgerTransactionType.Invoice,
    pending: false,
    hash: paymentHash,
    pubkey,

    // Amounts are after fee is deducted
    satsAmount: toSats(satsAmount),
    satsFee: toSats(satsFee),
    centsAmount: toCents(centsAmount),
    centsFee: toCents(centsFee),
  }

  const {
    debitOrCreditAdditionalMetadata: creditAccountAdditionalMetadata,
    internalAccountsAdditionalMetadata,
  } = debitOrCreditMetadataAmounts({
    centsAmount,
    centsFee,

    displayAmount,
    displayFee,
    displayCurrency,
  })

  return {
    metadata,
    creditAccountAdditionalMetadata,
    internalAccountsAdditionalMetadata,
  }
}

export const LnFeeReimbursementReceiveLedgerMetadata = ({
  paymentAmounts,
  paymentHash,
  journalId,
  feeDisplayCurrency: displayFee,
  amountDisplayCurrency: displayAmount,
  displayCurrency,
}: {
  paymentAmounts: AmountsAndFees
  paymentHash: PaymentHash
  journalId: LedgerJournalId
  feeDisplayCurrency: DisplayCurrencyBaseAmount
  amountDisplayCurrency: DisplayCurrencyBaseAmount
  displayCurrency: DisplayCurrency
}) => {
  const {
    btcPaymentAmount: { amount: satsAmount },
    usdPaymentAmount: { amount: centsAmount },
    btcProtocolAndBankFee: { amount: satsFee },
    usdProtocolAndBankFee: { amount: centsFee },
  } = paymentAmounts

  const metadata: FeeReimbursementLedgerMetadata = {
    type: LedgerTransactionType.LnFeeReimbursement,
    hash: paymentHash,
    related_journal: journalId,
    pending: false,

    satsAmount: toSats(satsAmount),
    satsFee: toSats(satsFee),
    centsAmount: toCents(centsAmount),
    centsFee: toCents(centsFee),
  }

  const {
    debitOrCreditAdditionalMetadata: creditAccountAdditionalMetadata,
    internalAccountsAdditionalMetadata,
  } = debitOrCreditMetadataAmounts({
    centsAmount,
    centsFee,

    displayAmount,
    displayFee,
    displayCurrency,
  })

  return {
    metadata,
    creditAccountAdditionalMetadata,
    internalAccountsAdditionalMetadata,
  }
}

export const LnFailedPaymentReceiveLedgerMetadata = ({
  paymentAmounts,
  paymentHash,
  journalId,
  feeDisplayCurrency: displayFee,
  amountDisplayCurrency: displayAmount,
  displayCurrency,
}: {
  paymentAmounts: AmountsAndFees
  paymentHash: PaymentHash
  journalId: LedgerJournalId
  feeDisplayCurrency: DisplayCurrencyBaseAmount
  amountDisplayCurrency: DisplayCurrencyBaseAmount
  displayCurrency: DisplayCurrency
}) => {
  const {
    btcPaymentAmount: { amount: satsAmount },
    usdPaymentAmount: { amount: centsAmount },
    btcProtocolAndBankFee: { amount: satsFee },
    usdProtocolAndBankFee: { amount: centsFee },
  } = paymentAmounts

  const metadata: FailedPaymentLedgerMetadata = {
    type: LedgerTransactionType.Payment,
    hash: paymentHash,
    related_journal: journalId,
    pending: false,

    satsAmount: toSats(satsAmount),
    satsFee: toSats(satsFee),
    centsAmount: toCents(centsAmount),
    centsFee: toCents(centsFee),
  }

  const {
    debitOrCreditAdditionalMetadata: creditAccountAdditionalMetadata,
    internalAccountsAdditionalMetadata,
  } = debitOrCreditMetadataAmounts({
    centsAmount,
    centsFee,

    displayAmount,
    displayFee,
    displayCurrency,
  })

  return {
    metadata,
    creditAccountAdditionalMetadata,
    internalAccountsAdditionalMetadata,
  }
}

export const OnChainIntraledgerLedgerMetadata = ({
  payeeAddresses,
  sendAll,
  paymentAmounts,
  memoOfPayer,
  senderUsername,
  recipientUsername,
  ...displayArgs
}: {
  payeeAddresses: OnChainAddress[]
  sendAll: boolean
  paymentAmounts: AmountsAndFees

  senderFeeDisplayCurrency: DisplayCurrencyBaseAmount
  senderAmountDisplayCurrency: DisplayCurrencyBaseAmount
  senderDisplayCurrency: DisplayCurrency

  recipientFeeDisplayCurrency: DisplayCurrencyBaseAmount
  recipientAmountDisplayCurrency: DisplayCurrencyBaseAmount
  recipientDisplayCurrency: DisplayCurrency

  memoOfPayer?: string
  senderUsername?: Username
  recipientUsername?: Username
}) => {
  const {
    btcPaymentAmount: { amount: satsAmount },
    usdPaymentAmount: { amount: centsAmount },
    btcProtocolAndBankFee: { amount: satsFee },
    usdProtocolAndBankFee: { amount: centsFee },
  } = paymentAmounts

  const metadata: AddOnChainIntraledgerSendLedgerMetadata = {
    type: LedgerTransactionType.OnchainIntraLedger,
    pending: false,
    memoPayer: undefined,
    username: senderUsername,
    payee_addresses: payeeAddresses,
    sendAll,

    satsFee: toSats(satsFee),

    centsAmount: toCents(centsAmount),
    satsAmount: toSats(satsAmount),
    centsFee: toCents(centsFee),
  }

  const {
    debitAccountAdditionalMetadata,
    creditAccountAdditionalMetadata,
    internalAccountsAdditionalMetadata,
  } = additionalMetadataAmounts({
    centsAmount,
    centsFee,

    ...displayArgsFromArgs(displayArgs),
  })

  return {
    metadata,
    debitAccountAdditionalMetadata: {
      ...debitAccountAdditionalMetadata,
      memoPayer: memoOfPayer,
      username: recipientUsername,
    },
    creditAccountAdditionalMetadata,
    internalAccountsAdditionalMetadata,
  }
}

export const WalletIdIntraledgerLedgerMetadata = ({
  paymentAmounts,
  memoOfPayer,
  senderUsername,
  recipientUsername,
  ...displayArgs
}: {
  paymentAmounts: AmountsAndFees

  senderFeeDisplayCurrency: DisplayCurrencyBaseAmount
  senderAmountDisplayCurrency: DisplayCurrencyBaseAmount
  senderDisplayCurrency: DisplayCurrency

  recipientFeeDisplayCurrency: DisplayCurrencyBaseAmount
  recipientAmountDisplayCurrency: DisplayCurrencyBaseAmount
  recipientDisplayCurrency: DisplayCurrency

  memoOfPayer?: string
  senderUsername?: Username
  recipientUsername?: Username
}) => {
  const {
    btcPaymentAmount: { amount: satsAmount },
    usdPaymentAmount: { amount: centsAmount },
    btcProtocolAndBankFee: { amount: satsFee },
    usdProtocolAndBankFee: { amount: centsFee },
  } = paymentAmounts

  const metadata: AddWalletIdIntraledgerSendLedgerMetadata = {
    type: LedgerTransactionType.IntraLedger,
    pending: false,
    memoPayer: memoOfPayer,
    username: senderUsername,

    satsFee: toSats(satsFee),

    centsAmount: toCents(centsAmount),
    satsAmount: toSats(satsAmount),
    centsFee: toCents(centsFee),
  }

  const {
    debitAccountAdditionalMetadata,
    creditAccountAdditionalMetadata,
    internalAccountsAdditionalMetadata,
  } = additionalMetadataAmounts({
    centsAmount,
    centsFee,

    ...displayArgsFromArgs(displayArgs),
  })

  return {
    metadata,
    debitAccountAdditionalMetadata: {
      ...debitAccountAdditionalMetadata,
      username: recipientUsername,
    },
    creditAccountAdditionalMetadata,
    internalAccountsAdditionalMetadata,
  }
}

export const LnIntraledgerLedgerMetadata = ({
  paymentHash,
  pubkey,
  paymentAmounts,
  memoOfPayer,
  senderUsername,
  recipientUsername,
  ...displayArgs
}: {
  paymentHash: PaymentHash
  pubkey: Pubkey
  paymentAmounts: AmountsAndFees

  senderFeeDisplayCurrency: DisplayCurrencyBaseAmount
  senderAmountDisplayCurrency: DisplayCurrencyBaseAmount
  senderDisplayCurrency: DisplayCurrency

  recipientFeeDisplayCurrency: DisplayCurrencyBaseAmount
  recipientAmountDisplayCurrency: DisplayCurrencyBaseAmount
  recipientDisplayCurrency: DisplayCurrency

  memoOfPayer?: string
  senderUsername?: Username
  recipientUsername?: Username
}) => {
  const {
    btcPaymentAmount: { amount: satsAmount },
    usdPaymentAmount: { amount: centsAmount },
    btcProtocolAndBankFee: { amount: satsFee },
    usdProtocolAndBankFee: { amount: centsFee },
  } = paymentAmounts

  const metadata: AddLnIntraledgerSendLedgerMetadata = {
    type: LedgerTransactionType.LnIntraLedger,
    pending: false,
    memoPayer: undefined,
    username: senderUsername,
    hash: paymentHash,
    pubkey,

    satsFee: toSats(satsFee),

    centsAmount: toCents(centsAmount),
    satsAmount: toSats(satsAmount),
    centsFee: toCents(centsFee),
  }

  const {
    debitAccountAdditionalMetadata,
    creditAccountAdditionalMetadata,
    internalAccountsAdditionalMetadata,
  } = additionalMetadataAmounts({
    centsAmount,
    centsFee,

    ...displayArgsFromArgs(displayArgs),
  })

  return {
    metadata,
    debitAccountAdditionalMetadata: {
      ...debitAccountAdditionalMetadata,
      memoPayer: memoOfPayer,
      username: recipientUsername,
    },
    creditAccountAdditionalMetadata,
    internalAccountsAdditionalMetadata,
  }
}

export const OnChainTradeIntraAccountLedgerMetadata = ({
  payeeAddresses,
  sendAll,
  paymentAmounts,
  memoOfPayer,
  ...displayArgs
}: {
  payeeAddresses: OnChainAddress[]
  sendAll: boolean
  paymentAmounts: AmountsAndFees

  senderFeeDisplayCurrency: DisplayCurrencyBaseAmount
  senderAmountDisplayCurrency: DisplayCurrencyBaseAmount
  senderDisplayCurrency: DisplayCurrency

  memoOfPayer?: string
}) => {
  const tradeDisplayArgs = {
    ...displayArgs,
    recipientFeeDisplayCurrency: displayArgs.senderFeeDisplayCurrency,
    recipientAmountDisplayCurrency: displayArgs.senderAmountDisplayCurrency,
    recipientDisplayCurrency: displayArgs.senderDisplayCurrency,
  }

  const {
    btcPaymentAmount: { amount: satsAmount },
    usdPaymentAmount: { amount: centsAmount },
    btcProtocolAndBankFee: { amount: satsFee },
    usdProtocolAndBankFee: { amount: centsFee },
  } = paymentAmounts

  const metadata: AddOnChainTradeIntraAccountLedgerMetadata = {
    type: LedgerTransactionType.OnChainTradeIntraAccount,
    pending: false,
    memoPayer: undefined,
    payee_addresses: payeeAddresses,
    sendAll,

    satsFee: toSats(satsFee),

    centsAmount: toCents(centsAmount),
    satsAmount: toSats(satsAmount),
    centsFee: toCents(centsFee),
  }

  const {
    debitAccountAdditionalMetadata,
    creditAccountAdditionalMetadata,
    internalAccountsAdditionalMetadata,
  } = additionalMetadataAmounts({
    centsAmount,
    centsFee,

    ...displayArgsFromArgs(tradeDisplayArgs),
  })

  return {
    metadata,
    debitAccountAdditionalMetadata: {
      ...debitAccountAdditionalMetadata,
      memoPayer: memoOfPayer,
    },
    creditAccountAdditionalMetadata,
    internalAccountsAdditionalMetadata,
  }
}

export const WalletIdTradeIntraAccountLedgerMetadata = ({
  paymentAmounts,
  memoOfPayer,
  ...displayArgs
}: {
  paymentAmounts: AmountsAndFees

  senderFeeDisplayCurrency: DisplayCurrencyBaseAmount
  senderAmountDisplayCurrency: DisplayCurrencyBaseAmount
  senderDisplayCurrency: DisplayCurrency

  memoOfPayer?: string
}) => {
  const tradeDisplayArgs = {
    ...displayArgs,
    recipientFeeDisplayCurrency: displayArgs.senderFeeDisplayCurrency,
    recipientAmountDisplayCurrency: displayArgs.senderAmountDisplayCurrency,
    recipientDisplayCurrency: displayArgs.senderDisplayCurrency,
  }

  const {
    btcPaymentAmount: { amount: satsAmount },
    usdPaymentAmount: { amount: centsAmount },
    btcProtocolAndBankFee: { amount: satsFee },
    usdProtocolAndBankFee: { amount: centsFee },
  } = paymentAmounts

  const metadata: AddWalletIdTradeIntraAccountLedgerMetadata = {
    type: LedgerTransactionType.WalletIdTradeIntraAccount,
    pending: false,
    memoPayer: memoOfPayer,

    satsFee: toSats(satsFee),

    centsAmount: toCents(centsAmount),
    satsAmount: toSats(satsAmount),
    centsFee: toCents(centsFee),
  }

  const {
    debitAccountAdditionalMetadata,
    creditAccountAdditionalMetadata,
    internalAccountsAdditionalMetadata,
  } = additionalMetadataAmounts({
    centsAmount,
    centsFee,

    ...displayArgsFromArgs(tradeDisplayArgs),
  })

  return {
    metadata,
    debitAccountAdditionalMetadata,
    creditAccountAdditionalMetadata,
    internalAccountsAdditionalMetadata,
  }
}

export const LnTradeIntraAccountLedgerMetadata = ({
  paymentHash,
  pubkey,
  paymentAmounts,
  memoOfPayer,
  ...displayArgs
}: {
  paymentHash: PaymentHash
  pubkey: Pubkey
  paymentAmounts: AmountsAndFees

  senderFeeDisplayCurrency: DisplayCurrencyBaseAmount
  senderAmountDisplayCurrency: DisplayCurrencyBaseAmount
  senderDisplayCurrency: DisplayCurrency

  memoOfPayer?: string
}) => {
  const tradeDisplayArgs = {
    ...displayArgs,
    recipientFeeDisplayCurrency: displayArgs.senderFeeDisplayCurrency,
    recipientAmountDisplayCurrency: displayArgs.senderAmountDisplayCurrency,
    recipientDisplayCurrency: displayArgs.senderDisplayCurrency,
  }

  const {
    btcPaymentAmount: { amount: satsAmount },
    usdPaymentAmount: { amount: centsAmount },
    btcProtocolAndBankFee: { amount: satsFee },
    usdProtocolAndBankFee: { amount: centsFee },
  } = paymentAmounts

  const metadata: AddLnTradeIntraAccountLedgerMetadata = {
    type: LedgerTransactionType.LnTradeIntraAccount,
    pending: false,
    memoPayer: undefined,
    hash: paymentHash,
    pubkey,

    satsFee: toSats(satsFee),
    centsAmount: toCents(centsAmount),
    satsAmount: toSats(satsAmount),
    centsFee: toCents(centsFee),
  }

  const {
    debitAccountAdditionalMetadata,
    creditAccountAdditionalMetadata,
    internalAccountsAdditionalMetadata,
  } = additionalMetadataAmounts({
    centsAmount,
    centsFee,

    ...displayArgsFromArgs(tradeDisplayArgs),
  })

  return {
    metadata,
    debitAccountAdditionalMetadata: {
      ...debitAccountAdditionalMetadata,
      memoPayer: memoOfPayer,
    },
    creditAccountAdditionalMetadata,
    internalAccountsAdditionalMetadata,
  }
}

export const OnChainFeeReconciliationLedgerMetadata = ({
  payoutId,
  txHash,
  pending,
}: {
  payoutId: PayoutId
  txHash: OnChainTxHash
  pending: boolean
}) => {
  const metadata: AddOnChainFeeReconciliationLedgerMetadata = {
    type: LedgerTransactionType.OnchainPayment,
    pending,
    payout_id: payoutId,
    hash: txHash,
  }

  return {
    metadata,
  }
}

// Non-LedgerFacade constructors from legacy admin service

export const LnChannelOpenOrClosingFee = ({ txId }: { txId: OnChainTxHash }) => {
  const metadata: LnChannelOpenOrClosingFee = {
    type: LedgerTransactionType.Fee,
    pending: false,
    txid: txId,
  }

  return metadata
}

export const Escrow = () => {
  const metadata: LedgerMetadata = {
    type: LedgerTransactionType.Escrow,
    pending: false,
  }

  return metadata
}

export const LnRoutingRevenue = (collectedOn: Date) => {
  const metadata: LnRoutingRevenueLedgerMetadata = {
    type: LedgerTransactionType.RoutingRevenue,
    feesCollectedOn: collectedOn.toDateString(),
    pending: false,
  }

  return metadata
}
