import {
  GetChainTransactionsResult,
  GetInvoiceResult,
  GetInvoicesResult,
  GetPaymentResult,
  PayViaPaymentDetailsArgs,
  PayViaPaymentDetailsResult,
  PayViaRoutesResult,
  cancelHodlInvoice,
  createHodlInvoice,
  deletePayment,
  getChainBalance,
  getChainTransactions,
  getChannelBalance,
  getChannels,
  getClosedChannels,
  getFailedPayments,
  getInvoice,
  getInvoices,
  getPayment,
  getPayments,
  getPendingChainBalance,
  getPendingChannels,
  getPendingPayments,
  getWalletInfo,
  LightningError as LnError,
  payViaPaymentDetails,
  payViaRoutes,
  settleHodlInvoice,
} from "lightning"
import lnService from "ln-service"
import sumBy from "lodash.sumby"

import {
  getActiveLnd,
  getActiveOnchainLnd,
  getLndFromPubkey,
  getLnds,
  parseLndErrorDetails,
} from "./config"

import { checkAllLndHealth } from "./health"

import { KnownLndErrorDetails } from "./errors"

import { NETWORK, SECS_PER_5_MINS } from "@/config"

import {
  BadPaymentDataError,
  CorruptLndDbError,
  CouldNotDecodeReturnedPaymentRequest,
  DestinationMissingDependentFeatureError,
  InsufficientBalanceForLnPaymentError,
  InsufficientBalanceForRoutingError,
  InvalidFeatureBitsForLndInvoiceError,
  InvoiceExpiredOrBadPaymentHashError,
  InvoiceNotFoundError,
  LightningServiceError,
  LookupPaymentTimedOutError,
  OffChainServiceBusyError,
  OffChainServiceUnavailableError,
  PaymentAttemptsTimedOutError,
  PaymentInTransitionError,
  PaymentNotFoundError,
  PaymentStatus,
  ProbeForRouteTimedOutError,
  ProbeForRouteTimedOutFromApplicationError,
  RouteNotFoundError,
  SecretDoesNotMatchAnyExistingHodlInvoiceError,
  TemporaryChannelFailureError,
  TemporaryNodeFailureError,
  PaymentRejectedByDestinationError,
  UnknownLightningServiceError,
  UnknownNextPeerError,
  UnknownRouteNotFoundError,
  decodeInvoice,
  InvalidInvoiceAmountError,
  InvoiceAlreadySettledError,
  LnPaymentAttemptResult,
  LnPaymentAttemptResultType,
} from "@/domain/bitcoin/lightning"
import { CacheKeys } from "@/domain/cache"
import { LnFees } from "@/domain/payments"
import { toMilliSatsFromString, toSats } from "@/domain/bitcoin"
import { IncomingOnChainTransaction } from "@/domain/bitcoin/onchain"
import { WalletCurrency, paymentAmountFromNumber } from "@/domain/shared"

import { LocalCacheService } from "@/services/cache"
import { wrapAsyncFunctionsToRunInSpan } from "@/services/tracing"

import { timeoutWithCancel } from "@/utils"

const TIMEOUT_PAYMENT = NETWORK !== "regtest" ? 45000 : 3000

export const LndService = (): ILightningService | LightningServiceError => {
  const activeNode = getActiveLnd()
  if (activeNode instanceof Error) return activeNode

  const defaultLnd = activeNode.lnd
  const defaultPubkey = activeNode.pubkey as Pubkey

  const defaultOnchainLnd = () => {
    const activeOnchainNode = getActiveOnchainLnd()
    if (activeOnchainNode instanceof Error) return activeOnchainNode
    return activeOnchainNode.lnd
  }

  const isLocal = (pubkey: Pubkey): boolean =>
    getLnds({ type: "offchain" }).some((item) => item.pubkey === pubkey)

  const listActivePubkeys = (): Pubkey[] =>
    getLnds({ active: true, type: "offchain" }).map((lndAuth) => lndAuth.pubkey as Pubkey)

  const listActiveLndsWithPubkeys = (): { lnd: AuthenticatedLnd; pubkey: Pubkey }[] =>
    getLnds({ active: true, type: "offchain" }).map((lndAuth) => ({
      lnd: lndAuth.lnd,
      pubkey: lndAuth.pubkey,
    }))

  const listAllPubkeys = (): Pubkey[] =>
    getLnds({ type: "offchain" }).map((lndAuth) => lndAuth.pubkey as Pubkey)

  const getBalance = async (
    pubkey?: Pubkey,
  ): Promise<Satoshis | LightningServiceError> => {
    try {
      const lnd = pubkey ? getLndFromPubkey({ pubkey }) : defaultLnd
      if (lnd instanceof Error) return lnd

      const { channel_balance } = await getChannelBalance({ lnd })
      return toSats(channel_balance)
    } catch (err) {
      return handleCommonLightningServiceErrors(err)
    }
  }

  const getOnChainBalance = async (
    pubkey?: Pubkey,
  ): Promise<Satoshis | LightningServiceError> => {
    try {
      const lndInstance = pubkey ? getLndFromPubkey({ pubkey }) : defaultOnchainLnd()
      if (lndInstance instanceof Error) return lndInstance

      const { chain_balance } = await getChainBalance({ lnd: lndInstance })
      return toSats(chain_balance)
    } catch (err) {
      return handleCommonLightningServiceErrors(err)
    }
  }

  const getPendingOnChainBalance = async (
    pubkey?: Pubkey,
  ): Promise<Satoshis | LightningServiceError> => {
    try {
      const lndInstance = pubkey ? getLndFromPubkey({ pubkey }) : defaultOnchainLnd()
      if (lndInstance instanceof Error) return lndInstance

      const { pending_chain_balance } = await getPendingChainBalance({ lnd: lndInstance })
      return toSats(pending_chain_balance)
    } catch (err) {
      return handleCommonLightningServiceErrors(err)
    }
  }

  const listIncomingOnChainTransactions = async ({
    decoder,
    scanDepth,
  }: {
    decoder: TxDecoder
    scanDepth: ScanDepth
  }): Promise<IncomingOnChainTransaction[] | LightningServiceError> => {
    try {
      let blockHeight = await LocalCacheService().get<number>({
        key: CacheKeys.BlockHeight,
      })
      if (blockHeight instanceof Error) {
        blockHeight = 0
      }
      if (!blockHeight) {
        ;({ current_block_height: blockHeight } = await getWalletInfo({
          lnd: defaultLnd,
        }))
        await LocalCacheService().set<number>({
          key: CacheKeys.BlockHeight,
          value: blockHeight,
          ttlSecs: SECS_PER_5_MINS,
        })
      }

      // this is necessary for tests, otherwise `after` may be negative
      const after = Math.max(0, blockHeight - scanDepth)

      const lnd = defaultOnchainLnd()
      if (lnd instanceof Error) return lnd

      const txs = await getChainTransactions({
        lnd,
        after,
      })

      return extractIncomingOnChainTransactions({ decoder, txs })
    } catch (err) {
      return handleCommonLightningServiceErrors(err)
    }
  }

  const getInboundOutboundBalance = async (
    pubkey?: Pubkey,
  ): Promise<{ inbound: Satoshis; outbound: Satoshis } | LightningServiceError> => {
    try {
      const lnd = pubkey ? getLndFromPubkey({ pubkey }) : defaultLnd
      if (lnd instanceof Error) return lnd
      const { channel_balance, inbound } = await getChannelBalance({ lnd })

      return {
        outbound: toSats(channel_balance),
        inbound: toSats(inbound || 0),
      }
    } catch (err) {
      const errDetails = parseLndErrorDetails(err)
      return new UnknownLightningServiceError(errDetails)
    }
  }

  const getOpeningChannelsBalance = async (
    pubkey?: Pubkey,
  ): Promise<Satoshis | LightningServiceError> => {
    try {
      const lnd = pubkey ? getLndFromPubkey({ pubkey }) : defaultLnd
      if (lnd instanceof Error) return lnd

      const { pending_balance } = await getChannelBalance({ lnd })
      return toSats(pending_balance)
    } catch (err) {
      return handleCommonLightningServiceErrors(err)
    }
  }

  const getClosingChannelsBalance = async (
    pubkey?: Pubkey,
  ): Promise<Satoshis | LightningServiceError> => {
    try {
      const lnd = pubkey ? getLndFromPubkey({ pubkey }) : defaultLnd
      if (lnd instanceof Error) return lnd

      const { pending_channels } = await getPendingChannels({ lnd })

      const closingChannelBalance = sumBy(pending_channels, (c) =>
        c.is_closing ? c.pending_balance || c.local_balance : 0,
      )

      return toSats(closingChannelBalance)
    } catch (err) {
      return handleCommonLightningServiceErrors(err)
    }
  }

  const getActiveChannels = async (
    pubkey?: Pubkey,
  ): Promise<number | LightningServiceError> => {
    try {
      const lnd = pubkey ? getLndFromPubkey({ pubkey }) : defaultLnd
      if (lnd instanceof Error) return lnd
      const { channels } = await getChannels({ lnd })
      return channels.filter((channel) => channel.is_active === true).length
    } catch (err) {
      return handleCommonLightningServiceErrors(err)
    }
  }

  const getOfflineChannels = async (
    pubkey?: Pubkey,
  ): Promise<number | LightningServiceError> => {
    try {
      const lnd = pubkey ? getLndFromPubkey({ pubkey }) : defaultLnd
      if (lnd instanceof Error) return lnd
      const { channels } = await getChannels({ lnd })
      return channels.filter((channel) => channel.is_active === false).length
    } catch (err) {
      return handleCommonLightningServiceErrors(err)
    }
  }

  const getPublicChannels = async (
    pubkey?: Pubkey,
  ): Promise<number | LightningServiceError> => {
    try {
      const lnd = pubkey ? getLndFromPubkey({ pubkey }) : defaultLnd
      if (lnd instanceof Error) return lnd
      const { channels } = await getChannels({ lnd })
      return channels.filter((channel) => channel.is_private === false).length
    } catch (err) {
      return handleCommonLightningServiceErrors(err)
    }
  }

  const getPrivateChannels = async (
    pubkey?: Pubkey,
  ): Promise<number | LightningServiceError> => {
    try {
      const lnd = pubkey ? getLndFromPubkey({ pubkey }) : defaultLnd
      if (lnd instanceof Error) return lnd
      const { channels } = await getChannels({ lnd })
      return channels.filter((channel) => channel.is_private === true).length
    } catch (err) {
      return handleCommonLightningServiceErrors(err)
    }
  }

  const getTotalPendingHtlcCount = async (
    pubkey?: Pubkey,
  ): Promise<number | LightningServiceError> => {
    try {
      const lnd = pubkey ? getLndFromPubkey({ pubkey }) : defaultLnd
      if (lnd instanceof Error) return lnd
      const { channels } = await getChannels({ lnd })

      return channels.reduce(
        (totalCount, channel) => totalCount + channel.pending_payments.length,
        0,
      )
    } catch (err) {
      return handleCommonLightningServiceErrors(err)
    }
  }

  const getIncomingPendingHtlcCount = async (
    pubkey?: Pubkey,
  ): Promise<number | LightningServiceError> => {
    try {
      const lnd = pubkey ? getLndFromPubkey({ pubkey }) : defaultLnd
      if (lnd instanceof Error) return lnd
      const { channels } = await getChannels({ lnd })

      return channels.reduce(
        (totalCount, channel) =>
          totalCount + channel.pending_payments.filter((p) => !p.is_outgoing).length,
        0,
      )
    } catch (err) {
      return handleCommonLightningServiceErrors(err)
    }
  }

  const getOutgoingPendingHtlcCount = async (
    pubkey?: Pubkey,
  ): Promise<number | LightningServiceError> => {
    try {
      const lnd = pubkey ? getLndFromPubkey({ pubkey }) : defaultLnd
      if (lnd instanceof Error) return lnd
      const { channels } = await getChannels({ lnd })

      return channels.reduce(
        (totalCount, channel) =>
          totalCount + channel.pending_payments.filter((p) => p.is_outgoing).length,
        0,
      )
    } catch (err) {
      return handleCommonLightningServiceErrors(err)
    }
  }

  const findRouteForInvoice = async ({
    invoice,
    amount,
  }: {
    invoice: LnInvoice
    // FIXME: remove this optional property, use 'findRouteForNoAmountInvoice' with no-amount invoices instead
    amount?: BtcPaymentAmount
  }): Promise<{ pubkey: Pubkey; rawRoute: RawRoute } | LightningServiceError> => {
    let sats = toSats(0)
    if (amount) {
      sats = toSats(Number(amount.amount))
    } else {
      if (!(invoice.amount && invoice.amount > 0))
        return new LightningServiceError(
          "No amount invoice passed to method. Expected a valid amount to be present.",
        )
      sats = invoice.amount
    }
    const btcAmount = paymentAmountFromNumber({
      amount: sats,
      currency: WalletCurrency.Btc,
    })
    if (btcAmount instanceof Error) return btcAmount
    const maxFeeAmount = LnFees().maxProtocolAndBankFee(btcAmount)

    const rawRoute = await probeForRoute({
      decodedInvoice: invoice,
      maxFee: toSats(maxFeeAmount.amount),
      amount: sats,
    })
    if (rawRoute instanceof Error) return rawRoute
    return {
      pubkey: defaultPubkey,
      rawRoute,
    }
  }

  const findRouteForNoAmountInvoice = async ({
    decodedInvoice,
    maxFee,
    amount,
  }: {
    decodedInvoice: LnInvoice
    maxFee: Satoshis
    amount: Satoshis
  }): Promise<RawRoute | LightningServiceError> => {
    if (!(amount && amount > 0))
      return new LightningServiceError(
        "Invalid amount passed to method for invoice with no amount. Expected a valid amount to be passed.",
      )
    return probeForRoute({
      decodedInvoice,
      maxFee,
      amount,
    })
  }

  const probeForRoute = async ({
    decodedInvoice,
    maxFee,
    amount,
  }: {
    decodedInvoice: LnInvoice
    maxFee: Satoshis
    amount: Satoshis
  }): Promise<RawRoute | LightningServiceError> => {
    let cancelTimeout = () => {
      return
    }
    try {
      const routes: ProbeForRouteRoutes = decodedInvoice.routeHints.map((route) =>
        route.map((hop) => ({
          base_fee_mtokens: hop.baseFeeMTokens,
          channel: hop.channel,
          cltv_delta: hop.cltvDelta,
          fee_rate: hop.feeRate,
          public_key: hop.nodePubkey,
        })),
      )

      let mTokens = (amount * 1000).toString()
      if (decodedInvoice.milliSatsAmount > 0) {
        mTokens = decodedInvoice.milliSatsAmount.toString()
      }

      const probeForRouteArgs: ProbeForRouteArgs = {
        lnd: defaultLnd,
        destination: decodedInvoice.destination,
        mtokens: mTokens,
        routes,
        cltv_delta: decodedInvoice.cltvDelta || undefined,
        features: decodedInvoice.features
          ? decodedInvoice.features.map((f) => ({
              bit: f.bit,
              is_required: f.isRequired,
              type: f.type,
            }))
          : undefined,
        max_fee: maxFee,
        payment: decodedInvoice.paymentSecret || undefined,
        total_mtokens: decodedInvoice.paymentSecret ? mTokens : undefined,
      }
      const routePromise = lnService.probeForRoute(probeForRouteArgs)
      const [timeoutPromise, cancelTimeoutFn] = timeoutWithCancel(
        TIMEOUT_PAYMENT,
        "Timeout",
      )
      cancelTimeout = cancelTimeoutFn

      const { route } = await Promise.race([routePromise, timeoutPromise])
      cancelTimeout()
      if (!route) return new RouteNotFoundError()
      return route
    } catch (err) {
      if (err instanceof Error && err.message === "Timeout") {
        return new ProbeForRouteTimedOutFromApplicationError()
      }
      cancelTimeout()

      const errDetails = parseLndErrorDetails(err)
      const match = (knownErrDetail: RegExp): boolean => knownErrDetail.test(errDetails)
      switch (true) {
        case match(KnownLndErrorDetails.InsufficientBalance):
          return new InsufficientBalanceForRoutingError()
        case match(KnownLndErrorDetails.ProbeForRouteTimedOut):
          return new ProbeForRouteTimedOutError()
        default:
          return handleCommonRouteNotFoundErrors(err)
      }
    }
  }

  const registerInvoiceOnSingleLnd = async ({
    lndAndPubkey,
    paymentHash,
    btcPaymentAmount,
    description,
    descriptionHash,
    expiresAt,
  }: RegisterInvoiceArgs & {
    lndAndPubkey: LndAndPubkey
  }): Promise<RegisteredInvoice | LightningServiceError> => {
    const { lnd, pubkey } = lndAndPubkey
    const input = {
      lnd,
      id: paymentHash,
      description,
      description_hash: descriptionHash,
      tokens: Number(btcPaymentAmount.amount),
      expires_at: expiresAt.toISOString(),
    }

    try {
      const result = await createHodlInvoice(input)
      const request = result.request as EncodedPaymentRequest
      const returnedInvoice = decodeInvoice(request)
      if (returnedInvoice instanceof Error) {
        return new CouldNotDecodeReturnedPaymentRequest(returnedInvoice.message)
      }
      const registerInvoice: RegisteredInvoice = {
        invoice: returnedInvoice,
        pubkey,
      }
      return registerInvoice
    } catch (err) {
      return handleReceivePaymentLndErrors(err)
    }
  }

  const registerInvoice = async ({
    paymentHash,
    btcPaymentAmount,
    description,
    descriptionHash,
    expiresAt,
  }: RegisterInvoiceArgs): Promise<RegisteredInvoice | LightningServiceError> => {
    const lndsAndPubkeys = listActiveLndsWithPubkeys()
    for (const lndAndPubkey of lndsAndPubkeys) {
      const result = await registerInvoiceOnSingleLnd({
        lndAndPubkey,
        paymentHash,
        btcPaymentAmount,
        description,
        descriptionHash,
        expiresAt,
      })
      if (isConnectionError(result)) continue
      return result
    }

    return new OffChainServiceUnavailableError("no active lightning node (for offchain)")
  }

  const lookupInvoice = async ({
    pubkey,
    paymentHash,
  }: {
    pubkey?: Pubkey
    paymentHash: PaymentHash
  }): Promise<LnInvoiceLookup | LightningServiceError> => {
    if (pubkey) return lookupInvoiceByPubkeyAndHash({ pubkey, paymentHash })

    const offchainLnds = getLnds({ type: "offchain" })
    for (const { pubkey } of offchainLnds) {
      const invoice = await lookupInvoiceByPubkeyAndHash({
        pubkey: pubkey as Pubkey,
        paymentHash,
      })
      if (invoice instanceof Error) continue
      return invoice
    }

    return new InvoiceNotFoundError(JSON.stringify({ paymentHash, pubkey }))
  }

  const lookupPayment = async ({
    pubkey,
    paymentHash,
  }: {
    pubkey?: Pubkey
    paymentHash: PaymentHash
  }): Promise<LnPaymentLookup | LnFailedPartialPaymentLookup | LightningServiceError> => {
    if (pubkey) return lookupPaymentByPubkeyAndHash({ pubkey, paymentHash })

    const offchainLnds = getLnds({ type: "offchain" })
    for (const { pubkey } of offchainLnds) {
      const payment = await lookupPaymentByPubkeyAndHash({
        pubkey: pubkey as Pubkey,
        paymentHash,
      })
      if (payment instanceof Error) continue
      return payment
    }

    return new PaymentNotFoundError(JSON.stringify({ paymentHash, pubkey }))
  }

  const listPaymentsFactory =
    (getPaymentsFn: PaymentFnFactory) =>
    async ({
      after,
      pubkey,
    }: {
      after: PagingStartToken | PagingContinueToken
      pubkey: Pubkey
    }): Promise<ListLnPaymentsResult | LightningServiceError> => {
      const lnd = getLndFromPubkey({ pubkey })
      if (lnd instanceof Error) return lnd

      const pagingArgs = after ? { token: after } : {}

      try {
        const { payments, next } = await getPaymentsFn({ lnd, ...pagingArgs })
        return {
          lnPayments: payments.map((p) =>
            translateLnPaymentLookup({ p, sentFromPubkey: pubkey }),
          ),
          endCursor: (next as PagingContinueToken) || false,
        }
      } catch (err) {
        const errDetails = parseLndErrorDetails(err)
        const match = (knownErrDetail: RegExp): boolean => knownErrDetail.test(errDetails)
        switch (true) {
          case match(KnownLndErrorDetails.LndDbCorruption):
            return new CorruptLndDbError(
              `Corrupted DB error for node with pubkey: ${pubkey}`,
            )
          default:
            return handleCommonRouteNotFoundErrors(err)
        }
      }
    }

  const listFailedPayments = async (args: ListLnPaymentsArgs) => {
    const result = await listPaymentsFactory(getFailedPayments)(args)
    if (result instanceof Error) return result

    const { lnPayments, endCursor } = result
    return {
      lnPayments: lnPayments.map((p) => ({ ...p, status: PaymentStatus.Failed })),
      endCursor,
    }
  }

  const listInvoices = async function* ({
    pubkey,
    createdAfter,
  }: ListLnInvoicesArgs): AsyncGenerator<LnInvoiceLookup> | LightningServiceError {
    try {
      const lnd = pubkey ? getLndFromPubkey({ pubkey }) : defaultLnd
      if (lnd instanceof Error) return lnd

      let paginationToken: PagingStartToken | PagingContinueToken | PagingStopToken =
        undefined
      const created_after = createdAfter?.toISOString()
      while (paginationToken !== false) {
        const pagingArgs: {
          token?: PagingStartToken | PagingContinueToken
        } = paginationToken ? { token: paginationToken } : {}
        const { invoices, next } = await getInvoices({
          lnd,
          ...pagingArgs,
          created_after,
        })

        for (const invoice of invoices) {
          yield translateLnInvoiceLookup(invoice)
        }
        paginationToken = (next as PagingContinueToken) || false
      }
    } catch (err) {
      return handleCommonLightningServiceErrors(err)
    }
  }

  const deletePaymentByHash = async ({
    paymentHash,
    pubkey,
  }: {
    paymentHash: PaymentHash
    pubkey?: Pubkey
  }): Promise<true | LightningServiceError> => {
    const offchainLnds = pubkey ? [{ pubkey }] : getLnds({ type: "offchain" })
    for (const { pubkey } of offchainLnds) {
      const payment = await deletePaymentByPubkeyAndHash({
        pubkey: pubkey as Pubkey,
        paymentHash,
      })
      if (payment instanceof Error) return payment
      if (!payment) continue
      return payment
    }

    return true
  }

  const deletePaymentByPubkeyAndHash = async ({
    paymentHash,
    pubkey,
  }: {
    paymentHash: PaymentHash
    pubkey: Pubkey
  }): Promise<boolean | LightningServiceError> => {
    const lnd = getLndFromPubkey({ pubkey })
    if (lnd instanceof Error) return lnd

    try {
      await deletePayment({ id: paymentHash, lnd })
      return true
    } catch (err) {
      const errDetails = parseLndErrorDetails(err)
      const match = (knownErrDetail: RegExp): boolean => knownErrDetail.test(errDetails)
      switch (true) {
        case match(KnownLndErrorDetails.PaymentForDeleteNotFound):
          return false
        default:
          return handleCommonRouteNotFoundErrors(err)
      }
    }
  }

  const settleInvoice = async ({
    pubkey,
    secret,
  }: {
    pubkey: Pubkey
    secret: SecretPreImage
  }): Promise<true | LightningServiceError> => {
    try {
      const lnd = getLndFromPubkey({ pubkey })
      if (lnd instanceof Error) return lnd

      // Use the secret to claim the funds
      await settleHodlInvoice({ lnd, secret })
      return true
    } catch (err) {
      return handleReceivePaymentLndErrors(err)
    }
  }

  const cancelInvoice = async ({
    pubkey,
    paymentHash,
  }: {
    pubkey: Pubkey
    paymentHash: PaymentHash
  }): Promise<true | LightningServiceError> => {
    try {
      const lnd = getLndFromPubkey({ pubkey })
      if (lnd instanceof Error) return lnd

      await cancelHodlInvoice({ lnd, id: paymentHash })
      return true
    } catch (err) {
      const error = handleReceivePaymentLndErrors(err)
      if (
        error instanceof InvoiceNotFoundError ||
        error instanceof InvoiceAlreadySettledError
      ) {
        return true
      }
      return error
    }
  }

  const payInvoiceViaRoutes = async ({
    paymentHash,
    rawRoute,
    pubkey,
  }: {
    paymentHash: PaymentHash
    rawRoute: RawRoute
    pubkey: Pubkey
  }): Promise<LnPaymentAttemptResult> => {
    let cancelTimeout = () => {
      return
    }
    try {
      const lnd = getLndFromPubkey({ pubkey })
      if (lnd instanceof Error) return LnPaymentAttemptResult.err(lnd)

      const paymentPromise = payViaRoutes({
        lnd,
        routes: [rawRoute],
        id: paymentHash,
      })
      const [timeoutPromise, cancelTimeoutFn] = timeoutWithCancel(
        TIMEOUT_PAYMENT,
        "Timeout",
      )
      cancelTimeout = cancelTimeoutFn
      const paymentResult = (await Promise.race([
        paymentPromise,
        timeoutPromise,
      ])) as PayViaRoutesResult
      cancelTimeout()

      return LnPaymentAttemptResult.ok({
        roundedUpFee: toSats(paymentResult.safe_fee),
        revealedPreImage: paymentResult.secret as RevealedPreImage,
        sentFromPubkey: pubkey,
      })
    } catch (err) {
      if (err instanceof Error && err.message === "Timeout") {
        return LnPaymentAttemptResult.pending({
          sentFromPubkey: pubkey,
        })
      }
      cancelTimeout()

      const errDetails = parseLndErrorDetails(err)
      if (KnownLndErrorDetails.InvoiceAlreadyPaid.test(errDetails)) {
        return LnPaymentAttemptResult.alreadyPaid({
          sentFromPubkey: pubkey,
        })
      }

      return LnPaymentAttemptResult.err(handleSendPaymentLndErrors({ err, paymentHash }))
    }
  }

  const payInvoiceViaPaymentDetailsWithLnd = async ({
    lnd,
    pubkey,
    decodedInvoice,
    btcPaymentAmount,
    maxFeeAmount,
  }: {
    lnd: AuthenticatedLnd
    pubkey: Pubkey
    decodedInvoice: LnInvoice
    btcPaymentAmount: BtcPaymentAmount
    maxFeeAmount: BtcPaymentAmount | undefined
  }): Promise<LnPaymentAttemptResult> => {
    const milliSatsAmount = btcPaymentAmount.amount * 1000n
    const maxFee = maxFeeAmount !== undefined ? Number(maxFeeAmount.amount) : undefined

    let routes: RawHopWithStrings[][] = []
    if (decodedInvoice.routeHints) {
      routes = decodedInvoice.routeHints.map((route) =>
        route.map((hop) => ({
          base_fee_mtokens: hop.baseFeeMTokens,
          channel: hop.channel,
          cltv_delta: hop.cltvDelta,
          fee_rate: hop.feeRate,
          public_key: hop.nodePubkey,
        })),
      )
    }

    const paymentDetailsArgs: PayViaPaymentDetailsArgs = {
      lnd,
      id: decodedInvoice.paymentHash,
      destination: decodedInvoice.destination,
      mtokens: milliSatsAmount.toString(),
      payment: decodedInvoice.paymentSecret as string,
      max_fee: maxFee,
      cltv_delta: decodedInvoice.cltvDelta || undefined,
      features: decodedInvoice.features
        ? decodedInvoice.features.map((f) => ({
            bit: f.bit,
            is_required: f.isRequired,
            type: f.type,
          }))
        : undefined,
      routes,
    }

    let cancelTimeout = () => {
      return
    }
    try {
      const paymentPromise = payViaPaymentDetails(paymentDetailsArgs)
      const [timeoutPromise, cancelTimeoutFn] = timeoutWithCancel(
        TIMEOUT_PAYMENT,
        "Timeout",
      )
      cancelTimeout = cancelTimeoutFn

      const paymentResult = (await Promise.race([
        paymentPromise,
        timeoutPromise,
      ])) as PayViaPaymentDetailsResult
      cancelTimeout()

      return LnPaymentAttemptResult.ok({
        roundedUpFee: toSats(paymentResult.safe_fee),
        revealedPreImage: paymentResult.secret as RevealedPreImage,
        sentFromPubkey: pubkey,
      })
    } catch (err) {
      if (err instanceof Error && err.message === "Timeout") {
        return LnPaymentAttemptResult.pending({
          sentFromPubkey: pubkey,
        })
      }
      cancelTimeout()

      const errDetails = parseLndErrorDetails(err)
      if (KnownLndErrorDetails.InvoiceAlreadyPaid.test(errDetails)) {
        return LnPaymentAttemptResult.alreadyPaid({
          sentFromPubkey: pubkey,
        })
      }

      return LnPaymentAttemptResult.err(
        handleSendPaymentLndErrors({ err, paymentHash: decodedInvoice.paymentHash }),
      )
    }
  }

  const payInvoiceViaPaymentDetails = async ({
    decodedInvoice,
    btcPaymentAmount,
    maxFeeAmount,
  }: {
    decodedInvoice: LnInvoice
    btcPaymentAmount: BtcPaymentAmount
    maxFeeAmount: BtcPaymentAmount | undefined
  }): Promise<LnPaymentAttemptResult> => {
    const lnds = listActiveLndsWithPubkeys()
    for (const { lnd, pubkey } of lnds) {
      const result = await payInvoiceViaPaymentDetailsWithLnd({
        lnd,
        pubkey,
        decodedInvoice,
        btcPaymentAmount,
        maxFeeAmount,
      })
      if (
        result.type === LnPaymentAttemptResultType.Error &&
        isConnectionError(result.error)
      ) {
        continue
      }

      return result
    }

    return LnPaymentAttemptResult.err(
      new OffChainServiceUnavailableError("no active lightning node (for offchain)"),
    )
  }

  return wrapAsyncFunctionsToRunInSpan({
    namespace: "services.lnd.offchain",
    fns: {
      isLocal,
      defaultPubkey: (): Pubkey => defaultPubkey,
      listActivePubkeys,
      listAllPubkeys,
      getBalance,
      getOnChainBalance,
      getPendingOnChainBalance,
      listIncomingOnChainTransactions,
      getInboundOutboundBalance,
      getOpeningChannelsBalance,
      getClosingChannelsBalance,
      getTotalPendingHtlcCount,
      getIncomingPendingHtlcCount,
      getOutgoingPendingHtlcCount,
      getActiveChannels,
      getOfflineChannels,
      getPublicChannels,
      getPrivateChannels,
      findRouteForInvoice,
      findRouteForNoAmountInvoice,
      registerInvoice,
      lookupInvoice,
      lookupPayment,
      listSettledPayments: listPaymentsFactory(getPayments),
      listPendingPayments: listPaymentsFactory(getPendingPayments),
      listFailedPayments,
      listInvoices,
      deletePaymentByHash,
      settleInvoice,
      cancelInvoice,
      payInvoiceViaRoutes,
      payInvoiceViaPaymentDetails,
    },
  })
}

const lookupInvoiceByPubkeyAndHash = async ({
  pubkey,
  paymentHash,
}: {
  pubkey: Pubkey
  paymentHash: PaymentHash
}): Promise<LnInvoiceLookup | LightningServiceError> => {
  try {
    const lnd = getLndFromPubkey({ pubkey })
    if (lnd instanceof Error) return lnd

    const invoice: GetInvoiceResult = await getInvoice({
      lnd,
      id: paymentHash,
    })

    return translateLnInvoiceLookup(invoice)
  } catch (err) {
    return handleReceivePaymentLndErrors(err)
  }
}

const lookupPaymentByPubkeyAndHash = async ({
  pubkey,
  paymentHash,
}: {
  pubkey: Pubkey
  paymentHash: PaymentHash
}): Promise<LnPaymentLookup | LnFailedPartialPaymentLookup | LightningServiceError> => {
  let cancelTimeout = () => {
    return
  }
  try {
    const lnd = getLndFromPubkey({ pubkey })
    if (lnd instanceof Error) return lnd

    const resultPromise = getPayment({
      lnd,
      id: paymentHash,
    })
    const [timeoutPromise, cancelTimeoutFn] = timeoutWithCancel(
      TIMEOUT_PAYMENT,
      "Timeout",
    )
    cancelTimeout = cancelTimeoutFn

    const result = (await Promise.race([
      resultPromise,
      timeoutPromise,
    ])) as GetPaymentResult
    cancelTimeout()

    const { payment, pending } = result
    const status = await resolvePaymentStatus({ lnd, result })

    if (payment) {
      return {
        createdAt: new Date(payment.created_at),
        status,
        paymentRequest: (payment.request as EncodedPaymentRequest) || undefined,
        paymentHash: payment.id as PaymentHash,
        milliSatsAmount: toMilliSatsFromString(payment.mtokens),
        roundedUpAmount: toSats(payment.safe_tokens),
        confirmedDetails: {
          confirmedAt: new Date(payment.confirmed_at),
          destination: payment.destination as Pubkey,
          revealedPreImage: payment.secret as RevealedPreImage,
          roundedUpFee: toSats(payment.safe_fee),
          milliSatsFee: toMilliSatsFromString(payment.fee_mtokens),
          hopPubkeys: undefined,
        },
        attempts: undefined,
        sentFromPubkey: pubkey,
      }
    }

    if (pending) {
      return {
        createdAt: new Date(pending.created_at),
        status,
        paymentRequest: (pending.request as EncodedPaymentRequest) || undefined,
        paymentHash: pending.id as PaymentHash,
        milliSatsAmount: toMilliSatsFromString(pending.mtokens),
        roundedUpAmount: toSats(pending.safe_tokens),
        confirmedDetails: undefined,
        attempts: undefined,
        sentFromPubkey: pubkey,
      }
    }

    if (status === PaymentStatus.Failed) {
      return { status: PaymentStatus.Failed, sentFromPubkey: pubkey }
    }

    return new BadPaymentDataError(JSON.stringify(result))
  } catch (err) {
    if (err instanceof Error && err.message === "Timeout") {
      return new LookupPaymentTimedOutError()
    }
    cancelTimeout()
    const errDetails = parseLndErrorDetails(err)
    const match = (knownErrDetail: RegExp): boolean => knownErrDetail.test(errDetails)
    switch (true) {
      case match(KnownLndErrorDetails.SentPaymentNotFound):
        return new PaymentNotFoundError(JSON.stringify({ paymentHash, pubkey }))
      default:
        return handleCommonLightningServiceErrors(err)
    }
  }
}

const isPaymentConfirmed = (p: PaymentResult): p is ConfirmedPaymentResult =>
  p.is_confirmed

const translateLnPaymentLookup = ({
  p,
  sentFromPubkey,
}: {
  p: PaymentResult
  sentFromPubkey: Pubkey
}): LnPaymentLookup => ({
  createdAt: new Date(p.created_at),
  status: p.is_confirmed ? PaymentStatus.Settled : PaymentStatus.Pending,
  paymentHash: p.id as PaymentHash,
  paymentRequest: p.request as EncodedPaymentRequest,
  milliSatsAmount: toMilliSatsFromString(p.mtokens),
  roundedUpAmount: toSats(p.safe_tokens),
  confirmedDetails: isPaymentConfirmed(p)
    ? {
        confirmedAt: new Date(p.confirmed_at),
        destination: p.destination as Pubkey,
        revealedPreImage: p.secret as RevealedPreImage,
        roundedUpFee: toSats(p.safe_fee),
        milliSatsFee: toMilliSatsFromString(p.fee_mtokens),
        hopPubkeys: p.hops as Pubkey[],
      }
    : undefined,
  attempts: p.attempts,
  sentFromPubkey,
})

const translateLnInvoiceLookup = (
  invoice: GetInvoiceResult | GetInvoicesResult["invoices"][number],
): LnInvoiceLookup => ({
  paymentHash: invoice.id as PaymentHash,
  createdAt: new Date(invoice.created_at),
  confirmedAt: invoice.confirmed_at ? new Date(invoice.confirmed_at) : undefined,
  isSettled: !!invoice.is_confirmed,
  isCanceled: !!invoice.is_canceled,
  isHeld: !!invoice.is_held,
  heldAt:
    invoice.payments && invoice.payments.length
      ? new Date(invoice.payments[0].created_at)
      : undefined,
  roundedDownReceived: toSats(invoice.received),
  milliSatsReceived: toMilliSatsFromString(invoice.received_mtokens),
  secretPreImage: invoice.secret as SecretPreImage,
  lnInvoice: {
    description: invoice.description,
    paymentRequest: (invoice.request as EncodedPaymentRequest) || undefined,
    expiresAt: new Date(invoice.expires_at),
    roundedDownAmount: toSats(invoice.tokens),
  },
})

const resolvePaymentStatus = async ({
  lnd,
  result,
}: {
  lnd: AuthenticatedLnd
  result: GetPaymentResult
}): Promise<PaymentStatus> => {
  const { is_confirmed, is_failed, payment, pending } = result

  if (is_confirmed) return PaymentStatus.Settled
  if (is_failed) return PaymentStatus.Failed

  const cache = LocalCacheService()
  const currentBlockHeight = await cache.getOrSet({
    key: CacheKeys.BlockHeight,
    ttlSecs: SECS_PER_5_MINS,
    getForCaching: async () => {
      const { current_block_height } = await getWalletInfo({ lnd })
      return current_block_height
    },
  })

  const timeout = pending?.timeout || payment?.timeout
  // This is a hack to handle lnd issue with pending HTLCs after channel close
  // https://github.com/lightningnetwork/lnd/issues/6249
  if (timeout && pending && currentBlockHeight > timeout) {
    const closedChannels = await cache.getOrSet({
      key: CacheKeys.ClosedChannels,
      ttlSecs: SECS_PER_5_MINS,
      getForCaching: async () => {
        const { channels } = await getClosedChannels({ lnd })
        return channels
      },
    })

    const failed = pending.paths
      .map((p) => {
        const [first] = p.hops
        return closedChannels.find((c) => c.id === first.channel)
      })
      .every((s) => !!s)

    if (failed) return PaymentStatus.Failed
  }

  return PaymentStatus.Pending
}

const extractIncomingOnChainTransactions = ({
  decoder,
  txs,
}: {
  decoder: TxDecoder
  txs: GetChainTransactionsResult
}): IncomingOnChainTransaction[] => {
  return txs.transactions
    .filter((tx) => !tx.is_outgoing && !!tx.transaction)
    .map(
      (tx): IncomingOnChainTransaction =>
        IncomingOnChainTransaction({
          confirmations: tx.confirmation_count || 0,
          rawTx: decoder.decode(tx.transaction as string),
          fee: toSats(tx.fee || 0),
          createdAt: new Date(tx.created_at),
        }),
    )
}

const handleSendPaymentLndErrors = ({
  err,
  paymentHash,
}: {
  err: Error | unknown
  paymentHash: PaymentHash
}) => {
  const errDetails = parseLndErrorDetails(err)
  const match = (knownErrDetail: RegExp): boolean => knownErrDetail.test(errDetails)
  switch (true) {
    case match(KnownLndErrorDetails.UnableToFindRoute):
    case match(KnownLndErrorDetails.FailedToFindRoute):
      return new RouteNotFoundError()
    case match(KnownLndErrorDetails.UnknownNextPeer):
      return new UnknownNextPeerError()
    case match(KnownLndErrorDetails.PaymentRejectedByDestination):
      return new PaymentRejectedByDestinationError(paymentHash)
    case match(KnownLndErrorDetails.UnknownPaymentHash):
      return new InvoiceExpiredOrBadPaymentHashError(paymentHash)
    case match(KnownLndErrorDetails.PaymentAttemptsTimedOut):
      return new PaymentAttemptsTimedOutError()
    case match(KnownLndErrorDetails.PaymentInTransition):
      return new PaymentInTransitionError(paymentHash)
    case match(KnownLndErrorDetails.TemporaryChannelFailure):
      return new TemporaryChannelFailureError(paymentHash)
    case match(KnownLndErrorDetails.TemporaryNodeFailure):
      return new TemporaryNodeFailureError(paymentHash)
    case match(KnownLndErrorDetails.InsufficientBalanceToAttemptPayment):
      return new InsufficientBalanceForLnPaymentError()
    case match(KnownLndErrorDetails.FeaturePairExists):
      return new InvalidFeatureBitsForLndInvoiceError()

    default:
      return handleCommonLightningServiceErrors(err)
  }
}

const handleReceivePaymentLndErrors = (err: Error | unknown) => {
  const errDetails = parseLndErrorDetails(err)
  const match = (knownErrDetail: RegExp): boolean => knownErrDetail.test(errDetails)
  switch (true) {
    case match(KnownLndErrorDetails.InvoiceNotFound):
      return new InvoiceNotFoundError()
    case match(KnownLndErrorDetails.InvoiceAlreadySettled):
      return new InvoiceAlreadySettledError()
    case match(KnownLndErrorDetails.InvoiceAmountTooLarge):
      return new InvalidInvoiceAmountError(err)
    case match(KnownLndErrorDetails.SecretDoesNotMatchAnyExistingHodlInvoice):
      return new SecretDoesNotMatchAnyExistingHodlInvoiceError(err)

    default:
      return handleCommonLightningServiceErrors(err)
  }
}

const handleCommonLightningServiceErrors = (err: Error | unknown) => {
  const errDetails = parseLndErrorDetails(err)
  const match = (knownErrDetail: RegExp): boolean => knownErrDetail.test(errDetails)
  switch (true) {
    case match(KnownLndErrorDetails.ConnectionDropped):
    case match(KnownLndErrorDetails.NoConnectionEstablished):
      checkAllLndHealth()
      return new OffChainServiceUnavailableError()
    case match(KnownLndErrorDetails.ConnectionRefused):
      checkAllLndHealth()
      return new OffChainServiceBusyError()
    default:
      return new UnknownLightningServiceError(msgForUnknown(err as LnError))
  }
}

const handleCommonRouteNotFoundErrors = (err: Error | unknown) => {
  const errDetails = parseLndErrorDetails(err)
  const match = (knownErrDetail: RegExp): boolean => knownErrDetail.test(errDetails)
  switch (true) {
    case match(KnownLndErrorDetails.ConnectionDropped):
    case match(KnownLndErrorDetails.NoConnectionEstablished):
      checkAllLndHealth()
      return new OffChainServiceUnavailableError()

    case match(KnownLndErrorDetails.MissingDependentFeature):
      return new DestinationMissingDependentFeatureError()

    case match(KnownLndErrorDetails.FeaturePairExists):
      return new InvalidFeatureBitsForLndInvoiceError()

    default:
      return new UnknownRouteNotFoundError(msgForUnknown(err as LnError))
  }
}

const isConnectionError = (result: unknown | LightningServiceError): boolean =>
  result instanceof OffChainServiceUnavailableError ||
  result instanceof OffChainServiceBusyError

const msgForUnknown = (err: LnError) =>
  JSON.stringify({
    parsedLndErrorDetails: parseLndErrorDetails(err),
    detailsFromLnd: err,
  })
