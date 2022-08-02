import { DomainError } from "@domain/shared"

export class AccountError extends DomainError {}

export class UsernameNotAvailableError extends AccountError {}
export class UsernameIsImmutableError extends AccountError {}

export class AccountCustomFieldsError extends DomainError {}

export class AccountCustomFieldsUpdateError extends AccountCustomFieldsError {}
