import { WalletCurrency } from "@/domain/shared"
import { WalletInvoiceStatus } from "@/domain/wallet-invoices"
import { WalletInvoiceStatusChecker } from "@/domain/wallet-invoices/wallet-invoice-status-checker"

const earlierDate = new Date("2023-10-18T20:07:44.949Z")
const laterDate = new Date("2023-10-18T20:08:44.950Z")
const baseInvoice: WalletInvoice = {
  paymentHash: "paymentHash" as PaymentHash,
  secret: "secretPreImage" as SecretPreImage,
  selfGenerated: true,
  pubkey: "pubkey" as Pubkey,
  recipientWalletDescriptor: {
    id: "walletId" as WalletId,
    currency: WalletCurrency.Usd,
    accountId: "accountId" as AccountId,
  },
  paid: false,
  createdAt: new Date(Date.now()),
  processingCompleted: false,
  externalId: "externalId" as LedgerExternalId,
  lnInvoice: {
    destination: "destination" as Pubkey,
    paymentHash: "paymentHash" as PaymentHash,
    paymentRequest: "paymentRequest" as EncodedPaymentRequest,
    paymentSecret: "paymentSecret" as PaymentIdentifyingSecret,
    milliSatsAmount: 0 as MilliSatoshis,
    description: "description",
    routeHints: [] as Hop[][],
    features: [] as LnInvoiceFeature[],
    expiresAt: new Date(),
    isExpired: false,
    cltvDelta: null,
    amount: null,
    paymentAmount: null,
    createdAt: new Date(),
  },
}

describe("WalletInvoiceStatusChecker", () => {
  describe("status", () => {
    it("returns paid for paid unexpired invoice", () => {
      const paidInvoice = {
        ...baseInvoice,
        paid: true,
        lnInvoice: { ...baseInvoice.lnInvoice, expiresAt: laterDate },
      }
      expect(WalletInvoiceStatusChecker(paidInvoice).status(earlierDate)).toBe(
        WalletInvoiceStatus.Paid,
      )
    })

    it("returns paid for paid expired invoice", () => {
      const paidInvoice = {
        ...baseInvoice,
        paid: true,
        lnInvoice: { ...baseInvoice.lnInvoice, expiresAt: earlierDate },
      }
      expect(WalletInvoiceStatusChecker(paidInvoice).status(laterDate)).toBe(
        WalletInvoiceStatus.Paid,
      )
    })

    it("returns pending for unpaid unexpired invoice", () => {
      const unpaidInvoice = {
        ...baseInvoice,
        paid: false,
        lnInvoice: { ...baseInvoice.lnInvoice, expiresAt: laterDate },
      }
      expect(WalletInvoiceStatusChecker(unpaidInvoice).status(earlierDate)).toBe(
        WalletInvoiceStatus.Pending,
      )
    })

    it("returns expired for unpaid expired invoice", () => {
      const unpaidInvoice = {
        ...baseInvoice,
        paid: false,
        lnInvoice: { ...baseInvoice.lnInvoice, expiresAt: earlierDate },
      }
      expect(WalletInvoiceStatusChecker(unpaidInvoice).status(laterDate)).toBe(
        WalletInvoiceStatus.Expired,
      )
    })
  })
})
