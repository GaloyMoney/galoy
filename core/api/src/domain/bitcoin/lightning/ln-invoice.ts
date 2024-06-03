import { parsePaymentRequest } from "invoices"

import {
  InvalidChecksumForLnInvoiceError,
  LnInvoiceDecodeError,
  LnInvoiceMissingPaymentSecretError,
  UnknownLnInvoiceDecodeError,
} from "./errors"

import { paymentAmountFromNumber, WalletCurrency } from "@/domain/shared"
import { toMilliSatsFromNumber, toSats } from "@/domain/bitcoin"

export const decodeInvoice = (
  uncheckedBolt11EncodedInvoice: string,
): LnInvoice | LnInvoiceDecodeError => {
  const bolt11EncodedInvoice =
    uncheckedBolt11EncodedInvoice.toLowerCase() as EncodedPaymentRequest

  const decodedInvoice = safeDecode(bolt11EncodedInvoice)
  if (decodedInvoice instanceof Error) return decodedInvoice

  if (!decodedInvoice.payment) {
    return new LnInvoiceMissingPaymentSecretError()
  }
  const paymentSecret: PaymentIdentifyingSecret = decodedInvoice.payment
  const cltvDelta: number | null = decodedInvoice.cltv_delta
    ? decodedInvoice.cltv_delta
    : null
  const createdAt = new Date(decodedInvoice.created_at)
  const expiresAt = new Date(decodedInvoice.expires_at)
  const isExpired = !!decodedInvoice.is_expired
  const amount: Satoshis | null = decodedInvoice.safe_tokens
    ? toSats(decodedInvoice.safe_tokens)
    : null
  const paymentAmount = amount
    ? paymentAmountFromNumber({ amount, currency: WalletCurrency.Btc })
    : null
  if (paymentAmount instanceof Error) return paymentAmount

  let routeHints: Hop[][] = []
  if (decodedInvoice.routes) {
    const invoicesRoutes = decodedInvoice.routes as RoutesBolt11Library
    routeHints = invoicesRoutes.map((rawRoute) =>
      rawRoute.map((route) => ({
        baseFeeMTokens: route.base_fee_mtokens,
        channel: route.channel as ChanId,
        cltvDelta: route.cltv_delta,
        feeRate: route.fee_rate,
        nodePubkey: route.public_key as Pubkey,
      })),
    )
  }

  return {
    amount,
    paymentAmount,
    paymentSecret,
    expiresAt,
    isExpired,
    routeHints,
    cltvDelta,
    createdAt,
    paymentRequest: bolt11EncodedInvoice as EncodedPaymentRequest,
    description: decodedInvoice.description || "",
    paymentHash: decodedInvoice.id as PaymentHash,
    destination: decodedInvoice.destination as Pubkey,
    milliSatsAmount: toMilliSatsFromNumber(amount ? amount * 1000 : 0),
    features: (decodedInvoice.features || []) as LnInvoiceFeature[],
  }
}

const safeDecode = (bolt11EncodedInvoice: EncodedPaymentRequest) => {
  try {
    return parsePaymentRequest({ request: bolt11EncodedInvoice })
  } catch (err) {
    if (err instanceof Error && err.message.includes("Invalid checksum")) {
      return new InvalidChecksumForLnInvoiceError()
    }
    return new UnknownLnInvoiceDecodeError(err)
  }
}
