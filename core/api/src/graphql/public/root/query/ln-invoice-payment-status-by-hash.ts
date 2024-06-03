import { Lightning } from "@/app"
import { WalletInvoiceStatus } from "@/domain/wallet-invoices"

import { GT } from "@/graphql/index"
import { mapAndParseErrorForGqlResponse } from "@/graphql/error-map"
import LnInvoicePaymentStatus from "@/graphql/public/types/object/ln-invoice-payment-status"
import LnInvoicePaymentStatusByHashInput from "@/graphql/public/types/object/ln-invoice-payment-status-by-hash-input"

const LnInvoicePaymentStatusByHashQuery = GT.Field({
  type: GT.NonNull(LnInvoicePaymentStatus),
  args: {
    input: { type: GT.NonNull(LnInvoicePaymentStatusByHashInput) },
  },
  resolve: async (_, args) => {
    const { paymentHash } = args.input
    if (paymentHash instanceof Error) throw paymentHash

    const paymentStatusChecker = await Lightning.PaymentStatusCheckerByHash({
      paymentHash,
    })
    if (paymentStatusChecker instanceof Error) {
      throw mapAndParseErrorForGqlResponse(paymentStatusChecker)
    }

    const paid = await paymentStatusChecker.invoiceIsPaid()
    if (paid instanceof Error) {
      throw mapAndParseErrorForGqlResponse(paid)
    }

    const { paymentRequest, isExpired, expiresAt, createdAt } = paymentStatusChecker
    const result = { paymentHash, paymentRequest, expiresAt, createdAt, status: WalletInvoiceStatus.Paid }
    if (paid) {
      return result
    }

    const status = isExpired ? WalletInvoiceStatus.Expired : WalletInvoiceStatus.Pending
    return { ...result, status }
  },
})

export default LnInvoicePaymentStatusByHashQuery
