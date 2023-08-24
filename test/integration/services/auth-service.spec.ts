import {
  EmailCodeInvalidError,
  EmailUnverifiedError,
  LikelyNoUserWithThisPhoneExistError,
  LikelyUserAlreadyExistError,
} from "@domain/authentication/errors"
import {
  AuthWithEmailPasswordlessService,
  AuthWithPhonePasswordlessService,
  AuthWithUsernamePasswordDeviceIdService,
  AuthenticationKratosError,
  EmailAlreadyExistsError,
  IdentityRepository,
  IncompatibleSchemaUpgradeError,
  KratosError,
  SchemaIdType,
  extendSession,
  listSessions,
  validateKratosToken,
} from "@services/kratos"
import { kratosAdmin, kratosPublic } from "@services/kratos/private"
import { revokeSessions } from "@services/kratos/tests-but-not-prod"
import { sleep } from "@utils"

import { randomEmail, randomPassword, randomPhone, randomUsername } from "test/helpers"
import { getEmailCode } from "test/helpers/kratos"

const createIdentity = async () => {
  const phone = randomPhone()
  const created = await AuthWithPhonePasswordlessService().createIdentityWithSession({
    phone,
  })
  if (created instanceof Error) throw created
  return { phone, kratosUserId: created.kratosUserId, authToken: created.authToken }
}

describe("phoneNoPassword schema", () => {
  const authService = AuthWithPhonePasswordlessService()
  const identities = IdentityRepository()

  describe("public selflogin api", () => {
    describe("user", () => {
      it("creates a user", async () => {
        const phone = randomPhone()
        const res = await authService.createIdentityWithSession({ phone })
        if (res instanceof Error) throw res
        expect(res).toHaveProperty("kratosUserId")

        const resRetryCreate = await authService.createIdentityWithSession({ phone })
        expect(resRetryCreate).toBeInstanceOf(LikelyUserAlreadyExistError)
      })

      it("logs user in if exists", async () => {
        const { phone, kratosUserId } = await createIdentity()

        const res = await authService.loginToken({ phone })
        if (res instanceof Error) throw res
        expect(res.kratosUserId).toBe(kratosUserId)

        const identity = await identities.getIdentity(kratosUserId)
        if (identity instanceof Error) throw identity
        expect(identity.schema).toBe(SchemaIdType.PhoneNoPasswordV0)
      })

      it("fails to log user in if doesn't exist", async () => {
        const phone = randomPhone()
        const res = await authService.loginToken({ phone })
        expect(res).toBeInstanceOf(LikelyNoUserWithThisPhoneExistError)
      })

      it("validate bearer token", async () => {
        const { kratosUserId, authToken } = await createIdentity()

        const res = await validateKratosToken(authToken)
        if (res instanceof Error) throw res
        expect(res.kratosUserId).toBe(kratosUserId)
      })

      it("return error on invalid token", async () => {
        const res = await validateKratosToken("invalid_token" as AuthToken)
        expect(res).toBeInstanceOf(AuthenticationKratosError)
      })
    })

    describe("user sessions", () => {
      it("adds a new session for a new login", async () => {
        const { phone, kratosUserId } = await createIdentity()

        const startingSessions = await listSessions(kratosUserId)
        if (startingSessions instanceof Error) throw startingSessions

        await authService.loginToken({ phone })

        const sessions = await listSessions(kratosUserId)
        if (sessions instanceof Error) throw sessions
        expect(sessions.length - startingSessions.length).toEqual(1)
      })

      it("login with cookie then revoke session", async () => {
        const phone = randomPhone()

        const res = (await authService.createIdentityWithCookie({
          phone,
        })) as WithCookieResponse
        expect(res).toHaveProperty("kratosUserId")
        expect(res).toHaveProperty("cookiesToSendBackToClient")

        const cookies: Array<SessionCookie> = res.cookiesToSendBackToClient
        let cookieStr = ""
        for (const cookie of cookies) {
          cookieStr = cookieStr + cookie + "; "
        }
        cookieStr = decodeURIComponent(cookieStr)

        const kratosSession = await kratosPublic.toSession({ cookie: cookieStr })
        const sessionId = kratosSession.data.id
        const kratosResp = await kratosAdmin.disableSession({
          id: sessionId,
        })
        expect(kratosResp.status).toBe(204)
      })

      it("return error on revoked session", async () => {
        const { kratosUserId, authToken: token } = await createIdentity()

        await revokeSessions(kratosUserId)
        const res = await validateKratosToken(token)
        expect(res).toBeInstanceOf(AuthenticationKratosError)
      })

      it("revoke a user's second session only", async () => {
        const { phone } = await createIdentity()

        // Session 1
        const session1 = await authService.loginToken({ phone })
        if (session1 instanceof Error) throw session1
        const session1Token = session1.authToken

        // Session 2
        const session2 = await authService.loginToken({ phone })
        if (session2 instanceof Error) throw session2
        const session2Token = session2.authToken

        // Session Details
        //  *caveat, you need to have at least 2 active sessions
        //  for 'listMySessions' to work properly if you only
        //  have 1 active session the data will come back null
        const session1Details = await kratosPublic.listMySessions({
          xSessionToken: session1Token,
        })
        const session1Id = session1Details.data[0].id
        const session2Details = await kratosPublic.listMySessions({
          xSessionToken: session2Token,
        })
        const session2Id = session2Details.data[0].id
        expect(session1Id).toBeDefined()
        expect(session2Id).toBeDefined()

        // Revoke Session 2
        await kratosPublic.performNativeLogout({
          performNativeLogoutBody: {
            session_token: session2Token,
          },
        })

        const isSession1Valid = await validateKratosToken(session1Token)
        const isSession2Valid = await validateKratosToken(session2Token)
        expect(isSession1Valid).toBeDefined()
        expect(isSession2Valid).toBeInstanceOf(KratosError)
      })

      it("extend session", async () => {
        const { authToken } = await createIdentity()

        const res = await kratosPublic.toSession({ xSessionToken: authToken })
        const sessionKratos = res.data
        if (!sessionKratos.expires_at) throw Error("should have expired_at")
        const initialExpiresAt = new Date(sessionKratos.expires_at)

        const sessionId = sessionKratos.id as SessionId

        await extendSession(sessionId)
        await sleep(200)

        const res2 = await kratosPublic.toSession({ xSessionToken: authToken })
        const newSession = res2.data
        if (!newSession.expires_at) throw Error("should have expired_at")
        const newExpiresAt = new Date(newSession.expires_at)

        expect(initialExpiresAt.getTime()).toBeLessThan(newExpiresAt.getTime())
      })
    })
  })

  describe("admin api", () => {
    it("create a user with admin api, and can login with self api", async () => {
      const phone = randomPhone()
      const kratosUserId = await authService.createIdentityNoSession({ phone })
      if (kratosUserId instanceof Error) throw kratosUserId

      const res = await authService.loginToken({ phone })
      if (res instanceof Error) throw res

      expect(res.kratosUserId).toBe(kratosUserId)
    })
  })

  describe("IdentityRepository", () => {
    it("gets user id from phone", async () => {
      const { phone, kratosUserId } = await createIdentity()

      const userId = await identities.getUserIdFromIdentifier(phone)
      if (userId instanceof Error) throw userId
      expect(userId).toBe(kratosUserId)
    })
  })
})

describe("phone+email schema", () => {
  const authServiceEmail = AuthWithEmailPasswordlessService()
  const authServicePhone = AuthWithPhonePasswordlessService()
  const identities = IdentityRepository()

  describe("user", () => {
    it("creates a user with phone", async () => {
      const { phone, kratosUserId } = await createIdentity()

      const identity = await identities.getIdentity(kratosUserId)
      if (identity instanceof Error) throw identity
      expect(identity.phone).toBe(phone)
      expect(identity.email).toBeUndefined()

      expect(await authServiceEmail.hasEmail({ kratosUserId })).toBe(false)
    })

    it("upgrades to phone+email schema", async () => {
      const { kratosUserId } = await createIdentity()

      const email = randomEmail()
      const res = await authServiceEmail.addUnverifiedEmailToIdentity({
        kratosUserId,
        email,
      })
      if (res instanceof Error) throw res

      const identity = await identities.getIdentity(kratosUserId)
      if (identity instanceof Error) throw identity
      expect(identity.schema).toBe("phone_email_no_password_v0")
      expect(identity.email).toBe(email)

      expect(await authServiceEmail.hasEmail({ kratosUserId })).toBe(true)
      expect(await authServiceEmail.isEmailVerified({ email })).toBe(false)
    })

    it("can't add same email to multiple identities", async () => {
      const { kratosUserId } = await createIdentity()
      const email = randomEmail()
      await authServiceEmail.addUnverifiedEmailToIdentity({
        kratosUserId,
        email,
      })

      const { kratosUserId: newkratosUserId } = await createIdentity()
      const res = await authServiceEmail.addUnverifiedEmailToIdentity({
        kratosUserId: newkratosUserId,
        email,
      })
      expect(res).toBeInstanceOf(EmailAlreadyExistsError)
    })

    it("verifies email for identity", async () => {
      const { kratosUserId } = await createIdentity()
      const email = randomEmail()
      await authServiceEmail.addUnverifiedEmailToIdentity({
        kratosUserId,
        email,
      })

      const emailFlowId = await authServiceEmail.sendEmailWithCode({ email })
      if (emailFlowId instanceof Error) throw emailFlowId

      // TODO: look if there are rate limit on the side of kratos
      const wrongCode = "000000" as EmailCode
      let res = await authServiceEmail.validateCode({
        code: wrongCode,
        emailFlowId,
      })
      expect(res).toBeInstanceOf(EmailCodeInvalidError)
      expect(await authServiceEmail.isEmailVerified({ email })).toBe(false)

      const code = await getEmailCode(email)
      res = await authServiceEmail.validateCode({
        code,
        emailFlowId,
      })
      if (res instanceof Error) throw res
      expect(res.email).toBe(email)
      expect(await authServiceEmail.isEmailVerified({ email })).toBe(true)
    })

    it("fails to verify non-existent email", async () => {
      const email = randomEmail()
      const flow = await authServiceEmail.sendEmailWithCode({ email })
      if (flow instanceof Error) throw flow

      await expect(async () => getEmailCode(email)).rejects.toThrow()
    })

    it("gets login token using unverified email", async () => {
      const { kratosUserId } = await createIdentity()
      const email = randomEmail()
      await authServiceEmail.addUnverifiedEmailToIdentity({
        kratosUserId,
        email,
      })

      const res = await authServiceEmail.loginToken({ email })
      if (res instanceof Error) throw res
      expect(res.kratosUserId).toBe(kratosUserId)
      expect(res.authToken).toBeTruthy()
    })

    it("gets login cookie using unverified email", async () => {
      const { kratosUserId } = await createIdentity()
      const email = randomEmail()
      await authServiceEmail.addUnverifiedEmailToIdentity({
        kratosUserId,
        email,
      })

      const res = await authServiceEmail.loginCookie({ email })
      if (res instanceof Error) throw res
      expect(res.kratosUserId).toBe(kratosUserId)
      expect(res.cookiesToSendBackToClient.length).toBe(2)
    })

    it("gets login token & correct schema using phone", async () => {
      const { phone, kratosUserId } = await createIdentity()
      const email = randomEmail()
      await authServiceEmail.addUnverifiedEmailToIdentity({
        kratosUserId,
        email,
      })

      const res = await authServicePhone.loginToken({ phone })
      if (res instanceof Error) throw res
      expect(res.kratosUserId).toBe(kratosUserId)
      expect(res.authToken).toBeTruthy()

      const identity = await identities.getIdentity(kratosUserId)
      if (identity instanceof Error) throw identity
      expect(identity.schema).toBe(SchemaIdType.PhoneEmailNoPasswordV0)
    })

    it("removes email from identity", async () => {
      const { kratosUserId } = await createIdentity()
      const email = randomEmail()
      await authServiceEmail.addUnverifiedEmailToIdentity({
        kratosUserId,
        email,
      })

      const res = await authServiceEmail.removeEmailFromIdentity({ kratosUserId })
      if (res instanceof Error) throw res

      const identity = await identities.getIdentity(kratosUserId)
      if (identity instanceof Error) throw identity
      expect(identity.schema).toBe(SchemaIdType.PhoneNoPasswordV0)
    })

    it("fails to remove phone if no email attached", async () => {
      const { kratosUserId } = await createIdentity()
      const res = await authServiceEmail.removePhoneFromIdentity({ kratosUserId })
      expect(res).toBeInstanceOf(IncompatibleSchemaUpgradeError)
    })

    it("removes phone from identity with verified email", async () => {
      const { kratosUserId } = await createIdentity()
      const email = randomEmail()
      await authServiceEmail.addUnverifiedEmailToIdentity({
        kratosUserId,
        email,
      })

      const emailFlowId = await authServiceEmail.sendEmailWithCode({ email })
      if (emailFlowId instanceof Error) throw emailFlowId
      const code = await getEmailCode(email)
      const validated = await authServiceEmail.validateCode({
        code,
        emailFlowId,
      })
      if (validated instanceof Error) throw validated

      const res = await authServiceEmail.removePhoneFromIdentity({ kratosUserId })
      expect(res).not.toBeInstanceOf(Error)

      const identity = await identities.getIdentity(kratosUserId)
      if (identity instanceof Error) throw identity
      expect(identity.schema).toBe(SchemaIdType.EmailNoPasswordV0)
    })

    it("fails to remove phone with unverified email", async () => {
      const { kratosUserId } = await createIdentity()
      const email = randomEmail()
      await authServiceEmail.addUnverifiedEmailToIdentity({
        kratosUserId,
        email,
      })

      const res = await authServiceEmail.removePhoneFromIdentity({ kratosUserId })
      expect(res).toBeInstanceOf(EmailUnverifiedError)
    })
  })

  describe("IdentityRepository", () => {
    it("gets userId via email", async () => {
      const { kratosUserId } = await createIdentity()

      const email = randomEmail()
      const res = await authServiceEmail.addUnverifiedEmailToIdentity({
        kratosUserId,
        email,
      })
      if (res instanceof Error) throw res

      const userId = await identities.getUserIdFromIdentifier(email)
      if (userId instanceof Error) throw userId
      expect(userId).toBe(kratosUserId)
    })
  })
})

describe("username+password schema (device account)", () => {
  const authServiceUsername = AuthWithUsernamePasswordDeviceIdService()
  const authServicePhone = AuthWithPhonePasswordlessService()
  const identities = IdentityRepository()

  it("create an account", async () => {
    const username = randomUsername()
    const password = randomPassword()

    const res = await authServiceUsername.createIdentityWithSession({
      username,
      password,
    })
    if (res instanceof Error) throw res
    const { kratosUserId } = res

    const newIdentity = await identities.getIdentity(kratosUserId)
    if (newIdentity instanceof Error) throw newIdentity
    expect(newIdentity.schema).toBe(SchemaIdType.UsernamePasswordDeviceIdV0)
    expect(newIdentity.username).toBe(username)
  })

  it("upgrade account", async () => {
    const username = randomUsername()
    const password = randomPassword()
    const usernameResult = await authServiceUsername.createIdentityWithSession({
      username,
      password,
    })
    if (usernameResult instanceof Error) throw usernameResult
    const { kratosUserId } = usernameResult

    const phone = randomPhone()
    const res = await authServicePhone.updateIdentityFromDeviceAccount({
      phone,
      userId: kratosUserId,
    })
    if (res instanceof Error) throw res

    expect(res.phone).toBe(phone)
    expect(res.id).toBe(kratosUserId)
  })
})
