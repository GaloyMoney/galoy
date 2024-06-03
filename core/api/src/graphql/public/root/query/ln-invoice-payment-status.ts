import { Lightning } from "@/app"
import { WalletInvoiceStatus } from "@/domain/wallet-invoices"

import { GT } from "@/graphql/index"
import { mapAndParseErrorForGqlResponse } from "@/graphql/error-map"
import LnInvoicePaymentStatusPayload from "@/graphql/public/types/payload/ln-invoice-payment-status"
import LnInvoicePaymentStatusInput from "@/graphql/public/types/object/ln-invoice-payment-status-input"

const LnInvoicePaymentStatusQuery = GT.Field({
  type: GT.NonNull(LnInvoicePaymentStatusPayload),
  deprecationReason: "Deprecated in favor of lnInvoicePaymentStatusByPaymentRequest",
  args: {
    input: { type: GT.NonNull(LnInvoicePaymentStatusInput) },
  },
  resolve: async (_, args) => {
    const { paymentRequest } = args.input
    if (paymentRequest instanceof Error) {
      return { errors: [{ message: paymentRequest.message }] }
    }

    const paymentStatusChecker = await Lightning.PaymentStatusChecker(paymentRequest)
    if (paymentStatusChecker instanceof Error) {
      return { errors: [mapAndParseErrorForGqlResponse(paymentStatusChecker)] }
    }

    const paid = await paymentStatusChecker.invoiceIsPaid()
    if (paid instanceof Error) {
      return { errors: [mapAndParseErrorForGqlResponse(paid)] }
    }

    const { paymentHash, isExpired, expiresAt, createdAt } = paymentStatusChecker
    const result = { errors: [], paymentHash, paymentRequest, expiresAt, createdAt, status: WalletInvoiceStatus.Paid }
    if (paid) {
      return result
    }

    const status = isExpired ? WalletInvoiceStatus.Expired : WalletInvoiceStatus.Pending
    return { ...result, status }
  },
})

export default LnInvoicePaymentStatusQuery
