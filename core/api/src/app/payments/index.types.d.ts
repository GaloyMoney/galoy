type PaymentSendResult = {
  status: PaymentSendStatus
  transaction: WalletTransaction
}

type PaymentSendAttemptResultTypeObj =
  typeof import("./ln-send-result").PaymentSendAttemptResultType
type PaymentSendAttemptResultType =
  PaymentSendAttemptResultTypeObj[keyof PaymentSendAttemptResultTypeObj]

type IntraLedgerSendAttemptResult =
  | {
      type: PaymentSendAttemptResultTypeObj["Ok"]
      journalId: LedgerJournalId
    }
  | {
      type: PaymentSendAttemptResultTypeObj["AlreadyPaid"]
    }
  | {
      type: PaymentSendAttemptResultTypeObj["Error"]
      error: ApplicationError
    }

type LnSendAttemptResult =
  | {
      type: PaymentSendAttemptResultTypeObj["Ok"]
      journalId: LedgerJournalId
    }
  | {
      type: PaymentSendAttemptResultTypeObj["Pending"]
      journalId: LedgerJournalId
    }
  | {
      type: PaymentSendAttemptResultTypeObj["AlreadyPaid"]
      journalId: LedgerJournalId
    }
  | {
      type: PaymentSendAttemptResultTypeObj["ErrorWithJournal"]
      journalId: LedgerJournalId
      error: ApplicationError
    }
  | {
      type: PaymentSendAttemptResultTypeObj["Error"]
      error: ApplicationError
    }
