type PaymentInitiationMethod =
  (typeof import("./tx-methods").PaymentInitiationMethod)[keyof typeof import("./tx-methods").PaymentInitiationMethod]
type SettlementMethod =
  (typeof import("./tx-methods").SettlementMethod)[keyof typeof import("./tx-methods").SettlementMethod]
type TxStatus =
  (typeof import("./tx-status").TxStatus)[keyof typeof import("./tx-status").TxStatus]
type WalletType =
  (typeof import("./primitives").WalletType)[keyof typeof import("./primitives").WalletType]

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
  readonly revealedPreImage: RevealedPreImage | undefined // is sometimes added by dataloader in resolver
}

type SettlementViaOnChainIncoming = {
  readonly type: "onchain"
  transactionHash: OnChainTxHash
  vout?: OnChainTxVout
}

type SettlementViaOnChainOutgoing = {
  readonly type: "onchain"
  transactionHash?: OnChainTxHash
  vout?: OnChainTxVout
}

type SettlementViaOnChain = SettlementViaOnChainIncoming | SettlementViaOnChainOutgoing

type PartialBaseWalletTransaction = {
  readonly walletId: WalletId | undefined
  readonly settlementAmount: PaymentAmount<WalletCurrency>
  readonly settlementFee: PaymentAmount<WalletCurrency>
  readonly settlementCurrency: WalletCurrency
  readonly settlementDisplayAmount: DisplayAmount<DisplayCurrency>
  readonly settlementDisplayFee: DisplayAmount<DisplayCurrency>
  readonly settlementDisplayPrice: WalletMinorUnitDisplayPrice<
    WalletCurrency,
    DisplayCurrency
  >
  readonly createdAt: Date
}

type BaseWalletTransaction = {
  readonly walletId: WalletId | undefined
  readonly externalId: LedgerExternalId | undefined
  readonly settlementAmount: Satoshis | UsdCents
  readonly settlementFee: Satoshis | UsdCents
  readonly settlementCurrency: WalletCurrency
  readonly settlementDisplayAmount: DisplayCurrencyMajorAmount
  readonly settlementDisplayFee: DisplayCurrencyMajorAmount
  readonly settlementDisplayPrice: WalletMinorUnitDisplayPrice<
    WalletCurrency,
    DisplayCurrency
  >
  readonly createdAt: Date

  readonly id: LedgerTransactionId
  readonly status: TxStatus
  readonly memo: string | null
}

type IntraLedgerTransaction = BaseWalletTransaction & {
  readonly initiationVia: InitiationViaIntraledger
  readonly settlementVia: SettlementViaIntraledger
}

type WalletOnChainIntraledgerTransaction = BaseWalletTransaction & {
  readonly initiationVia: InitiationViaOnChain
  readonly settlementVia: SettlementViaIntraledger
}

type WalletOnChainPendingTransaction = PartialBaseWalletTransaction & {
  readonly initiationVia: InitiationViaOnChain
  readonly settlementVia: SettlementViaOnChainIncoming
}

type WalletOnChainSettledTransaction = BaseWalletTransaction & {
  readonly initiationVia: InitiationViaOnChain
  readonly settlementVia: SettlementViaOnChainIncoming
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

type WalletOnChainTransaction =
  | WalletOnChainIntraledgerTransaction
  | WalletOnChainSettledTransaction
  | WalletLegacyOnChainIntraledgerTransaction
  | WalletLegacyOnChainSettledTransaction

type WalletLnTransaction = WalletLnIntraledgerTransaction | WalletLnSettledTransaction

type WalletTransaction =
  | IntraLedgerTransaction
  | WalletOnChainTransaction
  | WalletLnTransaction

type MemoSharingConfig = {
  memoSharingCentsThreshold: UsdCents
  memoSharingSatsThreshold: Satoshis
  authorizedMemos: string[]
}

type ConfirmedTransactionHistory = {
  readonly transactions: WalletTransaction[]
}

type WalletTransactionHistoryWithPending = {
  readonly transactions: WalletTransaction[]
}

type NewWalletInfo = {
  readonly accountId: AccountId
  readonly type: WalletType
  readonly currency: WalletCurrency
  readonly createdAt: Date
}

type Wallet = NewWalletInfo & {
  readonly id: WalletId
  readonly onChainAddressIdentifiers: OnChainAddressIdentifier[]
  onChainAddresses(): OnChainAddress[]
}

type AccountWalletDescriptors = {
  BTC: WalletDescriptor<"BTC">
  USD: WalletDescriptor<"USD">
}

interface IWalletsRepository {
  persistNew({
    accountId,
    type,
    currency,
  }: NewWalletInfo): Promise<Wallet | RepositoryError>
  findById(walletId: WalletId): Promise<Wallet | RepositoryError>
  findForAccountById(args: {
    accountId: AccountId
    walletId: WalletId
  }): Promise<Wallet | RepositoryError>
  listByAccountId(accountId: AccountId): Promise<Wallet[] | RepositoryError>
  findAccountWalletsByAccountId(
    accountId: AccountId,
  ): Promise<AccountWalletDescriptors | RepositoryError>
  findByAddress(address: OnChainAddress): Promise<Wallet | RepositoryError>
  listByAddresses(addresses: OnChainAddress[]): Promise<Wallet[] | RepositoryError>
}

type OnChainDepositFeeArgs = {
  amount: BtcPaymentAmount
  minBankFee: BtcPaymentAmount
  minBankFeeThreshold: BtcPaymentAmount
  ratio: DepositFeeRatioAsBasisPoints
}

type DepositFeeCalculator = {
  onChainDepositFee(args: OnChainDepositFeeArgs): BtcPaymentAmount | ValidationError
  lnDepositFee(): BtcPaymentAmount
}

type OnchainWithdrawalConfig = {
  thresholdImbalance: BtcPaymentAmount
  feeRatioAsBasisPoints: bigint
}

type OnChainWithdrawalFeeArgs = {
  minerFee: BtcPaymentAmount
  minBankFee: BtcPaymentAmount
  imbalance: BtcPaymentAmount
  amount: BtcPaymentAmount
}

type WithdrawalFeePriceMethod =
  (typeof import("./index").WithdrawalFeePriceMethod)[keyof typeof import("./index").WithdrawalFeePriceMethod]

type OnChainFeeCalculator = {
  withdrawalFee(args: OnChainWithdrawalFeeArgs): {
    totalFee: BtcPaymentAmount
    bankFee: BtcPaymentAmount
  }
  intraLedgerFees(): PaymentAmountInAllCurrencies
}

type PaymentInputValidatorConfig = (
  walletId: WalletId,
) => Promise<Wallet | RepositoryError>

type ValidatePaymentInputArgs<T extends undefined | string> = {
  amount: number
  amountCurrency: WalletCurrency | undefined
  senderWalletId: string
  senderAccount: Account
  recipientWalletId?: T
}
type ValidatePaymentInputRetBase = {
  amount: PaymentAmount<WalletCurrency>
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
