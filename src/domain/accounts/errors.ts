import { DomainError } from "@domain/shared"

export class AccountError extends DomainError {}

export class UsernameNotAvailableError extends AccountError {}
export class UsernameIsImmutableError extends AccountError {}

export class AccountDataError extends DomainError {}

export class AccountDataUpdateError extends AccountDataError {}
