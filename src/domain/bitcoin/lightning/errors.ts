import { DomainError, ErrorLevel } from "@domain/shared"

export class LightningError extends DomainError {}

export class LnInvoiceDecodeError extends LightningError {}
export class LnInvoiceMissingPaymentSecretError extends LnInvoiceDecodeError {}
export class UnknownLnInvoiceDecodeError extends LnInvoiceDecodeError {
  level = ErrorLevel.Critical
}

export class LightningServiceError extends LightningError {}
export class CouldNotDecodeReturnedPaymentRequest extends LightningServiceError {}
export class UnknownLightningServiceError extends LightningServiceError {
  level = ErrorLevel.Critical
}
export class SecretDoesNotMatchAnyExistingHodlInvoiceError extends LightningServiceError {
  level = ErrorLevel.Critical
}

export class InvoiceNotFoundError extends LightningServiceError {}
export class LnPaymentPendingError extends LightningServiceError {}
export class LnAlreadyPaidError extends LightningServiceError {}
export class OffChainServiceUnavailableError extends LightningServiceError {
  level = ErrorLevel.Critical
}
export class NoValidNodeForPubkeyError extends LightningServiceError {
  level = ErrorLevel.Critical
}
export class PaymentNotFoundError extends LightningServiceError {}
export class RouteNotFoundError extends LightningServiceError {}
export class InsufficientBalanceForRoutingError extends LightningServiceError {}
export class InvoiceExpiredOrBadPaymentHashError extends LightningServiceError {}
export class PaymentAttemptsTimedOutError extends LightningServiceError {}
export class ProbeForRouteTimedOutError extends LightningServiceError {}
export class ProbeForRouteTimedOutFromApplicationError extends LightningServiceError {}
export class PaymentInTransitionError extends LightningServiceError {}
export class InvalidFeeProbeStateError extends LightningServiceError {
  level = ErrorLevel.Critical
}

export class UnknownRouteNotFoundError extends LightningServiceError {
  level = ErrorLevel.Critical
}
export class BadPaymentDataError extends LightningServiceError {}
export class CorruptLndDbError extends LightningServiceError {}
