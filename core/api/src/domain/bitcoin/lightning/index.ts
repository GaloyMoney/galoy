import { createHash, randomBytes } from "crypto"

import { InvalidPubKeyError } from "@/domain/errors"

export { decodeInvoice } from "./ln-invoice"
export {
  invoiceExpirationForCurrency,
  defaultTimeToExpiryInSeconds,
} from "./invoice-expiration"
export * from "./ln-payment-result"
export * from "./errors"

export const PaymentStatus = {
  Settled: "settled",
  Failed: "failed",
  Pending: "pending",
} as const

export const PaymentSendStatus = {
  Success: { value: "success" },
  Failure: { value: "failed" },
  Pending: { value: "pending" },
  AlreadyPaid: { value: "already_paid" },
} as const

const pubkeyRegex = /^[a-f0-9]{66}$/i
export const checkedToPubkey = (pubkey: string): Pubkey | InvalidPubKeyError => {
  if (pubkey.match(pubkeyRegex)) {
    return pubkey as Pubkey
  }
  return new InvalidPubKeyError("Pubkey conversion error")
}

export const parseFinalHopsFromInvoice = (invoice: LnInvoice): Pubkey[] => {
  const pubkeys = [] as Pubkey[]
  const routes = invoice.routeHints
  for (const route of routes) {
    const lastIdx = route.length - 1
    const penUltIndex = route.length > 1 ? lastIdx - 1 : lastIdx
    const lastHop = route[penUltIndex]
    pubkeys.push(lastHop.nodePubkey)
  }
  return Array.from(new Set(pubkeys))
}

export const parseFinalChanIdFromInvoice = (invoice: LnInvoice): ChanId[] => {
  const chanIds = [] as ChanId[]
  const routes = invoice.routeHints
  for (const route of routes) {
    const lastIdx = route.length - 1
    const destinationChanId = route[lastIdx].channel
    if (destinationChanId !== undefined) {
      chanIds.push(destinationChanId)
    }
  }
  return Array.from(new Set(chanIds))
}

export const sha256 = (buffer: Buffer) =>
  createHash("sha256").update(buffer).digest("hex")
const randomSecret = () => randomBytes(32)

export const getSecretAndPaymentHash = () => {
  const secret = randomSecret()
  const paymentHash = sha256(secret) as PaymentHash

  return { secret: secret.toString("hex") as SecretPreImage, paymentHash }
}
