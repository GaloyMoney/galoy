import {
  cancelHodlInvoice,
  createHodlInvoice,
  getChannelBalance,
  getClosedChannels,
  getFailedPayments,
  getInvoice,
  GetInvoiceResult,
  getPayment,
  GetPaymentResult,
  getPayments,
  getPendingPayments,
  getWalletInfo,
  payViaPaymentDetails,
  PayViaPaymentDetailsArgs,
  PayViaPaymentDetailsResult,
  payViaRoutes,
  PayViaRoutesResult,
  deletePayment,
  settleHodlInvoice,
} from "lightning"
import lnService from "ln-service"

import { SECS_PER_5_MINS } from "@config"

import { toMilliSatsFromString, toSats } from "@domain/bitcoin"
import {
  BadPaymentDataError,
  CorruptLndDbError,
  CouldNotDecodeReturnedPaymentRequest,
  decodeInvoice,
  InsufficientBalanceForRoutingError,
  InvoiceExpiredOrBadPaymentHashError,
  InvoiceNotFoundError,
  LightningServiceError,
  LnAlreadyPaidError,
  LnPaymentPendingError,
  PaymentAttemptsTimedOutError,
  PaymentInTransitionError,
  PaymentNotFoundError,
  PaymentStatus,
  ProbeForRouteTimedOutError,
  ProbeForRouteTimedOutFromApplicationError,
  RouteNotFoundError,
  SecretDoesNotMatchAnyExistingHodlInvoiceError,
  UnknownLightningServiceError,
  UnknownRouteNotFoundError,
} from "@domain/bitcoin/lightning"
import { CacheKeys } from "@domain/cache"
import { LnFees } from "@domain/payments"
import { paymentAmountFromNumber, WalletCurrency } from "@domain/shared"

import { LocalCacheService } from "@services/cache"
import { wrapAsyncFunctionsToRunInSpan } from "@services/tracing"

import { timeout } from "@utils"

import sumBy from "lodash.sumby"

import { TIMEOUT_PAYMENT } from "./auth"
import { getActiveLnd, getLndFromPubkey, getLnds, parseLndErrorDetails } from "./utils"

export const LndService = (): ILightningService | LightningServiceError => {
  const activeNode = getActiveLnd()
  if (activeNode instanceof Error) return activeNode

  const defaultLnd = activeNode.lnd
  const defaultPubkey = activeNode.pubkey as Pubkey

  const isLocal = (pubkey: Pubkey): boolean | LightningServiceError =>
    getLnds({ type: "offchain" }).some((item) => item.pubkey === pubkey)

  const listActivePubkeys = (): Pubkey[] =>
    getLnds({ active: true, type: "offchain" }).map((lndAuth) => lndAuth.pubkey as Pubkey)

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
      const errDetails = parseLndErrorDetails(err)
      return new UnknownLightningServiceError(errDetails)
    }
  }

  const getClosingChannelsBalance = async (
    pubkey?: Pubkey,
  ): Promise<Satoshis | LightningServiceError> => {
    try {
      const lnd = pubkey ? getLndFromPubkey({ pubkey }) : defaultLnd
      if (lnd instanceof Error) return lnd

      const { channels } = await getClosedChannels({ lnd })

      // FIXME: there can be issue with channel not closed completely from lnd
      // https://github.com/alexbosworth/ln-service/issues/139
      const closingChannelBalance = sumBy(channels, (channel) =>
        sumBy(channel.close_payments, (payment) =>
          payment.is_pending ? payment.tokens : 0,
        ),
      )

      return toSats(closingChannelBalance)
    } catch (err) {
      const errDetails = parseLndErrorDetails(err)
      return new UnknownLightningServiceError(errDetails)
    }
  }

  const findRouteForInvoice = async ({
    invoice,
    amount,
  }: {
    invoice: LnInvoice
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
    const maxFeeAmount = LnFees().maxProtocolFee(btcAmount)

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
    try {
      const routes: RawHopWithNumbers[][] = decodedInvoice.routeHints.map((route) =>
        route.map((hop) => ({
          base_fee_mtokens: hop.baseFeeMTokens
            ? parseFloat(hop.baseFeeMTokens)
            : undefined,
          channel: hop.channel,
          cltv_delta: hop.cltvDelta,
          fee_rate: hop.feeRate,
          public_key: hop.nodePubkey,
        })),
      )

      const probeForRouteArgs: ProbeForRouteArgs = {
        lnd: defaultLnd,
        destination: decodedInvoice.destination,
        mtokens:
          decodedInvoice.milliSatsAmount > 0
            ? decodedInvoice.milliSatsAmount.toString()
            : (amount * 1000).toString(),
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
        total_mtokens: decodedInvoice.paymentSecret
          ? decodedInvoice.milliSatsAmount > 0
            ? decodedInvoice.milliSatsAmount.toString()
            : (amount * 1000).toString()
          : undefined,
        tokens: amount,
      }
      const routePromise = lnService.probeForRoute(probeForRouteArgs)
      const timeoutPromise = timeout(TIMEOUT_PAYMENT, "Timeout")
      const { route } = await Promise.race([routePromise, timeoutPromise])
      if (!route) return new RouteNotFoundError()
      return route
    } catch (err) {
      if (err.message === "Timeout") {
        return new ProbeForRouteTimedOutFromApplicationError()
      }

      const errDetails = parseLndErrorDetails(err)
      switch (errDetails) {
        case KnownLndErrorDetails.InsufficientBalance:
          return new InsufficientBalanceForRoutingError()
        case KnownLndErrorDetails.ProbeForRouteTimedOut:
          return new ProbeForRouteTimedOutError()
        default:
          return new UnknownRouteNotFoundError(err)
      }
    }
  }

  const registerInvoice = async ({
    paymentHash,
    sats,
    description,
    descriptionHash,
    expiresAt,
  }: RegisterInvoiceArgs): Promise<RegisteredInvoice | LightningServiceError> => {
    const input = {
      lnd: defaultLnd,
      id: paymentHash,
      description,
      description_hash: descriptionHash,
      tokens: sats as number,
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
        pubkey: defaultPubkey,
      }
      return registerInvoice
    } catch (err) {
      const errDetails = parseLndErrorDetails(err)
      switch (errDetails) {
        default:
          return new UnknownLightningServiceError(JSON.stringify(err))
      }
    }
  }

  const lookupInvoice = async ({
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

      return {
        createdAt: new Date(invoice.created_at),
        confirmedAt: invoice.confirmed_at ? new Date(invoice.confirmed_at) : undefined,
        isSettled: !!invoice.is_confirmed,
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
      }
    } catch (err) {
      const errDetails = parseLndErrorDetails(err)
      switch (errDetails) {
        case KnownLndErrorDetails.InvoiceNotFound:
          return new InvoiceNotFoundError()
        default:
          return new UnknownLightningServiceError(JSON.stringify(err))
      }
    }
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
          lnPayments: payments.map(translateLnPaymentLookup),
          endCursor: (next as PagingContinueToken) || false,
        }
      } catch (err) {
        const errDetails = parseLndErrorDetails(err)
        switch (errDetails) {
          case KnownLndErrorDetails.LndDbCorruption:
            return new CorruptLndDbError()
          default:
            return new UnknownRouteNotFoundError(err)
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
      switch (errDetails) {
        case KnownLndErrorDetails.PaymentForDeleteNotFound:
          return false
        default:
          return new UnknownRouteNotFoundError(err)
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
      const errDetails = parseLndErrorDetails(err)
      switch (errDetails) {
        case KnownLndErrorDetails.SecretDoesNotMatchAnyExistingHodlInvoice:
          return new SecretDoesNotMatchAnyExistingHodlInvoiceError(err)
        default:
          return new UnknownLightningServiceError(err)
      }
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
      const errDetails = parseLndErrorDetails(err)
      switch (errDetails) {
        case KnownLndErrorDetails.InvoiceNotFound:
          return true
        default:
          return new UnknownLightningServiceError(JSON.stringify(err))
      }
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
  }): Promise<PayInvoiceResult | LightningServiceError> => {
    try {
      const lnd = getLndFromPubkey({ pubkey })
      if (lnd instanceof Error) return lnd

      const paymentPromise = payViaRoutes({
        lnd,
        routes: [rawRoute],
        id: paymentHash,
      })
      const timeoutPromise = timeout(TIMEOUT_PAYMENT, "Timeout")
      const paymentResult = (await Promise.race([
        paymentPromise,
        timeoutPromise,
      ])) as PayViaRoutesResult
      return {
        roundedUpFee: toSats(paymentResult.safe_fee),
        revealedPreImage: paymentResult.secret as RevealedPreImage,
        sentFromPubkey: pubkey,
      }
    } catch (err) {
      if (err.message === "Timeout") return new LnPaymentPendingError()

      return handleSendPaymentLndErrors({ err, paymentHash })
    }
  }

  const payInvoiceViaPaymentDetails = async ({
    decodedInvoice,
    btcPaymentAmount,
    maxFeeAmount,
  }: {
    decodedInvoice: LnInvoice
    btcPaymentAmount: BtcPaymentAmount
    maxFeeAmount: BtcPaymentAmount
  }): Promise<PayInvoiceResult | LightningServiceError> => {
    const milliSatsAmount = btcPaymentAmount.amount * 1000n
    const maxFee = maxFeeAmount.amount

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
      lnd: defaultLnd,
      id: decodedInvoice.paymentHash,
      destination: decodedInvoice.destination,
      mtokens: milliSatsAmount.toString(),
      payment: decodedInvoice.paymentSecret as string,
      max_fee: Number(maxFee),
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

    try {
      const paymentPromise = payViaPaymentDetails(paymentDetailsArgs)
      const timeoutPromise = timeout(TIMEOUT_PAYMENT, "Timeout")
      const paymentResult = (await Promise.race([
        paymentPromise,
        timeoutPromise,
      ])) as PayViaPaymentDetailsResult
      return {
        roundedUpFee: toSats(paymentResult.safe_fee),
        revealedPreImage: paymentResult.secret as RevealedPreImage,
        sentFromPubkey: defaultPubkey,
      }
    } catch (err) {
      if (err.message === "Timeout") return new LnPaymentPendingError()
      return handleSendPaymentLndErrors({ err, paymentHash: decodedInvoice.paymentHash })
    }
  }

  return wrapAsyncFunctionsToRunInSpan({
    namespace: "services.lnd.offchain",
    fns: {
      isLocal,
      defaultPubkey: (): Pubkey => defaultPubkey,
      listActivePubkeys,
      listAllPubkeys,
      getBalance,
      getOpeningChannelsBalance,
      getClosingChannelsBalance,
      findRouteForInvoice,
      findRouteForNoAmountInvoice,
      registerInvoice,
      lookupInvoice,
      lookupPayment,
      listSettledPayments: listPaymentsFactory(getPayments),
      listPendingPayments: listPaymentsFactory(getPendingPayments),
      listFailedPayments,
      deletePaymentByHash,
      settleInvoice,
      cancelInvoice,
      payInvoiceViaRoutes,
      payInvoiceViaPaymentDetails,
    },
  })
}

const lookupPaymentByPubkeyAndHash = async ({
  pubkey,
  paymentHash,
}: {
  pubkey: Pubkey
  paymentHash: PaymentHash
}): Promise<LnPaymentLookup | LnFailedPartialPaymentLookup | LightningServiceError> => {
  try {
    const lnd = getLndFromPubkey({ pubkey })
    if (lnd instanceof Error) return lnd

    const result: GetPaymentResult = await getPayment({
      lnd,
      id: paymentHash,
    })
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
      }
    } else if (pending) {
      return {
        createdAt: new Date(pending.created_at),
        status,
        paymentRequest: (pending.request as EncodedPaymentRequest) || undefined,
        paymentHash: pending.id as PaymentHash,
        milliSatsAmount: toMilliSatsFromString(pending.mtokens),
        roundedUpAmount: toSats(pending.safe_tokens),
        confirmedDetails: undefined,
        attempts: undefined,
      }
    } else if (status === PaymentStatus.Failed) {
      return { status: PaymentStatus.Failed }
    }

    return new BadPaymentDataError(JSON.stringify(result))
  } catch (err) {
    const errDetails = parseLndErrorDetails(err)
    switch (errDetails) {
      case KnownLndErrorDetails.SentPaymentNotFound:
        return new PaymentNotFoundError(JSON.stringify({ paymentHash, pubkey }))
      default:
        return new UnknownLightningServiceError(JSON.stringify(err))
    }
  }
}

const KnownLndErrorDetails = {
  InsufficientBalance: "insufficient local balance",
  InvoiceNotFound: "unable to locate invoice",
  InvoiceAlreadyPaid: "invoice is already paid",
  UnableToFindRoute: "PaymentPathfindingFailedToFindPossibleRoute",
  LndDbCorruption: "payment isn't initiated",
  PaymentRejectedByDestination: "PaymentRejectedByDestination",
  UnknownPaymentHash: "UnknownPaymentHash",
  PaymentAttemptsTimedOut: "PaymentAttemptsTimedOut",
  ProbeForRouteTimedOut: "ProbeForRouteTimedOut",
  SentPaymentNotFound: "SentPaymentNotFound",
  PaymentInTransition: "payment is in transition",
  PaymentForDeleteNotFound: "non bucket element in payments bucket",
  SecretDoesNotMatchAnyExistingHodlInvoice: "SecretDoesNotMatchAnyExistingHodlInvoice",
} as const

/* eslint @typescript-eslint/ban-ts-comment: "off" */
// @ts-ignore-next-line no-implicit-any error
const translateLnPaymentLookup = (p): LnPaymentLookup => ({
  createdAt: new Date(p.created_at),
  status: p.is_confirmed ? PaymentStatus.Settled : PaymentStatus.Pending,
  paymentHash: p.id as PaymentHash,
  paymentRequest: p.request as EncodedPaymentRequest,
  milliSatsAmount: toMilliSatsFromString(p.mtokens),
  roundedUpAmount: toSats(p.safe_tokens),
  confirmedDetails: p.is_confirmed
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
    fn: async () => {
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
      fn: async () => {
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

const handleSendPaymentLndErrors = ({
  err,
  paymentHash,
}: {
  err: Error
  paymentHash: PaymentHash
}) => {
  const errDetails = parseLndErrorDetails(err)
  switch (errDetails) {
    case KnownLndErrorDetails.InvoiceAlreadyPaid:
      return new LnAlreadyPaidError()
    case KnownLndErrorDetails.UnableToFindRoute:
      return new RouteNotFoundError()
    case KnownLndErrorDetails.PaymentRejectedByDestination:
    case KnownLndErrorDetails.UnknownPaymentHash:
      return new InvoiceExpiredOrBadPaymentHashError(paymentHash)
    case KnownLndErrorDetails.PaymentAttemptsTimedOut:
      return new PaymentAttemptsTimedOutError()
    case KnownLndErrorDetails.PaymentInTransition:
      return new PaymentInTransitionError(paymentHash)
    default:
      return new UnknownLightningServiceError(JSON.stringify(err))
  }
}
