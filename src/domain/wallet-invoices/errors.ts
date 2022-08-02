import { ValidationError, ErrorLevel } from "@domain/shared"

export class InvalidWalletInvoiceBuilderStateError extends ValidationError {
  level = ErrorLevel.Critical
}
