import { JWT_SECRET } from "@config"
import { RedisCacheService } from "@services/cache"
import { AuthWithPhonePasswordlessService } from "@services/kratos"
import { LikelyNoUserWithThisPhoneExistError } from "@services/kratos/errors"
import { UsersRepository } from "@services/mongoose"
import { NextFunction, Request, Response } from "express"
import * as jwt from "jsonwebtoken"
const jwtAlgorithms: jwt.Algorithm[] = ["HS256"]

export const updateToken = async (req: Request, res: Response, next: NextFunction) => {
  const headers = req?.headers
  let tokenPayload: string | jwt.JwtPayload | null = null
  const authz = headers.orgauthorization

  if (!authz) {
    next()
    return
  }

  const rawToken = authz.slice(7) as LegacyJwtToken

  try {
    tokenPayload = jwt.verify(rawToken, JWT_SECRET, {
      algorithms: jwtAlgorithms,
    })
  } catch (err) {
    next()
    return
  }

  if (typeof tokenPayload === "string") {
    next()
    return
  }

  if (!tokenPayload) {
    next()
    return
  }

  const uid = tokenPayload.uid
  const user = await UsersRepository().findById(uid)
  if (user instanceof Error) {
    // TODO: log error
    next()
    return
  }

  const { phone } = user

  if (!phone) {
    // TODO: log error
    // is there users who doesn't have phone on bbw?
    next()
    return
  }

  let kratosToken: SessionToken

  // the cache aim to limit to 1 session per kratos user on mobile phone
  // previously, with JWT, there is no notion of session.
  //
  // sessions will be useful because:
  // - it be possible for a user to know if other sessions are open from his account
  // and eventually log those accounts out
  // - it will be possible for an admin to revoke all sessions
  // - it will be possible to enhance user protection. if a session is attached to a mobile phone
  // then if the user agent in the request changes, it could be advisable for the user to relogin
  //
  // to keep the sessions clean, here we are caching the user credentials, so there is a lower likely that
  // during the migrations, a user is sending many requests simoultaneously and ends up with multiple sessions
  // just because the mobile app would not have update the token by the time another request is been initiated
  const cacheRes = await RedisCacheService().get<SessionToken>(rawToken)
  if (!(cacheRes instanceof Error)) {
    kratosToken = cacheRes
    res.set("kratos-session-token", kratosToken)
    next()
    return
  }

  const authService = AuthWithPhonePasswordlessService()

  let kratosResult = await authService.login(phone)

  // FIXME: only if we don't run the migration before
  if (kratosResult instanceof LikelyNoUserWithThisPhoneExistError) {
    // user has not migrated to kratos or it's a new user
    kratosResult = await authService.createWithSession(phone)
  }

  if (kratosResult instanceof Error) {
    next()
    return
  }

  kratosToken = kratosResult.sessionToken
  res.set("kratos-session-token", kratosToken)
  next()

  const twoMonths = (60 * 60 * 24 * 30) as Seconds

  await RedisCacheService().set<SessionToken>({
    key: rawToken,
    value: kratosToken,
    ttlSecs: twoMonths,
  })

  return
}
