type LightningError = import("./errors").LightningError
type LnInvoiceDecodeError = import("./errors").LnInvoiceDecodeError
type LightningServiceError = import("./errors").LightningServiceError
type RouteNotFoundError = import("./errors").RouteNotFoundError

type InvoiceExpiration = Date & { readonly brand: unique symbol }
type EncodedPaymentRequest = string & { readonly brand: unique symbol }
type PaymentHash = string & { readonly brand: unique symbol }
type IntraLedgerHash = string & { readonly brand: unique symbol }
type SecretPreImage = string & { readonly brand: unique symbol }
type RevealedPreImage = string & { readonly brand: unique symbol }
type PaymentIdentifyingSecret = string & { readonly brand: unique symbol }
type FeatureBit = number & { readonly brand: unique symbol }
type FeatureType = string & { readonly brand: unique symbol }
type ChanId = string & { readonly brand: unique symbol }

type PagingStartToken = undefined
type PagingContinueToken = string & { readonly brand: unique symbol }
type PagingStopToken = false

type RouteValidator = {
  validate(btcPaymentAmount: BtcPaymentAmount): true | ValidationError
}

type PaymentStatus =
  (typeof import("./index").PaymentStatus)[keyof typeof import("./index").PaymentStatus]

type FailedPaymentStatus = typeof import("./index").PaymentStatus.Failed

type PaymentSendStatus =
  (typeof import("./index").PaymentSendStatus)[keyof typeof import("./index").PaymentSendStatus]

type Hop = {
  baseFeeMTokens?: string
  channel?: ChanId
  cltvDelta?: number
  feeRate?: number
  nodePubkey: Pubkey
}

type LnInvoiceFeature = {
  // BOLT 09 Feature Bit Number
  bit: FeatureBit
  // Feature Support is Required To Pay Bool
  isRequired: boolean
  // Feature Type String
  type: FeatureType
}

type LnInvoiceLookup = {
  readonly paymentHash: PaymentHash
  readonly createdAt: Date
  readonly confirmedAt: Date | undefined
  readonly isSettled: boolean
  readonly isHeld: boolean
  readonly isCanceled?: boolean
  readonly heldAt: Date | undefined
  readonly roundedDownReceived: Satoshis
  readonly milliSatsReceived: MilliSatoshis
  readonly secretPreImage: SecretPreImage
  readonly lnInvoice: {
    readonly description: string
    readonly paymentRequest: EncodedPaymentRequest | undefined
    readonly expiresAt: Date
    readonly roundedDownAmount: Satoshis
  }
}

type GetPaymentsResults = import("lightning").GetPaymentsResult
type GetFailedPaymentsResults = import("lightning").GetFailedPaymentsResult
type LnPaymentAttempt =
  | GetPaymentsResults["payments"][number]["attempts"][number]
  | GetFailedPaymentsResults["payments"][number]["attempts"][number]

type LnPaymentConfirmedDetails = {
  readonly confirmedAt: Date
  readonly destination: Pubkey
  readonly revealedPreImage: RevealedPreImage
  readonly roundedUpFee: Satoshis
  readonly milliSatsFee: MilliSatoshis
  readonly hopPubkeys: Pubkey[] | undefined
}

type LnPaymentLookup = {
  readonly createdAt: Date
  readonly status: PaymentStatus
  readonly paymentHash: PaymentHash
  readonly paymentRequest: EncodedPaymentRequest | undefined
  readonly milliSatsAmount: MilliSatoshis
  readonly roundedUpAmount: Satoshis

  readonly confirmedDetails: LnPaymentConfirmedDetails | undefined
  readonly attempts: LnPaymentAttempt[] | undefined
}

type LnFailedPartialPaymentLookup = {
  readonly status: FailedPaymentStatus
}

type LnInvoice = {
  readonly destination: Pubkey
  readonly paymentHash: PaymentHash
  readonly paymentRequest: EncodedPaymentRequest
  readonly milliSatsAmount: MilliSatoshis
  readonly description: string
  readonly cltvDelta: number | null
  readonly amount: Satoshis | null
  readonly paymentAmount: BtcPaymentAmount | null
  readonly routeHints: Hop[][]
  readonly paymentSecret: PaymentIdentifyingSecret | null
  readonly features: LnInvoiceFeature[]
  readonly expiresAt: Date
  readonly isExpired: boolean
  readonly createdAt: Date
}

type LndAndPubkey = { lnd: AuthenticatedLnd; pubkey: Pubkey }

type RegisterInvoiceArgs = {
  paymentHash: PaymentHash
  description: string
  descriptionHash?: string
  btcPaymentAmount: BtcPaymentAmount
  expiresAt: InvoiceExpiration
}

type RegisteredInvoice = {
  invoice: LnInvoice
  pubkey: Pubkey
  descriptionHash?: string // TODO: proper type
}

type PayInvoiceResult = {
  roundedUpFee: Satoshis
  revealedPreImage: RevealedPreImage
  sentFromPubkey: Pubkey
}

type ListLnPaymentsArgs = {
  after: PagingStartToken | PagingContinueToken
  pubkey: Pubkey
}

type ListLnPaymentsResult = {
  lnPayments: LnPaymentLookup[]
  endCursor: PagingContinueToken | PagingStopToken
}

type ListLnPayments = (
  args: ListLnPaymentsArgs,
) => Promise<ListLnPaymentsResult | LightningError>

type LightningServiceConfig = {
  feeCapPercent: number
}

type ListLnInvoicesArgs = {
  pubkey?: Pubkey
  createdAfter?: Date
}

interface ILightningService {
  isLocal(pubkey: Pubkey): boolean

  defaultPubkey(): Pubkey

  listActivePubkeys(): Pubkey[]

  listAllPubkeys(): Pubkey[]

  getBalance(pubkey?: Pubkey): Promise<Satoshis | LightningServiceError>

  getOnChainBalance(pubkey?: Pubkey): Promise<Satoshis | LightningServiceError>
  getPendingOnChainBalance(pubkey?: Pubkey): Promise<Satoshis | LightningServiceError>
  listIncomingOnChainTransactions({
    decoder,
    scanDepth,
  }: {
    decoder: TxDecoder
    scanDepth: ScanDepth
  }): Promise<IncomingOnChainTransaction[] | LightningServiceError>

  getInboundOutboundBalance(
    pubkey?: Pubkey,
  ): Promise<{ inbound: Satoshis; outbound: Satoshis } | LightningServiceError>
  getOpeningChannelsBalance(pubkey?: Pubkey): Promise<Satoshis | LightningServiceError>
  getClosingChannelsBalance(pubkey?: Pubkey): Promise<Satoshis | LightningServiceError>

  getTotalPendingHtlcCount(pubkey?: Pubkey): Promise<number | LightningServiceError>
  getIncomingPendingHtlcCount(pubkey?: Pubkey): Promise<number | LightningServiceError>
  getOutgoingPendingHtlcCount(pubkey?: Pubkey): Promise<number | LightningServiceError>

  getActiveChannels(pubkey?: Pubkey): Promise<number | LightningServiceError>
  getOfflineChannels(pubkey?: Pubkey): Promise<number | LightningServiceError>
  getPublicChannels(pubkey?: Pubkey): Promise<number | LightningServiceError>
  getPrivateChannels(pubkey?: Pubkey): Promise<number | LightningServiceError>

  findRouteForInvoice({
    invoice,
    amount,
  }: {
    invoice: LnInvoice
    amount?: BtcPaymentAmount
  }): Promise<{ pubkey: Pubkey; rawRoute: RawRoute } | LightningServiceError>

  findRouteForNoAmountInvoice({
    decodedInvoice,
    maxFee,
    amount,
  }: {
    decodedInvoice: LnInvoice
    maxFee: Satoshis
    amount: Satoshis
  }): Promise<RawRoute | LightningServiceError>

  registerInvoice(
    args: RegisterInvoiceArgs,
  ): Promise<RegisteredInvoice | LightningServiceError>

  lookupInvoice({
    pubkey,
    paymentHash,
  }: {
    pubkey?: Pubkey
    paymentHash: PaymentHash
  }): Promise<LnInvoiceLookup | LightningServiceError>

  lookupPayment({
    pubkey,
    paymentHash,
  }: {
    pubkey?: Pubkey
    paymentHash: PaymentHash
  }): Promise<LnPaymentLookup | LnFailedPartialPaymentLookup | LightningServiceError>

  listSettledPayments: ListLnPayments

  listPendingPayments(
    args: ListLnPaymentsArgs,
  ): Promise<ListLnPaymentsResult | LightningServiceError>

  listFailedPayments: ListLnPayments

  listInvoices(
    args: ListLnInvoicesArgs,
  ): AsyncGenerator<LnInvoiceLookup> | LightningServiceError

  deletePaymentByHash({
    paymentHash,
    pubkey,
  }: {
    paymentHash: PaymentHash
    pubkey?: Pubkey
  }): Promise<true | LightningServiceError>

  settleInvoice({
    pubkey,
    secret,
  }: {
    pubkey: Pubkey
    secret: SecretPreImage
  }): Promise<true | LightningServiceError>

  cancelInvoice({
    pubkey,
    paymentHash,
  }: {
    pubkey: Pubkey
    paymentHash: PaymentHash
  }): Promise<true | LightningServiceError>

  payInvoiceViaRoutes({
    paymentHash,
    rawRoute,
    pubkey,
  }: {
    paymentHash: PaymentHash
    rawRoute: RawRoute | undefined
    pubkey: Pubkey | undefined
  }): Promise<PayInvoiceResult | LightningServiceError>

  payInvoiceViaPaymentDetails({
    decodedInvoice,
    btcPaymentAmount,
    maxFeeAmount,
  }: {
    decodedInvoice: LnInvoice
    btcPaymentAmount: BtcPaymentAmount
    maxFeeAmount: BtcPaymentAmount | undefined
  }): Promise<PayInvoiceResult | LightningServiceError>
}

// from Alex Bosworth invoice library
type RoutesBolt11Library = {
  base_fee_mtokens: string
  channel: string
  cltv_delta: number
  public_key: string
  fee_rate: number
}[][]
