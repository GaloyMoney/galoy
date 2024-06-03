import { GT } from "@/graphql/index"
import IError from "@/graphql/shared/types/abstract/error"
import Timestamp from "@/graphql/shared/types/scalar/timestamp"
import PaymentHash from "@/graphql/shared/types/scalar/payment-hash"
import LnPaymentRequest from "@/graphql/shared/types/scalar/ln-payment-request"
import InvoicePaymentStatus from "@/graphql/shared/types/scalar/invoice-payment-status"

const LnInvoicePaymentStatusPayload = GT.Object({
  name: "LnInvoicePaymentStatusPayload",
  fields: () => ({
    errors: {
      type: GT.NonNullList(IError),
    },
    paymentHash: { type: PaymentHash },
    paymentRequest: { type: LnPaymentRequest },
    status: { type: InvoicePaymentStatus },
    expiresAt: { type: GT.NonNull(Timestamp) },
    createdAt: { type: GT.NonNull(Timestamp) },
  }),
})

export default LnInvoicePaymentStatusPayload
