type PaymentInitiationMethod =
  typeof import("./tx-methods").PaymentInitiationMethod[keyof typeof import("./tx-methods").PaymentInitiationMethod]
type SettlementMethod =
  typeof import("./tx-methods").SettlementMethod[keyof typeof import("./tx-methods").SettlementMethod]
type TxStatus =
  typeof import("./tx-status").TxStatus[keyof typeof import("./tx-status").TxStatus]
type WalletType =
  typeof import("./primitives").WalletType[keyof typeof import("./primitives").WalletType]

type InitiationViaIntraledger = {
  readonly type: "intraledger"
  readonly counterPartyWalletId: WalletId
  readonly counterPartyUsername: Username
}

type InitiationViaLn = {
  readonly type: "lightning"
  readonly paymentHash: PaymentHash
  readonly pubkey: Pubkey
}

type InitiationViaOnChain = {
  readonly type: "onchain"
  readonly address: OnChainAddress
}

// FIXME: create a migration to add OnChainAddress associated with old transaction to remove this legacy type
type InitiationViaOnChainLegacy = {
  readonly type: "onchain"
  readonly address?: OnChainAddress
}

type SettlementViaIntraledger = {
  readonly type: "intraledger"
  readonly counterPartyWalletId: WalletId
  readonly counterPartyUsername: Username | null
}

type SettlementViaLn = {
  readonly type: "lightning"
  readonly revealedPreImage: undefined
}

type SettlementViaLnWithMetadata = {
  readonly type: "lightning"
  revealedPreImage: RevealedPreImage | undefined
}

type SettlementViaOnChain = {
  readonly type: "onchain"
  transactionHash: OnChainTxHash
}

type BaseWalletTransaction = {
  readonly id: LedgerTransactionId | OnChainTxHash
  readonly walletId: WalletId | undefined
  readonly settlementAmount: Satoshis | UsdCents
  readonly settlementFee: Satoshis | UsdCents
  readonly settlementCurrency: WalletCurrency
  readonly displayCurrencyPerSettlementCurrencyUnit: number
  readonly status: TxStatus
  readonly memo: string | null
  readonly createdAt: Date
}

type IntraLedgerTransaction = BaseWalletTransaction & {
  readonly initiationVia: InitiationViaIntraledger
  readonly settlementVia: SettlementViaIntraledger
}

type WalletOnChainIntraledgerTransaction = BaseWalletTransaction & {
  readonly initiationVia: InitiationViaOnChain
  readonly settlementVia: SettlementViaIntraledger
}

type WalletOnChainSettledTransaction = BaseWalletTransaction & {
  readonly initiationVia: InitiationViaOnChain
  readonly settlementVia: SettlementViaOnChain
}

type WalletLegacyOnChainIntraledgerTransaction = BaseWalletTransaction & {
  readonly initiationVia: InitiationViaOnChainLegacy
  readonly settlementVia: SettlementViaIntraledger
}

type WalletLegacyOnChainSettledTransaction = BaseWalletTransaction & {
  readonly initiationVia: InitiationViaOnChainLegacy
  readonly settlementVia: SettlementViaOnChain
}

type WalletLnIntraledgerTransaction = BaseWalletTransaction & {
  readonly initiationVia: InitiationViaLn
  readonly settlementVia: SettlementViaIntraledger
}

type WalletLnSettledTransaction = BaseWalletTransaction & {
  readonly initiationVia: InitiationViaLn
  readonly settlementVia: SettlementViaLn
}

type WalletLnSettledTransactionWithMetadata = BaseWalletTransaction & {
  readonly initiationVia: InitiationViaLn
  readonly settlementVia: SettlementViaLnWithMetadata
}

type IntraLedgerTransactionWithMetadata = { hasMetadata: true } & IntraLedgerTransaction

type WalletOnChainTransaction =
  | WalletOnChainIntraledgerTransaction
  | WalletOnChainSettledTransaction
  | WalletLegacyOnChainIntraledgerTransaction
  | WalletLegacyOnChainSettledTransaction

type WalletOnChainTransactionWithMetadata = { hasMetadata: true } & (
  | WalletOnChainIntraledgerTransaction
  | WalletOnChainSettledTransaction
  | WalletLegacyOnChainIntraledgerTransaction
  | WalletLegacyOnChainSettledTransaction
)

type WalletLnTransaction = WalletLnIntraledgerTransaction | WalletLnSettledTransaction

type WalletLnTransactionWithMetadata = { hasMetadata: true } & (
  | WalletLnIntraledgerTransaction
  | WalletLnSettledTransactionWithMetadata
)

type WalletTransaction =
  | IntraLedgerTransaction
  | WalletOnChainTransaction
  | WalletLnTransaction

type WalletTransactionWithMetadata =
  | IntraLedgerTransactionWithMetadata
  | WalletOnChainTransactionWithMetadata
  | WalletLnTransactionWithMetadata

type AddPendingIncomingArgs = {
  pendingIncoming: IncomingOnChainTransaction[]
  addressesByWalletId: { [key: WalletId]: OnChainAddress[] }
  walletDetailsByWalletId: { [key: WalletId]: { currency: WalletCurrency } }
  displayCurrencyPerSat: DisplayCurrencyPerSat
}

type ConfirmedTransactionHistory = {
  readonly transactions: WalletTransaction[]
  addPendingIncoming(args: AddPendingIncomingArgs): WalletTransactionHistoryWithPending
}

type ConfirmedTransactionHistoryWithMetadata = {
  readonly transactions: WalletTransactionWithMetadata[]
  addPendingIncoming(
    args: AddPendingIncomingArgs,
  ): WalletTransactionHistoryWithPendingWithMetadata
}

type WalletTransactionHistoryWithPending = {
  readonly transactions: WalletTransaction[]
}

type WalletTransactionHistoryWithPendingWithMetadata = {
  readonly transactions: WalletTransactionWithMetadata[]
}

type NewWalletInfo = {
  readonly accountId: AccountId
  readonly type: WalletType
  readonly currency: WalletCurrency
}

type Wallet = NewWalletInfo & {
  readonly id: WalletId
  readonly onChainAddressIdentifiers: OnChainAddressIdentifier[]
  onChainAddresses(): OnChainAddress[]
}

interface IWalletsRepository {
  persistNew({
    accountId,
    type,
    currency,
  }: NewWalletInfo): Promise<Wallet | RepositoryError>
  findById(walletId: WalletId): Promise<Wallet | RepositoryError>

  listByAccountId(accountId: AccountId): Promise<Wallet[] | RepositoryError>

  findByAddress(address: OnChainAddress): Promise<Wallet | RepositoryError>
  listByAddresses(addresses: OnChainAddress[]): Promise<Wallet[] | RepositoryError>
  listByWalletCurrency(
    walletCurrency: WalletCurrency,
  ): Promise<Wallet[] | RepositoryError>
}

type onChainDepositFeeArgs = {
  amount: Satoshis
  ratio: DepositFeeRatio
}

type DepositFeeCalculator = {
  onChainDepositFee({ amount, ratio }: onChainDepositFeeArgs): Satoshis
  lnDepositFee(): Satoshis
}

type OnchainWithdrawalConfig = {
  thresholdImbalance: Satoshis
  feeRatio: number
}

type NewOnchainWithdrawalConfig = {
  thresholdImbalance: BtcPaymentAmount
  feeRatioAsBasisPoints: bigint
}

type OnChainWithdrawalFeeArgs = {
  minerFee: Satoshis
  minBankFee: Satoshis
  imbalance: SwapOutImbalance
  amount: Satoshis
}

type NewOnChainWithdrawalFeeArgs = {
  minerFee: BtcPaymentAmount
  minBankFee: BtcPaymentAmount
  imbalance: BtcPaymentAmount
  amount: BtcPaymentAmount
}

type WithdrawalFeePriceMethod =
  typeof import("./index").WithdrawalFeePriceMethod[keyof typeof import("./index").WithdrawalFeePriceMethod]

type WithdrawalFeeCalculatorRes = {
  totalFee: Satoshis
  bankFee: Satoshis
}

type WithdrawalFeeCalculator = {
  onChainWithdrawalFee(args: OnChainWithdrawalFeeArgs): WithdrawalFeeCalculatorRes
  onChainIntraLedgerFee(): Satoshis
}

type OnChainFeeCalculator = {
  withdrawalFee(args: NewOnChainWithdrawalFeeArgs): {
    totalFee: BtcPaymentAmount
    bankFee: BtcPaymentAmount
  }
  intraLedgerFees(): { btc: BtcPaymentAmount; usd: UsdPaymentAmount }
}

type PaymentInputValidatorConfig = (
  walletId: WalletId,
) => Promise<Wallet | RepositoryError>

type ValidatePaymentInputArgs<T extends undefined | string> = {
  amount: number
  senderWalletId: string
  senderAccount: Account
  recipientWalletId?: T
}
type ValidatePaymentInputRetBase = {
  amount: CurrencyBaseAmount
  senderWallet: Wallet
}
type ValidatePaymentInputRet<T extends undefined | string> = T extends undefined
  ? ValidatePaymentInputRetBase
  : ValidatePaymentInputRetBase & { recipientWallet: Wallet }

type PaymentInputValidator = {
  validatePaymentInput: <T extends undefined | string>(
    args: ValidatePaymentInputArgs<T>,
  ) => Promise<ValidatePaymentInputRet<T> | ValidationError | RepositoryError>
}
