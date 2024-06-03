export const LnPaymentAttemptResultType = {
  Ok: "success",
  Pending: "pending",
  AlreadyPaid: "alreadyPaid",
  Error: "error",
} as const

export const LnPaymentAttemptResult = {
  ok: (result: PayInvoiceResult): LnPaymentAttemptResult => ({
    type: LnPaymentAttemptResultType.Ok,
    result,
  }),
  pending: (result: PayInvoicePartialResult): LnPaymentAttemptResult => ({
    type: LnPaymentAttemptResultType.Pending,
    result,
  }),
  alreadyPaid: (result: PayInvoicePartialResult): LnPaymentAttemptResult => ({
    type: LnPaymentAttemptResultType.AlreadyPaid,
    result,
  }),
  err: (error: LightningServiceError): LnPaymentAttemptResult => ({
    type: LnPaymentAttemptResultType.Error,
    error,
  }),
}
