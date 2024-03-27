export const PaymentSendAttemptResultType = {
  Ok: "success",
  Pending: "pending",
  AlreadyPaid: "alreadyPaid",
  ErrorWithJournal: "errorWithJournal",
  Error: "error",
} as const

export const IntraLedgerSendAttemptResult = {
  ok: (journalId: LedgerJournalId): IntraLedgerSendAttemptResult => ({
    type: PaymentSendAttemptResultType.Ok,
    journalId,
  }),
  alreadyPaid: (): IntraLedgerSendAttemptResult => ({
    type: PaymentSendAttemptResultType.AlreadyPaid,
  }),
  err: (error: ApplicationError): IntraLedgerSendAttemptResult => ({
    type: PaymentSendAttemptResultType.Error,
    error,
  }),
}

export const LnSendAttemptResult = {
  ok: (journalId: LedgerJournalId): LnSendAttemptResult => ({
    type: PaymentSendAttemptResultType.Ok,
    journalId,
  }),
  pending: (journalId: LedgerJournalId): LnSendAttemptResult => ({
    type: PaymentSendAttemptResultType.Pending,
    journalId,
  }),
  alreadyPaid: (journalId: LedgerJournalId): LnSendAttemptResult => ({
    type: PaymentSendAttemptResultType.AlreadyPaid,
    journalId,
  }),
  errWithJournal: ({
    journalId,
    error,
  }: {
    journalId: LedgerJournalId
    error: ApplicationError
  }): LnSendAttemptResult => ({
    type: PaymentSendAttemptResultType.ErrorWithJournal,
    journalId,
    error,
  }),
  err: (error: ApplicationError): LnSendAttemptResult => ({
    type: PaymentSendAttemptResultType.Error,
    error,
  }),
}
