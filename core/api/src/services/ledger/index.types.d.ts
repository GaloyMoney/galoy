type RecordSendArgs = {
  description: string
  senderWalletDescriptor: WalletDescriptor<WalletCurrency>
  amountToDebitSender: {
    usd: UsdPaymentAmount
    btc: BtcPaymentAmount
  }
  metadata: SendLedgerMetadata
  additionalDebitMetadata: TxMetadata
  additionalInternalMetadata: TxMetadata
  bankFee?: {
    usd: UsdPaymentAmount
    btc: BtcPaymentAmount
  }
}

type RecordReceiveArgs = {
  description: string
  recipientWalletDescriptor: WalletDescriptor<WalletCurrency>
  amountToCreditReceiver: {
    usd: UsdPaymentAmount
    btc: BtcPaymentAmount
  }
  metadata: ReceiveLedgerMetadata
  additionalCreditMetadata: TxMetadata
  additionalInternalMetadata: TxMetadata
  externalId?: LedgerExternalId
  txMetadata?: LnLedgerTransactionMetadataUpdate
  bankFee?: {
    usd: UsdPaymentAmount
    btc: BtcPaymentAmount
  }
}

type RecordBankownerReconciliationArgs = {
  description: string
  amount: {
    usd: UsdPaymentAmount
    btc: BtcPaymentAmount
  }
}

type RecordIntraledgerArgs = {
  description: string
  senderWalletDescriptor: WalletDescriptor<WalletCurrency>
  recipientWalletDescriptor: WalletDescriptor<WalletCurrency>
  amount: {
    usd: UsdPaymentAmount
    btc: BtcPaymentAmount
  }
  metadata: IntraledgerLedgerMetadata
  additionalDebitMetadata: TxMetadata
  additionalCreditMetadata: TxMetadata
  additionalInternalMetadata: TxMetadata
}

type LedgerMetadata = {
  type: LedgerTransactionType
  pending: boolean
}

type LedgerSendMetadata = {
  memoPayer?: string
}

type LnReceiveLedgerMetadata = LedgerMetadata &
  SendAmountsMetadata & {
    hash: PaymentHash
    pubkey: Pubkey
  }

type OnChainReceiveLedgerMetadata = LedgerMetadata &
  SendAmountsMetadata & {
    hash: OnChainTxHash
    vout: OnChainTxVout
    payee_addresses: OnChainAddress[]
    request_id: OnChainAddressRequestId | undefined
  }

type SendAmountsMetadata = {
  satsAmount: Satoshis
  centsAmount: UsdCents
  satsFee: Satoshis
  centsFee: UsdCents
}

type IntraLedgerSendAmountsMetadata = {
  satsAmount: Satoshis
  centsAmount: UsdCents
  satsFee: Satoshis
  centsFee: UsdCents
}

type AddLnSendLedgerMetadata = LedgerMetadata &
  LedgerSendMetadata &
  SendAmountsMetadata & {
    hash: PaymentHash
    pubkey: Pubkey | undefined
    feeKnownInAdvance: boolean
  }

type AddOnchainSendLedgerMetadata = LedgerMetadata &
  LedgerSendMetadata &
  SendAmountsMetadata & {
    hash: undefined
    payee_addresses: OnChainAddress[]
    sendAll: boolean
  }

type NonIntraledgerLedgerMetadata = LedgerMetadata & {
  usd: number // to be removed when "centAmount" takes over
  fee: Satoshis
  feeUsd: number // to be removed when "centFee" takes over
}

type AddColdStorageLedgerMetadata = NonIntraledgerLedgerMetadata & {
  hash: OnChainTxHash
  payee_addresses: OnChainAddress[]
  currency: WalletCurrency
}

type AddColdStorageReceiveLedgerMetadata = AddColdStorageLedgerMetadata

type AddColdStorageSendLedgerMetadata = AddColdStorageLedgerMetadata

type IntraledgerSendBaseMetadata = LedgerMetadata &
  LedgerSendMetadata & {
    username?: Username
  }

type AddLnIntraledgerSendLedgerMetadata = IntraledgerSendBaseMetadata &
  IntraLedgerSendAmountsMetadata & {
    hash: PaymentHash
    pubkey: Pubkey
  }

type AddLnTradeIntraAccountLedgerMetadata = Omit<
  AddLnIntraledgerSendLedgerMetadata,
  "username"
>

type AddOnChainIntraledgerSendLedgerMetadata = IntraledgerSendBaseMetadata &
  IntraLedgerSendAmountsMetadata & {
    payee_addresses: OnChainAddress[]
    sendAll: boolean
  }

type AddOnChainTradeIntraAccountLedgerMetadata = Omit<
  AddOnChainIntraledgerSendLedgerMetadata,
  "username"
>

type AddWalletIdIntraledgerSendLedgerMetadata = IntraledgerSendBaseMetadata &
  IntraLedgerSendAmountsMetadata

type AddWalletIdTradeIntraAccountLedgerMetadata = Omit<
  AddWalletIdIntraledgerSendLedgerMetadata,
  "username"
>

type AddOnChainFeeReconciliationLedgerMetadata = {
  type: LedgerTransactionType
  hash: OnChainTxHash
  payout_id: PayoutId
  pending: boolean
}

type ReimbursementLedgerMetadata = SendAmountsMetadata & {
  hash: PaymentHash
  pending: boolean
  related_journal: LedgerJournalId
}

type FeeReimbursementLedgerMetadata = ReimbursementLedgerMetadata & {
  type: LedgerTransactionTypeObject["LnFeeReimbursement"]
}

type FailedPaymentLedgerMetadata = ReimbursementLedgerMetadata & {
  type: LedgerTransactionTypeObject["Payment"]
}

type LnRoutingRevenueLedgerMetadata = LedgerMetadata & {
  feesCollectedOn: string
}

type LnChannelOpenOrClosingFee = LedgerMetadata & {
  txid: OnChainTxHash
}

type LoadLedgerParams = {
  bankOwnerWalletResolver: () => Promise<WalletId>
  dealerBtcWalletResolver: () => Promise<WalletId>
  dealerUsdWalletResolver: () => Promise<WalletId>
  funderWalletResolver: () => Promise<WalletId>
}

type ReceiveLedgerMetadata =
  | FeeReimbursementLedgerMetadata
  | FailedPaymentLedgerMetadata
  | LnReceiveLedgerMetadata
  | OnChainReceiveLedgerMetadata

type IntraledgerLedgerMetadata =
  | AddOnChainIntraledgerSendLedgerMetadata
  | AddLnIntraledgerSendLedgerMetadata
  | AddWalletIdIntraledgerSendLedgerMetadata

type SendLedgerMetadata = AddOnchainSendLedgerMetadata | AddLnSendLedgerMetadata

type DisplayTxnAmountsArg = {
  feeDisplayCurrency: DisplayCurrencyBaseAmount
  amountDisplayCurrency: DisplayCurrencyBaseAmount
  displayCurrency: DisplayCurrency
}

// The following is needed for src/services/ledger/paginated-ledger.ts
declare module "medici/build/helper/parse/parseFilterQuery"
