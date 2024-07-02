import isEmail from "validator/lib/isEmail"

import { Languages } from "./languages"

import {
  InvalidDeviceId,
  InvalidDeviceTokenError,
  InvalidEmailAddress,
  InvalidIdentityPassword,
  InvalidIdentityUsername,
  InvalidLanguageError,
  InvalidPhoneNumber,
} from "@/domain/errors"
import { UuidRegex } from "@/domain/shared"

export * from "./phone-metadata-validator"
export * from "./phone-metadata-authorizer"

// TODO: we could be using https://gitlab.com/catamphetamine/libphonenumber-js#readme
// for a more precise "regex"
const PhoneNumberRegex = /^\+\d{7,14}$/i // FIXME {7,14} to be refined

export const checkedToPhoneNumber = (
  phoneNumber: string,
): PhoneNumber | ValidationError => {
  if (!phoneNumber.match(PhoneNumberRegex)) {
    return new InvalidPhoneNumber(phoneNumber)
  }
  return phoneNumber as PhoneNumber
}

export const checkedToEmailAddress = (
  emailAddress: string,
): EmailAddress | ValidationError => {
  if (!isEmail(emailAddress)) {
    return new InvalidEmailAddress(emailAddress)
  }
  return emailAddress as EmailAddress
}

export const DefaultLanguage = "" as UserLanguageOrEmpty

export const checkedToLanguage = (
  language: string,
): UserLanguageOrEmpty | ValidationError => {
  if (language === "DEFAULT" || language === "") return "" as UserLanguageOrEmpty
  if (Languages.includes(language)) return language as UserLanguageOrEmpty
  return new InvalidLanguageError()
}

export const checkedToNonEmptyLanguage = (
  language: string,
): UserLanguage | ValidationError => {
  if (Languages.includes(language)) return language as UserLanguage
  return new InvalidLanguageError()
}

export const checkedToDeviceToken = (token: string): DeviceToken | ValidationError => {
  // token from firebase have a length of 163
  const correctLength = 163
  if (token.length !== correctLength) {
    return new InvalidDeviceTokenError(
      `wrong length, expected ${correctLength}, got ${token.length}`,
    )
  }

  return token as DeviceToken
}

// https://github.com/react-native-device-info/react-native-device-info#getuniqueid
export const checkedToDeviceId = (
  deviceId: string | undefined,
): DeviceId | ValidationError => {
  if (!deviceId) return new InvalidDeviceId("no input")
  if (deviceId.length > 38) {
    return new InvalidDeviceId(deviceId)
  }
  return deviceId as DeviceId
}

export const checkedToIdentityUsername = (
  username: string,
): IdentityUsername | ValidationError => {
  if (!username.match(UuidRegex)) {
    return new InvalidIdentityUsername(username)
  }
  return username as IdentityUsername
}

export const checkedToIdentityPassword = (
  password: string,
): IdentityPassword | ValidationError => {
  if (!password.match(UuidRegex)) {
    return new InvalidIdentityPassword(password)
  }
  return password as IdentityPassword
}

export { Languages }
