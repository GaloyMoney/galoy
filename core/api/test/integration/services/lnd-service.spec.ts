import {
  createInvoice,
  deleteForwardingReputations,
  getChannel,
  getChannels,
  LightningError as LnError,
  payViaPaymentDetails,
  payViaRoutes,
  subscribeToInvoice,
} from "lightning"

import { LND1_PUBKEY, MS_PER_SEC } from "@/config"

import { WalletCurrency } from "@/domain/shared"
import { toSats } from "@/domain/bitcoin"
import {
  InvoiceNotFoundError,
  PaymentNotFoundError,
  PaymentRejectedByDestinationError,
  PaymentStatus,
  RouteNotFoundError,
  decodeInvoice,
  LnPaymentAttemptResultType,
} from "@/domain/bitcoin/lightning"
import { LnFees } from "@/domain/payments"

import { LndService } from "@/services/lnd"
import { parseLndErrorDetails } from "@/services/lnd/config"

import { sleep } from "@/utils"

import {
  bitcoindClient,
  fundLnd,
  getError,
  lnd1,
  lndOutside1,
  lndOutside2,
  mineAndConfirm,
  openChannelTestingNoAccounting,
  resetIntegrationLnds,
  setChannelFees,
  waitFor,
} from "test/helpers"
import { BitcoindWalletClient } from "test/helpers/bitcoind"

const amountInvoice = toSats(1000)
const btcPaymentAmount = { amount: BigInt(amountInvoice), currency: WalletCurrency.Btc }
const ROUTE_PPM_RATE = 10_000
const ROUTE_PPM_PERCENT = ROUTE_PPM_RATE / 1_000_000

const loadBitcoindWallet = async (walletName: string) => {
  const wallets = await bitcoindClient.listWallets()
  if (!wallets.includes(walletName)) {
    try {
      await bitcoindClient.createWallet({ walletName })
    } catch (err) {
      const error = err as Error
      if (error.message.includes("Database already exists")) {
        await bitcoindClient.loadWallet({ filename: walletName })
      }
    }
  }
}

const fundOnChainWallets = async () => {
  // Setup outside bitcoind
  const walletName = "outside"
  const bitcoindOutside = new BitcoindWalletClient(walletName)

  // Fund outside bitcoind
  const numOfBlocks = 10
  const bitcoindAddress = await bitcoindOutside.getNewAddress()
  await mineAndConfirm({
    walletClient: bitcoindOutside,
    numOfBlocks,
    address: bitcoindAddress,
  })

  // Fund lnd1
  const btc = 1
  await fundLnd(lnd1, btc)
}

/* eslint @typescript-eslint/ban-ts-comment: "off" */
// @ts-ignore-next-line no-implicit-any error
const getChannelWithRetry = async ({ lnd, id }) => {
  const countMax = 9

  let channel
  let errMsg: string | undefined = "FullChannelDetailsNotFound"
  let count = 0
  while (count < countMax && errMsg === "FullChannelDetailsNotFound") {
    count++
    await sleep(250)
    try {
      channel = await getChannel({ id, lnd })
      errMsg = undefined
    } catch (err) {
      if (Array.isArray(err)) errMsg = err[1]
    }
  }
  if (!(count < countMax && errMsg !== "FullChannelDetailsNotFound")) {
    throw new Error("Could find updated channel details")
  }
  // @ts-ignore-next-line no-implicit-any error
  if (!(channel.policies && channel.policies.length)) {
    throw new Error("No channel policies found")
  }

  return channel
}

// @ts-ignore-next-line no-implicit-any error
const setFeesOnChannel = async ({ localLnd, partnerLnd, base, rate }) => {
  const countMax = 9

  // Get routing channel details
  const { channels } = await getChannels({ lnd: partnerLnd })
  const { id: chanId } = channels[0]
  const channel = await getChannelWithRetry({ id: chanId, lnd: localLnd })

  // Set channel policy
  let setOnChannel
  let count = 0
  while (count < countMax && setOnChannel !== true) {
    if (count > 0) await sleep(500)
    count++

    setOnChannel = await setChannelFees({
      lnd: localLnd,
      // @ts-ignore-next-line no-implicit-any error
      channel,
      base,
      rate,
    })
  }
  if (!(count < countMax && setOnChannel)) {
    throw new Error("Could not update channel fees")
  }

  // Verify policy change
  // @ts-ignore-next-line no-implicit-any error
  const { policies } = await getChannelWithRetry({ id: channel.id, lnd: localLnd })
  const { base_fee_mtokens, fee_rate } = policies[0]
  if (!(base_fee_mtokens === `${base * 1000}` && fee_rate === rate)) {
    throw new Error("Incorrect policy on channel")
  }

  return chanId
}

const setupLndRoute = async () => {
  // Setup route from lnd1 -> lndOutside1 -> lndOutside2
  const btc = 1
  await fundLnd(lndOutside1, btc)

  await openChannelTestingNoAccounting({
    lnd: lndOutside1,
    lndPartner: lndOutside2,
    socket: `lnd-outside-2:9735`,
    is_private: true,
  })

  await setFeesOnChannel({
    localLnd: lndOutside1,
    partnerLnd: lndOutside2,
    base: 0,
    rate: ROUTE_PPM_RATE,
  })
}

const createPrivateInvoice = async ({
  lnd,
  tokens,
}: {
  lnd: AuthenticatedLnd
  tokens?: number
}): Promise<LnInvoice> => {
  let lnInvoice: LnInvoice | undefined = undefined
  let tries = 0
  let routeHints: Hop[][] = []
  while (routeHints.length === 0 && tries < 20) {
    tries++

    const { request } = await createInvoice({
      lnd,
      tokens,
      is_including_private_channels: true,
    })
    const invoice = decodeInvoice(request)
    if (invoice instanceof Error) throw invoice

    lnInvoice = invoice
    ;({ routeHints } = lnInvoice)
    await sleep(500)
  }
  if (lnInvoice === undefined) throw new Error("lnInvoice is undefined")

  return lnInvoice
}

beforeAll(async () => {
  // Seed lnd1 & lndOutside1
  await loadBitcoindWallet("outside")
  await resetIntegrationLnds()
  await fundOnChainWallets()
  await openChannelTestingNoAccounting({
    lnd: lnd1,
    lndPartner: lndOutside1,
    socket: `lnd-outside-1:9735`,
  })
  await setupLndRoute()
})

afterAll(async () => {
  await bitcoindClient.unloadWallet({ walletName: "outside" })
})

describe("Lnd", () => {
  describe("LndService", () => {
    const lndService = LndService()
    if (lndService instanceof Error) throw lndService

    it("fails when repaying invoice", async () => {
      // Create invoice
      const { request } = await createInvoice({
        lnd: lndOutside1,
        tokens: amountInvoice,
      })
      const lnInvoice = decodeInvoice(request)
      if (lnInvoice instanceof Error) throw lnInvoice

      const paid = await lndService.payInvoiceViaPaymentDetails({
        decodedInvoice: lnInvoice,
        btcPaymentAmount,
        maxFeeAmount: undefined,
      })
      if (paid.type === LnPaymentAttemptResultType.Error) throw paid.error
      if (!(paid.type === LnPaymentAttemptResultType.Ok)) {
        throw new Error(JSON.stringify(paid))
      }
      expect(paid.result.revealedPreImage).toHaveLength(64)

      const retryPaid = await lndService.payInvoiceViaPaymentDetails({
        decodedInvoice: lnInvoice,
        btcPaymentAmount,
        maxFeeAmount: undefined,
      })
      expect(retryPaid.type).toEqual(LnPaymentAttemptResultType.AlreadyPaid)
    })

    it("fails to pay when channel capacity exceeded", async () => {
      const { request } = await createInvoice({ lnd: lndOutside1, tokens: 1500000 })
      const lnInvoice = decodeInvoice(request)
      if (lnInvoice instanceof Error) throw lnInvoice

      const paid = await lndService.payInvoiceViaPaymentDetails({
        decodedInvoice: lnInvoice,
        btcPaymentAmount,
        maxFeeAmount: undefined,
      })
      expect(paid.type === LnPaymentAttemptResultType.Error && paid.error).toBeInstanceOf(
        PaymentRejectedByDestinationError,
      )
    })

    it("pay invoice with High CLTV Delta", async () => {
      // Create invoice
      const { request } = await createInvoice({
        lnd: lndOutside1,
        tokens: amountInvoice,
        cltv_delta: 200,
      })
      const lnInvoice = decodeInvoice(request)
      if (lnInvoice instanceof Error) throw lnInvoice

      const paid = await lndService.payInvoiceViaPaymentDetails({
        decodedInvoice: lnInvoice,
        btcPaymentAmount,
        maxFeeAmount: undefined,
      })
      if (paid.type === LnPaymentAttemptResultType.Error) throw paid.error
      expect(
        paid.type === LnPaymentAttemptResultType.Ok && paid.result.revealedPreImage,
      ).toHaveLength(64)
    })

    it("pays high fee route with no max limit", async () => {
      const lnInvoice = await createPrivateInvoice({
        lnd: lndOutside2,
      })

      const paid = await lndService.payInvoiceViaPaymentDetails({
        decodedInvoice: lnInvoice,
        btcPaymentAmount,
        maxFeeAmount: undefined,
      })
      if (paid.type === LnPaymentAttemptResultType.Error) throw paid.error
      if (!(paid.type === LnPaymentAttemptResultType.Ok)) {
        throw new Error(JSON.stringify(paid))
      }
      expect(paid.result.revealedPreImage).toHaveLength(64)

      expect(paid.result.roundedUpFee).toEqual(
        Number(btcPaymentAmount.amount) * ROUTE_PPM_PERCENT,
      )
    })

    it("fails to pay high fee route with max limit set", async () => {
      const lnInvoice = await createPrivateInvoice({
        lnd: lndOutside2,
      })

      const paid = await lndService.payInvoiceViaPaymentDetails({
        decodedInvoice: lnInvoice,
        btcPaymentAmount,
        maxFeeAmount: LnFees().maxProtocolAndBankFee(btcPaymentAmount),
      })
      expect(paid.type === LnPaymentAttemptResultType.Error && paid.error).toBeInstanceOf(
        RouteNotFoundError,
      )
    })

    it("fails to probe across route with fee higher than payment amount", async () => {
      const amountInvoice = 1

      // Change channel policy
      await setFeesOnChannel({
        localLnd: lndOutside1,
        partnerLnd: lndOutside2,
        base: 10,
        rate: ROUTE_PPM_RATE,
      })

      // Create invoice
      const lnInvoice = await createPrivateInvoice({
        lnd: lndOutside2,
        tokens: amountInvoice,
      })

      // Execute probe and check result
      const probed = await lndService.findRouteForInvoice({
        invoice: lnInvoice,
      })
      expect(probed).toBeInstanceOf(RouteNotFoundError)

      // Reset lnd mission control
      await deleteForwardingReputations({ lnd: lnd1 })
    })

    it("deletes payment", async () => {
      const { request, secret } = await createInvoice({ lnd: lndOutside1 })
      const revealedPreImage = secret as RevealedPreImage
      const lnInvoice = decodeInvoice(request)
      if (lnInvoice instanceof Error) throw lnInvoice
      const { paymentHash } = lnInvoice

      const paid = await lndService.payInvoiceViaPaymentDetails({
        decodedInvoice: lnInvoice,
        btcPaymentAmount,
        maxFeeAmount: undefined,
      })
      if (paid instanceof Error) throw paid

      // Confirm payment exists in lnd
      const retrievedPayment = await lndService.lookupPayment({ paymentHash })
      expect(retrievedPayment).not.toBeInstanceOf(Error)
      if (retrievedPayment instanceof Error) throw retrievedPayment
      expect(retrievedPayment.status).toBe(PaymentStatus.Settled)
      if (retrievedPayment.status !== PaymentStatus.Settled) throw new Error()
      expect(retrievedPayment.confirmedDetails?.revealedPreImage).toBe(revealedPreImage)

      // Delete payment
      const deleted = await lndService.deletePaymentByHash({
        paymentHash,
        pubkey: LND1_PUBKEY,
      })
      expect(deleted).not.toBeInstanceOf(Error)

      // Check that payment no longer exists
      const retrievedDeletedPayment = await lndService.lookupPayment({ paymentHash })
      expect(retrievedDeletedPayment).toBeInstanceOf(PaymentNotFoundError)

      // Check that deleting missing payment doesn't return error
      const deletedAttempt = await lndService.deletePaymentByHash({
        paymentHash,
        pubkey: LND1_PUBKEY,
      })
      expect(deletedAttempt).not.toBeInstanceOf(Error)
    })

    it("cancels invoice", async () => {
      // Note: this is a test for gc-canceled-invoices-on-the-fly=true settings

      // Create invoice
      const { request } = await createInvoice({
        lnd: lnd1,
        tokens: amountInvoice,
      })
      const lnInvoice = decodeInvoice(request)
      if (lnInvoice instanceof Error) throw lnInvoice
      const { paymentHash } = lnInvoice

      // Fetch invoice
      const invoiceLookup = await lndService.lookupInvoice({ paymentHash })
      if (invoiceLookup instanceof Error) throw invoiceLookup
      expect(invoiceLookup.paymentHash).toEqual(paymentHash)

      // Cancel invoice
      const canceled = await lndService.cancelInvoice({
        pubkey: LND1_PUBKEY,
        paymentHash,
      })
      if (canceled instanceof Error) throw canceled

      // Retry fetching invoice
      const invoiceReLookup = await lndService.lookupInvoice({ paymentHash })
      expect(invoiceReLookup).toBeInstanceOf(InvoiceNotFoundError)
    })

    it("handles expired invoices", async () => {
      // Create invoice
      const expires_at = new Date(Date.now() + MS_PER_SEC).toISOString()
      const { request } = await createInvoice({
        lnd: lnd1,
        tokens: amountInvoice,
        expires_at,
      })
      const lnInvoice = decodeInvoice(request)
      if (lnInvoice instanceof Error) throw lnInvoice
      const { paymentHash } = lnInvoice

      // Fetch invoice
      const invoiceLookup = await lndService.lookupInvoice({ paymentHash })
      if (invoiceLookup instanceof Error) throw invoiceLookup
      expect(invoiceLookup.paymentHash).toEqual(paymentHash)

      // Listen for expiry
      let isCanceled = false
      const sub = subscribeToInvoice({ lnd: lnd1, id: paymentHash })
      sub.on("invoice_updated", async (invoice) => {
        await sleep(1000)
        isCanceled = invoice.is_canceled
      })
      await waitFor(async () => isCanceled)
      sub.removeAllListeners()

      // Retry fetching invoice
      const invoiceReLookup = await lndService.lookupInvoice({ paymentHash })
      expect(invoiceReLookup).toBeInstanceOf(InvoiceNotFoundError)
    })
  })

  describe("'lightning' library error handling", () => {
    // Test construction taken from:
    // https://github.com/alexbosworth/lightning/blob/edcaf671e6a0bd2d8f8aa39b51ef816b2a633560/test/lnd_methods/offchain/test_pay_via_routes.js#L28
    it("parses error message when no additional details are found", async () => {
      const payArgs = { id: "id", lnd: lnd1, routes: [] }
      const err = await getError<LnError>(() => payViaRoutes(payArgs))
      expect(err).toHaveLength(2)
      expect(err[0]).toEqual(400)

      const parsedErr = parseLndErrorDetails(err)
      expect(parsedErr).toBe("ExpectedStandardHexPaymentHashId")
    })

    it("parses error message from err object", async () => {
      const { request } = await createInvoice({
        lnd: lndOutside1,
        tokens: 1000,
      })
      const decodedInvoice = decodeInvoice(request as EncodedPaymentRequest)
      expect(decodedInvoice).not.toBeInstanceOf(Error)
      if (decodedInvoice instanceof Error) throw decodedInvoice

      const paymentDetailsArgs = {
        lnd: lnd1,
        id: decodedInvoice.paymentHash,
        destination: decodedInvoice.destination,
        mtokens: decodedInvoice.milliSatsAmount.toString(),
        payment: decodedInvoice.paymentSecret as string,
        cltv_delta: decodedInvoice.cltvDelta || undefined,
        features: decodedInvoice.features
          ? decodedInvoice.features.map((f) => ({
              bit: f.bit,
              is_required: f.isRequired,
              type: f.type,
            }))
          : undefined,
        routes: [],
      }

      await payViaPaymentDetails(paymentDetailsArgs)

      const err = await getError<LnError>(() => payViaPaymentDetails(paymentDetailsArgs))
      expect(err).toHaveLength(3)
      expect(err[0]).toEqual(503)
      expect(err[1]).toBe("UnexpectedPaymentError")
      expect(err[2]).toHaveProperty("err")
      expect(err[2]).not.toHaveProperty("failures")

      const nestedErrObj = err[2].err
      expect(nestedErrObj).toBeInstanceOf(Error)
      expect(nestedErrObj).toHaveProperty("code")
      expect(nestedErrObj).toHaveProperty("metadata")

      const expectedDetails = "invoice is already paid"
      expect(nestedErrObj).toHaveProperty("details", expectedDetails)

      const parsedErr = parseLndErrorDetails(err)
      expect(parsedErr).toBe(expectedDetails)
    })

    it("parses error message from failures object", async () => {
      const payArgs = {
        lnd: lnd1,
        routes: [
          {
            fee: 1,
            fee_mtokens: "1000",
            hops: [
              {
                channel: "1x1x1",
                channel_capacity: 1,
                fee: 1,
                fee_mtokens: "1000",
                forward: 1,
                forward_mtokens: "1000",
                public_key: Buffer.alloc(33).toString("hex"),
                timeout: 100,
              },
            ],
            mtokens: "1000",
            timeout: 100,
            tokens: 1,
          },
        ],
      }

      const err = await getError<LnError<{ failures: LnError }>>(() =>
        payViaRoutes(payArgs),
      )
      expect(err).toHaveLength(3)
      expect(err[0]).toEqual(503)
      expect(err[1]).toBe("UnexpectedErrorWhenPayingViaRoute")

      const nestedFailureErr = err[2].failures[0]
      expect(nestedFailureErr).toHaveLength(3)

      /* eslint @typescript-eslint/ban-ts-comment: "off" */
      // @ts-ignore-next-line no-implicit-any error
      expect(nestedFailureErr[0]).toEqual(err[0])

      // @ts-ignore-next-line no-implicit-any error
      expect(nestedFailureErr[1]).toBe(err[1])

      // @ts-ignore-next-line no-implicit-any error
      const nestedErrObj = nestedFailureErr[2].err
      expect(nestedErrObj).toBeInstanceOf(Error)
      expect(nestedErrObj).toHaveProperty("code")
      expect(nestedErrObj).toHaveProperty("metadata")

      const expectedDetails = "invalid public key: unsupported format: 0"
      expect(nestedErrObj).toHaveProperty("details", expectedDetails)

      const parsedErr = parseLndErrorDetails(err)
      expect(parsedErr).toBe(expectedDetails)
    })
  })
})
