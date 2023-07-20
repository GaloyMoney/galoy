import { createAccountForDeviceAccount } from "@app/accounts/create-account"

import {
  EmailUnverifiedError,
  IdentifierNotFoundError,
} from "@domain/authentication/errors"

import {
  checkedToDeviceId,
  checkedToIdentityPassword,
  checkedToIdentityUsername,
} from "@domain/users"
import {
  AuthWithEmailPasswordlessService,
  AuthWithPhonePasswordlessService,
  AuthWithUsernamePasswordDeviceIdService,
  IdentityRepository,
  PhoneAccountAlreadyExistsNeedToSweepFundsError,
} from "@services/kratos"

import { LedgerService } from "@services/ledger"
import { WalletsRepository } from "@services/mongoose"
import {
  addAttributesToCurrentSpan,
  recordExceptionInCurrentSpan,
} from "@services/tracing"

import { upgradeAccountFromDeviceToPhone } from "@app/accounts"
import { checkedToEmailCode } from "@domain/authentication"
import { isPhoneCodeValid, TwilioClient } from "@services/twilio"

import { IPMetadataValidator } from "@domain/accounts-ips/ip-metadata-validator"

import { getAccountCountries } from "@config"

import {
  InvalidIPForOnboardingError,
  InvalidPhoneForOnboardingError,
  InvalidPhoneMetadataForOnboardingError,
} from "@domain/errors"
import { IpFetcher } from "@services/ipfetcher"

import { IpFetcherServiceError } from "@domain/ipfetcher"
import { ErrorLevel } from "@domain/shared"

import { PhoneMetadataValidator } from "@domain/users/phone-metadata-validator"

import {
  checkFailedLoginAttemptPerIpLimits,
  checkFailedLoginAttemptPerLoginIdentifierLimits,
  rewardFailedLoginAttemptPerIpLimits,
  rewardFailedLoginAttemptPerLoginIdentifierLimits,
} from "./ratelimits"

export const loginWithPhoneToken = async ({
  phone,
  code,
  ip,
}: {
  phone: PhoneNumber
  code: PhoneCode
  ip: IpAddress
}): Promise<LoginWithPhoneResult | ApplicationError> => {
  {
    const limitOk = await checkFailedLoginAttemptPerIpLimits(ip)
    if (limitOk instanceof Error) return limitOk
  }

  {
    const limitOk = await checkFailedLoginAttemptPerLoginIdentifierLimits(phone)
    if (limitOk instanceof Error) return limitOk
  }

  // TODO:
  // add fibonachi on failed login
  // https://github.com/animir/node-rate-limiter-flexible/wiki/Overall-example#dynamic-block-duration

  const validCode = await isPhoneCodeValid({ phone, code })
  if (validCode instanceof Error) return validCode

  await rewardFailedLoginAttemptPerIpLimits(ip)
  await rewardFailedLoginAttemptPerLoginIdentifierLimits(phone)

  const authService = AuthWithPhonePasswordlessService()

  const identities = IdentityRepository()
  const userId = await identities.getUserIdFromIdentifier(phone)

  if (userId instanceof IdentifierNotFoundError) {
    // user is a new user
    // this branch exists because we currently make no difference between a registration and login
    addAttributesToCurrentSpan({ "login.newAccount": true })

    const accountConfig = getAccountCountries()

    if (accountConfig.enableIpCheck) {
      const ipFetcherInfo = await IpFetcher().fetchIPInfo(ip)

      if (ipFetcherInfo instanceof IpFetcherServiceError) {
        recordExceptionInCurrentSpan({
          error: ipFetcherInfo,
          level: ErrorLevel.Critical,
          attributes: { ip },
        })
        return ipFetcherInfo
      }

      const validatedIPMetadata =
        IPMetadataValidator(accountConfig).validateForOnboarding(ipFetcherInfo)

      if (validatedIPMetadata instanceof Error) {
        return new InvalidIPForOnboardingError(validatedIPMetadata.name)
      }
    }

    let phoneMetadata: PhoneMetadata | undefined

    if (accountConfig.enablePhoneCheck) {
      const newPhoneMetadata = await TwilioClient().getCarrier(phone)

      if (newPhoneMetadata instanceof Error) {
        return new InvalidPhoneMetadataForOnboardingError()
      }

      const validatedPhoneMetadata =
        PhoneMetadataValidator(accountConfig).validateForOnboarding(phoneMetadata)

      if (validatedPhoneMetadata instanceof Error) {
        return new InvalidPhoneForOnboardingError()
      }

      phoneMetadata = newPhoneMetadata
    }

    const kratosResult = await authService.createIdentityWithSession({
      phone,
      phoneMetadata,
    })
    if (kratosResult instanceof Error) return kratosResult

    return { authToken: kratosResult.authToken, totpRequired: false }
  }

  if (userId instanceof Error) return userId

  const kratosResult = await authService.loginToken({ phone })
  if (kratosResult instanceof Error) return kratosResult

  // if kratosUserId is not returned, it means that 2fa is required
  const totpRequired = !kratosResult.kratosUserId

  return { authToken: kratosResult.authToken, totpRequired }
}

export const loginWithPhoneCookie = async ({
  phone,
  code,
  ip,
}: {
  phone: PhoneNumber
  code: PhoneCode
  ip: IpAddress
}): Promise<LoginWithPhoneCookieSchemaResponse | ApplicationError> => {
  {
    const limitOk = await checkFailedLoginAttemptPerIpLimits(ip)
    if (limitOk instanceof Error) return limitOk
  }

  {
    const limitOk = await checkFailedLoginAttemptPerLoginIdentifierLimits(phone)
    if (limitOk instanceof Error) return limitOk
  }

  // TODO:
  // add fibonachi on failed login
  // https://github.com/animir/node-rate-limiter-flexible/wiki/Overall-example#dynamic-block-duration

  const validCode = await isPhoneCodeValid({ phone, code })
  if (validCode instanceof Error) return validCode

  await Promise.all([
    rewardFailedLoginAttemptPerIpLimits(ip),
    rewardFailedLoginAttemptPerLoginIdentifierLimits(phone),
  ])

  const authService = AuthWithPhonePasswordlessService()

  const identities = IdentityRepository()
  const userId = await identities.getUserIdFromIdentifier(phone)

  if (userId instanceof IdentifierNotFoundError) {
    // user is a new user
    // this branch exists because we currently make no difference between a registration and login
    addAttributesToCurrentSpan({ "login.newAccount": true })

    const kratosResult = await authService.createIdentityWithCookie({ phone })
    if (kratosResult instanceof Error) return kratosResult

    return kratosResult
  }

  if (userId instanceof Error) return userId

  const kratosResult = await authService.loginCookie({ phone })
  if (kratosResult instanceof Error) return kratosResult
  return kratosResult
}

export const loginWithEmail = async ({
  emailFlowId,
  code: codeRaw,
  ip,
}: {
  emailFlowId: EmailFlowId
  code: EmailCode
  ip: IpAddress
}): Promise<LoginWithEmailResult | ApplicationError> => {
  {
    const limitOk = await checkFailedLoginAttemptPerIpLimits(ip)
    if (limitOk instanceof Error) return limitOk
  }

  const code = checkedToEmailCode(codeRaw)
  if (code instanceof Error) return code

  const authServiceEmail = AuthWithEmailPasswordlessService()

  const validateCodeRes = await authServiceEmail.validateCode({
    code,
    emailFlowId,
  })
  if (validateCodeRes instanceof Error) return validateCodeRes

  const email = validateCodeRes.email
  const totpRequired = validateCodeRes.totpRequired

  const isEmailVerified = await authServiceEmail.isEmailVerified({ email })
  if (isEmailVerified instanceof Error) return isEmailVerified
  if (isEmailVerified === false) return new EmailUnverifiedError()

  await rewardFailedLoginAttemptPerIpLimits(ip)

  const res = await authServiceEmail.loginToken({ email })
  if (res instanceof Error) throw res
  return { authToken: res.authToken, totpRequired }
}

export const loginWithEmailCookie = async ({
  emailFlowId,
  code: codeRaw,
  ip,
}: {
  emailFlowId: EmailFlowId
  code: EmailCode
  ip: IpAddress
}): Promise<LoginWithEmailCookieResult | ApplicationError> => {
  {
    const limitOk = await checkFailedLoginAttemptPerIpLimits(ip)
    if (limitOk instanceof Error) return limitOk
  }

  const code = checkedToEmailCode(codeRaw)
  if (code instanceof Error) return code

  const authServiceEmail = AuthWithEmailPasswordlessService()

  const validateCodeRes = await authServiceEmail.validateCode({
    code,
    emailFlowId,
  })
  if (validateCodeRes instanceof Error) return validateCodeRes

  const email = validateCodeRes.email
  const totpRequired = validateCodeRes.totpRequired

  const isEmailVerified = await authServiceEmail.isEmailVerified({ email })
  if (isEmailVerified instanceof Error) return isEmailVerified
  if (isEmailVerified === false) return new EmailUnverifiedError()

  await rewardFailedLoginAttemptPerIpLimits(ip)

  const kratosResult = await authServiceEmail.loginCookie({ email })
  if (kratosResult instanceof Error) return kratosResult
  return { ...kratosResult, totpRequired }
}

export const loginDeviceUpgradeWithPhone = async ({
  phone,
  code,
  ip,
  account,
}: {
  phone: PhoneNumber
  code: PhoneCode
  ip: IpAddress
  account: Account
}): Promise<LoginDeviceUpgradeWithPhoneResult | ApplicationError> => {
  {
    const limitOk = await checkFailedLoginAttemptPerIpLimits(ip)
    if (limitOk instanceof Error) return limitOk
  }
  {
    const limitOk = await checkFailedLoginAttemptPerLoginIdentifierLimits(phone)
    if (limitOk instanceof Error) return limitOk
  }

  const validCode = await isPhoneCodeValid({ phone, code })
  if (validCode instanceof Error) return validCode

  await rewardFailedLoginAttemptPerIpLimits(ip)
  await rewardFailedLoginAttemptPerLoginIdentifierLimits(phone)

  const identities = IdentityRepository()
  const userId = await identities.getUserIdFromIdentifier(phone)

  // Happy Path - phone account does not exist
  if (userId instanceof IdentifierNotFoundError) {
    // a. create kratos account
    // b. and c. migrate account/user collection in mongo via kratos/registration webhook

    // check if account is upgradeable
    const accountConfig = getAccountCountries()

    if (accountConfig.enableIpCheck) {
      const ipFetcherInfo = await IpFetcher().fetchIPInfo(ip)

      if (ipFetcherInfo instanceof IpFetcherServiceError) {
        recordExceptionInCurrentSpan({
          error: ipFetcherInfo,
          level: ErrorLevel.Critical,
          attributes: { ip },
        })
        return ipFetcherInfo
      }

      const validatedIPMetadata =
        IPMetadataValidator(accountConfig).validateForOnboarding(ipFetcherInfo)

      if (validatedIPMetadata instanceof Error) {
        return new InvalidIPForOnboardingError(validatedIPMetadata.name)
      }
    }

    let phoneMetadata: PhoneMetadata | undefined

    if (accountConfig.enablePhoneCheck) {
      const newPhoneMetadata = await TwilioClient().getCarrier(phone)

      if (newPhoneMetadata instanceof Error) {
        return new InvalidPhoneMetadataForOnboardingError()
      }

      const validatedPhoneMetadata =
        PhoneMetadataValidator(accountConfig).validateForReward(phoneMetadata)

      if (validatedPhoneMetadata instanceof Error) {
        return new InvalidPhoneForOnboardingError()
      }

      phoneMetadata = newPhoneMetadata
    }

    const success = await AuthWithUsernamePasswordDeviceIdService().upgradeToPhoneSchema({
      phone,
      userId: account.kratosUserId,
    })
    if (success instanceof Error) return success

    const res = await upgradeAccountFromDeviceToPhone({
      userId: account.kratosUserId,
      phone,
      phoneMetadata,
    })
    if (res instanceof Error) return res
    return { success }
  }

  // Complex path - Phone account already exists
  // is there still txns left over on the device account?
  const deviceWallets = await WalletsRepository().listByAccountId(account.id)
  if (deviceWallets instanceof Error) return deviceWallets
  const ledger = LedgerService()
  let deviceAccountHasBalance = false
  for (const wallet of deviceWallets) {
    const balance = await ledger.getWalletBalance(wallet.id)
    if (balance instanceof Error) return balance
    if (balance > 0) {
      deviceAccountHasBalance = true
    }
  }
  if (deviceAccountHasBalance) return new PhoneAccountAlreadyExistsNeedToSweepFundsError()

  // no txns on device account but phone account exists, just log the user in with the phone account
  const authService = AuthWithPhonePasswordlessService()
  const kratosResult = await authService.loginToken({ phone })
  if (kratosResult instanceof Error) return kratosResult
  return { success: true, authToken: kratosResult.authToken }
}

export const loginWithDevice = async ({
  username: usernameRaw,
  password: passwordRaw,
  ip,
  deviceId: deviceIdRaw,
}: {
  ip: IpAddress
  username: string
  password: string
  deviceId: string
}): Promise<AuthToken | ApplicationError> => {
  {
    const limitOk = await checkFailedLoginAttemptPerIpLimits(ip)
    if (limitOk instanceof Error) return limitOk
  }

  const deviceId = checkedToDeviceId(deviceIdRaw)
  if (deviceId instanceof Error) return deviceId

  const username = checkedToIdentityUsername(usernameRaw)
  if (username instanceof Error) return username

  const password = checkedToIdentityPassword(passwordRaw)
  if (password instanceof Error) return password

  const authService = AuthWithUsernamePasswordDeviceIdService()
  const res = await authService.createIdentityWithSession({
    username,
    password,
  })
  if (res instanceof Error) return res

  if (res.newEntity) {
    const account = await createAccountForDeviceAccount({
      userId: res.kratosUserId,
      deviceId,
    })
    if (account instanceof Error) return account
  }

  return res.authToken
}
