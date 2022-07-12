import { DomainError, ErrorLevel } from "@domain/shared"

export class SwapError extends DomainError {}
export class SwapServiceError extends SwapError {}
export class SwapClientNotResponding extends SwapServiceError {}
export class UnknownSwapServiceError extends SwapServiceError {
  level = ErrorLevel.Critical
}
