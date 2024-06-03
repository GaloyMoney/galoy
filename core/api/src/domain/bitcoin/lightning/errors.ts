import { DomainError, ErrorLevel } from "@/domain/shared"

export class LightningError extends DomainError {}

export class LnInvoiceDecodeError extends LightningError {}
export class LnInvoiceMissingPaymentSecretError extends LnInvoiceDecodeError {}
export class InvalidChecksumForLnInvoiceError extends LnInvoiceDecodeError {}
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
export class InvoiceAlreadySettledError extends LightningServiceError {}
export class MaxFeeTooLargeForRoutelessPaymentError extends LightningServiceError {
  level = ErrorLevel.Critical
}
export class OffChainServiceUnavailableError extends LightningServiceError {
  level = ErrorLevel.Critical
}
export class OffChainServiceBusyError extends LightningServiceError {
  level = ErrorLevel.Critical
}
export class NoValidNodeForPubkeyError extends LightningServiceError {
  level = ErrorLevel.Critical
}
export class PaymentNotFoundError extends LightningServiceError {}
export class RouteNotFoundError extends LightningServiceError {}
export class UnknownNextPeerError extends LightningServiceError {}
export class InsufficientBalanceForRoutingError extends LightningServiceError {}
export class InsufficientBalanceForLnPaymentError extends LightningServiceError {}
export class InvoiceExpiredOrBadPaymentHashError extends LightningServiceError {}
export class PaymentRejectedByDestinationError extends LightningServiceError {}
export class PaymentAttemptsTimedOutError extends LightningServiceError {}
export class ProbeForRouteTimedOutError extends LightningServiceError {}
export class ProbeForRouteTimedOutFromApplicationError extends LightningServiceError {}
export class PaymentInTransitionError extends LightningServiceError {}
export class TemporaryChannelFailureError extends LightningServiceError {}
export class TemporaryNodeFailureError extends LightningServiceError {}
export class DestinationMissingDependentFeatureError extends LightningServiceError {}
export class InvalidFeatureBitsForLndInvoiceError extends LightningServiceError {}
export class InvalidInvoiceAmountError extends LightningServiceError {
  level = ErrorLevel.Warn
}
export class LookupPaymentTimedOutError extends LightningServiceError {
  level = ErrorLevel.Critical
}
export class InvalidFeeProbeStateError extends LightningServiceError {
  level = ErrorLevel.Critical
}

export class UnknownRouteNotFoundError extends LightningServiceError {
  level = ErrorLevel.Critical
}
export class BadPaymentDataError extends LightningServiceError {}
export class CorruptLndDbError extends LightningServiceError {}
