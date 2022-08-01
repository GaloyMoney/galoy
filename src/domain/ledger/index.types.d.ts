type LedgerError = import("./errors").LedgerError
type FeeDifferenceError = import("./errors").FeeDifferenceError
type LedgerServiceError = import("./errors").LedgerServiceError

declare const liabilitiesWalletId: unique symbol
type LiabilitiesWalletId = string & { [liabilitiesWalletId]: never }

type LedgerTransactionId = string & { readonly brand: unique symbol }
type LedgerJournalId = string & { readonly brand: unique symbol }
type LedgerTransactionType =
  typeof import("./index").LedgerTransactionType[keyof typeof import("./index").LedgerTransactionType]

type ExtendedLedgerTransactionType =
  typeof import("./index").ExtendedLedgerTransactionType[keyof typeof import("./index").ExtendedLedgerTransactionType]

type LedgerJournal = {
  readonly journalId: LedgerJournalId
  readonly voided: boolean
  readonly transactionIds: LedgerTransactionId[]
}

// Differentiate fields depending on what 'type' we have (see domain/wallets/index.types.d.ts)
type LedgerTransaction<S extends WalletCurrency> = {
  readonly id: LedgerTransactionId
  readonly walletId: WalletId | undefined // FIXME create a subclass so that this field is always set for liabilities wallets
  readonly type: LedgerTransactionType
  readonly debit: S extends "BTC" ? Satoshis : UsdCents
  readonly credit: S extends "BTC" ? Satoshis : UsdCents
  readonly fee: Satoshis
  readonly currency: S
  readonly timestamp: Date
  readonly pendingConfirmation: boolean
  readonly journalId: LedgerJournalId

  readonly lnMemo?: string

  readonly usd: number
  readonly feeUsd: number

  // for IntraLedger
  readonly recipientWalletId?: WalletId
  readonly username?: Username
  readonly memoFromPayer?: string

  // for ln
  readonly paymentHash?: PaymentHash
  readonly pubkey?: Pubkey
  readonly feeKnownInAdvance: boolean

  readonly satsAmount?: Satoshis
  readonly centsAmount?: UsdCents
  readonly satsFee?: Satoshis
  readonly centsFee?: UsdCents

  readonly displayAmount?: DisplayCurrencyBaseAmount
  readonly displayFee?: DisplayCurrencyBaseAmount
  readonly displayCurrency?: DisplayCurrency

  // for onchain
  readonly address?: OnChainAddress
  readonly txHash?: OnChainTxHash
}

type LedgerTransactionWithMetadata<S extends WalletCurrency> = {
  hasMetadata: true
} & LedgerTransaction<S> &
  LedgerTransactionMetadata

type ReceiveOnChainTxArgs = {
  walletId: WalletId
  walletCurrency: WalletCurrency
  txHash: OnChainTxHash
  sats: Satoshis
  fee: Satoshis
  amountDisplayCurrency: DisplayCurrencyBaseAmount
  feeDisplayCurrency: DisplayCurrencyBaseAmount
  receivingAddress: OnChainAddress
}

type TxArgs = {
  walletId: WalletId
  walletCurrency: WalletCurrency
  description: string
  sats: Satoshis
  amountDisplayCurrency: DisplayCurrencyBaseAmount
}

type LnTxArgs = TxArgs & {
  paymentHash: PaymentHash
}

type OnChainTxArgs = TxArgs & {
  txHash: OnChainTxHash
  payeeAddress: OnChainAddress
}

type AddLnTxReceiveArgs = LnTxArgs & {
  cents: UsdCents | undefined
  feeInboundLiquidityDisplayCurrency: DisplayCurrencyBaseAmount
  feeInboundLiquidity: Satoshis
}

type AddLnTxSendArgs = LnTxArgs & {
  cents?: UsdCents // move in upper property?
  pubkey: Pubkey
  feeKnownInAdvance: boolean
  feeRouting: Satoshis
  feeRoutingDisplayCurrency: DisplayCurrencyBaseAmount
}

type AddOnChainTxSendArgs = OnChainTxArgs & {
  sendAll: boolean
  totalFee: Satoshis
  bankFee: Satoshis
  totalFeeDisplayCurrency: DisplayCurrencyBaseAmount
}

type AddColdStorageTxReceiveArgs = {
  txHash: OnChainTxHash
  payeeAddress: OnChainAddress
  description: string
  sats: Satoshis
  fee: Satoshis
  amountDisplayCurrency: DisplayCurrencyBaseAmount
  feeDisplayCurrency: DisplayCurrencyBaseAmount
}

type AddColdStorageTxSendArgs = {
  txHash: OnChainTxHash
  payeeAddress: OnChainAddress
  description: string
  sats: Satoshis
  fee: Satoshis
  amountDisplayCurrency: DisplayCurrencyBaseAmount
  feeDisplayCurrency: DisplayCurrencyBaseAmount
}

type IntraledgerTxArgs = {
  senderWalletId: WalletId
  senderWalletCurrency: WalletCurrency
  senderUsername?: Username
  description: string
  sats?: Satoshis
  cents?: UsdCents
  recipientWalletId: WalletId
  recipientWalletCurrency: WalletCurrency
  recipientUsername?: Username
  memoPayer?: string
}

type AddIntraLedgerTxSendArgs = IntraledgerTxArgs & {
  amountDisplayCurrency: DisplayCurrencyBaseAmount
}

type SendIntraledgerTxArgs = IntraledgerTxArgs & {
  recipientUsername?: Username
  shareMemoWithPayee: boolean
  metadata:
    | AddLnIntraledgerSendLedgerMetadata
    | AddOnChainIntraledgerSendLedgerMetadata
    | AddWalletIdIntraledgerSendLedgerMetadata
  paymentHash?: PaymentHash
}

type AddLnIntraledgerTxTransferArgs = AddIntraLedgerTxSendArgs & {
  paymentHash: PaymentHash
  pubkey: Pubkey
}

type AddOnChainIntraledgerTxTransferArgs = AddIntraLedgerTxSendArgs & {
  payeeAddresses: OnChainAddress[]
  sendAll: boolean
}

type AddWalletIdIntraledgerTxTransferArgs = AddIntraLedgerTxSendArgs

type AddLnFeeReeimbursementReceiveArgs<
  S extends WalletCurrency,
  R extends WalletCurrency,
> = {
  walletId: WalletId
  walletCurrency: WalletCurrency
  paymentHash: PaymentHash
  sats: Satoshis
  cents?: UsdCents
  journalId: LedgerJournalId
  revealedPreImage?: RevealedPreImage
  paymentFlow: PaymentFlowState<S, R>
  feeDisplayCurrency: DisplayCurrencyBaseAmount
  amountDisplayCurrency: DisplayCurrencyBaseAmount
  displayCurrency: DisplayCurrency
}

type FeeReimbursement = {
  getReimbursement(
    actualFee: BtcPaymentAmount,
  ): { btc: BtcPaymentAmount; usd: UsdPaymentAmount } | FeeDifferenceError
}

type TxBaseVolume = {
  outgoingBaseAmount: CurrencyBaseAmount
  incomingBaseAmount: CurrencyBaseAmount
}

type TxBaseVolumeAmount<S extends WalletCurrency> = {
  outgoingBaseAmount: PaymentAmount<S>
  incomingBaseAmount: PaymentAmount<S>
}

type TxCentsVolume = {
  outgoingCents: UsdCents
  incomingCents: UsdCents
}

interface IGetVolumeArgs {
  walletId: WalletId
  timestamp: Date
}

interface IGetVolumeAmountArgs {
  walletId: WalletId
  walletCurrency: WalletCurrency
  timestamp: Date
}

type VolumeResult = Promise<TxBaseVolume | LedgerServiceError>
type GetVolumeSinceFn = (args: IGetVolumeArgs) => VolumeResult

type VolumeAmountResult<S extends WalletCurrency> = Promise<
  TxBaseVolumeAmount<S> | LedgerServiceError
>
type GetVolumeAmountSinceFn<S extends WalletCurrency> = (
  args: IGetVolumeAmountArgs,
) => VolumeAmountResult<S>

type RevertLightningPaymentArgs = {
  journalId: LedgerJournalId
  paymentHash: PaymentHash
}

interface ILedgerService {
  updateMetadataByHash(
    ledgerTxMetadata:
      | OnChainLedgerTransactionMetadataUpdate
      | LnLedgerTransactionMetadataUpdate,
  ): Promise<true | LedgerServiceError>

  getTransactionById(
    id: LedgerTransactionId,
  ): Promise<LedgerTransaction<WalletCurrency> | LedgerServiceError>

  getTransactionsByHash(
    paymentHash: PaymentHash | OnChainTxHash,
  ): Promise<LedgerTransaction<WalletCurrency>[] | LedgerServiceError>

  getTransactionsByWalletId(
    walletId: WalletId,
  ): Promise<LedgerTransaction<WalletCurrency>[] | LedgerServiceError>

  getTransactionsByWalletIds(
    walletIds: WalletId[],
  ): Promise<LedgerTransaction<WalletCurrency>[] | LedgerServiceError>

  getTransactionsByWalletIdAndContactUsername(
    walletId: WalletId,
    contactUsername: Username,
  ): Promise<LedgerTransaction<WalletCurrency>[] | LedgerServiceError>

  listPendingPayments(
    walletId: WalletId,
  ): Promise<LedgerTransaction<WalletCurrency>[] | LedgerServiceError>

  listAllPaymentHashes(): AsyncGenerator<PaymentHash | LedgerError>

  getPendingPaymentsCount(walletId: WalletId): Promise<number | LedgerServiceError>

  getWalletBalance(walletId: WalletId): Promise<CurrencyBaseAmount | LedgerServiceError>

  getWalletBalanceAmount<S extends WalletCurrency>(
    walletDescriptor: WalletDescriptor<S>,
  ): Promise<BalanceAmount<S> | LedgerServiceError>

  allPaymentVolumeSince: GetVolumeSinceFn

  externalPaymentVolumeSince: GetVolumeSinceFn

  intraledgerTxBaseVolumeSince: GetVolumeSinceFn

  allTxBaseVolumeSince: GetVolumeSinceFn

  lightningTxBaseVolumeSince: GetVolumeSinceFn

  onChainTxBaseVolumeSince: GetVolumeSinceFn

  allPaymentVolumeAmountSince: GetVolumeAmountSinceFn<WalletCurrency>

  externalPaymentVolumeAmountSince: GetVolumeAmountSinceFn<WalletCurrency>

  intraledgerTxBaseVolumeAmountSince: GetVolumeAmountSinceFn<WalletCurrency>

  isOnChainTxRecorded({
    walletId,
    txHash,
  }: {
    walletId: WalletId
    txHash: OnChainTxHash
  }): Promise<boolean | LedgerServiceError>

  isToHotWalletTxRecorded(txHash: OnChainTxHash): Promise<boolean | LedgerServiceError>

  isLnTxRecorded(paymentHash: PaymentHash): Promise<boolean | LedgerServiceError>

  addOnChainTxReceive(
    args: ReceiveOnChainTxArgs,
  ): Promise<LedgerJournal | LedgerServiceError>

  addLnTxReceive(args: AddLnTxReceiveArgs): Promise<LedgerJournal | LedgerServiceError>

  addLnFeeReimbursementReceive<S extends WalletCurrency, R extends WalletCurrency>(
    args: AddLnFeeReeimbursementReceiveArgs<S, R>,
  ): Promise<LedgerJournal | LedgerServiceError>

  addLnIntraledgerTxTransfer(
    args: AddLnIntraledgerTxTransferArgs,
  ): Promise<LedgerJournal | LedgerServiceError>

  addOnChainTxSend(
    args: AddOnChainTxSendArgs,
  ): Promise<LedgerJournal | LedgerServiceError>

  addOnChainIntraledgerTxTransfer(
    args: AddOnChainIntraledgerTxTransferArgs,
  ): Promise<LedgerJournal | LedgerServiceError>

  addWalletIdIntraledgerTxTransfer(
    args: AddIntraLedgerTxSendArgs,
  ): Promise<LedgerJournal | LedgerServiceError>

  settlePendingLnPayment(paymentHash: PaymentHash): Promise<true | LedgerServiceError>

  settlePendingOnChainPayment(hash: OnChainTxHash): Promise<true | LedgerServiceError>

  revertLightningPayment(
    args: RevertLightningPaymentArgs,
  ): Promise<void | LedgerServiceError>

  getWalletIdByTransactionHash(
    hash: OnChainTxHash,
  ): Promise<WalletId | LedgerServiceError>

  listWalletIdsWithPendingPayments: () => AsyncGenerator<WalletId> | LedgerServiceError

  addColdStorageTxReceive(
    args: AddColdStorageTxReceiveArgs,
  ): Promise<LedgerJournal | LedgerServiceError>

  addColdStorageTxSend(
    args: AddColdStorageTxSendArgs,
  ): Promise<LedgerJournal | LedgerServiceError>
}

type ActivityCheckerConfig = {
  monthlyVolumeThreshold: UsdCents
  dCConverter: DisplayCurrencyConverter
  getVolumeFn: (args: IGetVolumeArgs) => VolumeResult
}

type ActivityChecker = {
  aboveThreshold: (wallets: Wallet[]) => Promise<boolean | LedgerServiceError>
}

type ImbalanceCalculatorConfig = {
  volumeLightningFn: GetVolumeSinceFn
  volumeOnChainFn: GetVolumeSinceFn
  sinceDaysAgo: Days
  method: WithdrawalFeePriceMethod
}

type ImbalanceCalculator = {
  getSwapOutImbalance: <T extends WalletCurrency>(
    wallet: WalletDescriptor<T>,
  ) => Promise<SwapOutImbalance | LedgerServiceError>
  getSwapOutImbalanceAmount: <T extends WalletCurrency>(
    wallet: WalletDescriptor<T>,
  ) => Promise<PaymentAmount<T> | LedgerServiceError | ValidationError>
}
