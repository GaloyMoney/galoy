import { Lightning } from "@/app"
import { WalletInvoiceStatus } from "@/domain/wallet-invoices"

import { GT } from "@/graphql/index"
import { mapAndParseErrorForGqlResponse } from "@/graphql/error-map"
import LnInvoicePaymentStatus from "@/graphql/public/types/object/ln-invoice-payment-status"
import LnInvoicePaymentStatusByPaymentRequestInput from "@/graphql/public/types/object/ln-invoice-payment-status-by-payment-request-input"

const LnInvoicePaymentStatusByPaymentRequestQuery = GT.Field({
  type: GT.NonNull(LnInvoicePaymentStatus),
  args: {
    input: { type: GT.NonNull(LnInvoicePaymentStatusByPaymentRequestInput) },
  },
  resolve: async (_, args) => {
    const { paymentRequest } = args.input
    if (paymentRequest instanceof Error) throw paymentRequest

    const paymentStatusChecker = await Lightning.PaymentStatusChecker(paymentRequest)
    if (paymentStatusChecker instanceof Error) {
      throw mapAndParseErrorForGqlResponse(paymentStatusChecker)
    }

    const paid = await paymentStatusChecker.invoiceIsPaid()
    if (paid instanceof Error) {
      throw mapAndParseErrorForGqlResponse(paid)
    }

    const { paymentHash, isExpired, expiresAt, createdAt } = paymentStatusChecker
    const result = { paymentHash, paymentRequest, expiresAt, createdAt, status: WalletInvoiceStatus.Paid }
    if (paid) {
      return result
    }

    const status = isExpired ? WalletInvoiceStatus.Expired : WalletInvoiceStatus.Pending
    return { ...result, status }
  },
})

export default LnInvoicePaymentStatusByPaymentRequestQuery
