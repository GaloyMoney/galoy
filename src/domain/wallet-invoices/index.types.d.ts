type BtcFromUsdFn = (
  amount: UsdPaymentAmount,
) => Promise<BtcPaymentAmount | DealerPriceServiceError>

type WalletInvoiceBuilderConfig = {
  dealerBtcFromUsd: BtcFromUsdFn
  lnRegisterInvoice: (
    args: NewRegisterInvoiceArgs,
  ) => Promise<RegisteredInvoice | LightningServiceError>
}

type WalletInvoiceBuilder = {
  withDescription: ({
    description,
    descriptionHash,
  }: {
    description: string
    descriptionHash?: string
  }) => WIBWithDescription
}

type WIBWithDescriptionState = WalletInvoiceBuilderConfig & {
  description: string
  descriptionHash?: string
}

type WIBWithDescription = {
  generatedForSelf: () => WIBWithOrigin
  generatedForRecipient: () => WIBWithOrigin
}

type WIBWithOriginState = WIBWithDescriptionState & {
  selfGenerated: boolean
}

type WIBWithOrigin = {
  withRecipientWallet: (
    recipientWallet: WalletDescriptor<WalletCurrency>,
  ) => WIBWithRecipient
}

type WIBWithRecipientState = WIBWithOriginState & {
  recipientWalletDescriptor: WalletDescriptor<WalletCurrency>
}

type WIBWithRecipient = {
  withAmount: (
    uncheckedAmount: number,
  ) => Promise<WIBWithAmount | ValidationError | DealerPriceServiceError>
  withoutAmount: () => Promise<WIBWithAmount>
}

type WIBWithAmountState = WIBWithRecipientState & {
  hasAmount: boolean
  invoiceExpiration: InvoiceExpiration
  btcAmount: BtcPaymentAmount
  usdAmount?: UsdPaymentAmount
}

type LnAndWalletInvoice = {
  walletInvoice: WalletInvoice
  lnInvoice: LnInvoice
}

type WIBWithAmount = {
  registerInvoice: () => Promise<LnAndWalletInvoice | LightningServiceError>
}

type WalletInvoice = {
  paymentHash: PaymentHash
  secret: SecretPreImage
  selfGenerated: boolean
  pubkey: Pubkey
  usdAmount?: UsdPaymentAmount
  recipientWalletDescriptor: WalletDescriptor<WalletCurrency>
  paid: boolean
}

type WalletInvoiceReceiver = WalletInvoice & {
  usdToCreditReceiver: UsdPaymentAmount
  btcToCreditReceiver: BtcPaymentAmount
  usdBankFee: UsdPaymentAmount
  btcBankFee: BtcPaymentAmount
  recipientWalletDescriptor: WalletDescriptor<WalletCurrency>
  receivedAmount: () => BtcPaymentAmount | UsdPaymentAmount
}

type WalletInvoiceReceiverArgs = {
  walletInvoice: WalletInvoice
  receivedBtc: BtcPaymentAmount
  usdFromBtc(
    amount: BtcPaymentAmount,
  ): Promise<UsdPaymentAmount | DealerPriceServiceError>
  usdFromBtcMidPrice(
    amount: BtcPaymentAmount,
  ): Promise<UsdPaymentAmount | DealerPriceServiceError>
}

type WalletInvoiceValidator = {
  validateToSend(fromWalletId: WalletId): true | ValidationError
}

interface IWalletInvoicesRepository {
  persistNew: (invoice: WalletInvoice) => Promise<WalletInvoice | RepositoryError>

  markAsPaid: (paymentHash: PaymentHash) => Promise<WalletInvoice | RepositoryError>

  findByPaymentHash: (
    paymentHash: PaymentHash,
  ) => Promise<WalletInvoice | RepositoryError>

  yieldPending: () => AsyncGenerator<WalletInvoice> | RepositoryError

  deleteByPaymentHash: (paymentHash: PaymentHash) => Promise<boolean | RepositoryError>

  deleteUnpaidOlderThan: (before: Date) => Promise<number | RepositoryError>
}
