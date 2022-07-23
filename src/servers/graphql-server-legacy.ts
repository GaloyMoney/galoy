import { createServer } from "http"
import crypto from "crypto"

import { Accounts, Users } from "@app"
import { getApolloConfig, getGeetestConfig, isDev, isProd, JWT_SECRET } from "@config"
import Geetest from "@services/geetest"
import { baseLogger } from "@services/logger"
import {
  ACCOUNT_USERNAME,
  addAttributesToCurrentSpan,
  addAttributesToCurrentSpanAndPropagate,
  SemanticAttributes,
} from "@services/tracing"
import {
  ApolloServerPluginDrainHttpServer,
  ApolloServerPluginLandingPageDisabled,
  ApolloServerPluginLandingPageGraphQLPlayground,
  ApolloServerPluginUsageReporting,
} from "apollo-server-core"
import { ApolloError, ApolloServer } from "apollo-server-express"
import express from "express"
import { expressjwt } from "express-jwt"
import { execute, GraphQLError, subscribe } from "graphql"
import helmet from "helmet"
import * as jwt from "jsonwebtoken"
import pino from "pino"
import PinoHttp from "pino-http"
import {
  ExecuteFunction,
  SubscribeFunction,
  SubscriptionServer,
} from "subscriptions-transport-ws"

import { mapError } from "@graphql/error-map"

import { parseIps } from "@domain/users-ips"

import { playgroundTabs } from "../graphql/playground"

import healthzHandler from "./middlewares/healthz"
import authRouter from "./auth-router"

const graphqlLogger = baseLogger.child({
  module: "graphql",
})

const apolloConfig = getApolloConfig()

const jwtAlgorithms: jwt.Algorithm[] = ["HS256"]

const geeTestConfig = getGeetestConfig()
const geetest = Geetest(geeTestConfig)

const sessionContext = ({
  tokenPayload,
  ip,
  body,
}: {
  tokenPayload: jwt.JwtPayload | null
  ip: IpAddress | undefined
  body
}): Promise<GraphQLContext> => {
  const userId = tokenPayload?.uid ?? null

  // TODO move from crypto.randomUUID() to a Jaeger standard
  const logger = graphqlLogger.child({ tokenPayload, id: crypto.randomUUID(), body })

  let domainUser: User | null = null
  let domainAccount: Account | undefined
  return addAttributesToCurrentSpanAndPropagate(
    {
      [SemanticAttributes.ENDUSER_ID]: userId,
      [SemanticAttributes.HTTP_CLIENT_IP]: ip,
    },
    async () => {
      if (userId) {
        const loggedInUser = await Users.getUserForLogin({ userId, ip, logger })
        if (loggedInUser instanceof Error)
          throw new ApolloError("Invalid user authentication", "INVALID_AUTHENTICATION", {
            reason: loggedInUser,
          })
        domainUser = loggedInUser

        const loggedInDomainAccount = await Accounts.getAccount(
          domainUser.defaultAccountId,
        )
        if (loggedInDomainAccount instanceof Error) throw Error
        domainAccount = loggedInDomainAccount
      }

      addAttributesToCurrentSpan({ [ACCOUNT_USERNAME]: domainAccount?.username })

      return {
        logger,
        uid: userId,
        // FIXME: we should not return this for the admin graphql endpoint
        domainUser,
        domainAccount,
        geetest,
        ip,
      }
    },
  )
}

export const startApolloServer = async ({
  schema,
  port,
  startSubscriptionServer = false,
  enableApolloUsageReporting = false,
}): Promise<Record<string, unknown>> => {
  const app = express()
  const httpServer = createServer(app)

  const apolloPlugins = [
    ApolloServerPluginDrainHttpServer({ httpServer }),
    apolloConfig.playground
      ? ApolloServerPluginLandingPageGraphQLPlayground({
          settings: { "schema.polling.enable": false },
          tabs: [
            {
              endpoint: apolloConfig.playgroundUrl,
              ...playgroundTabs.default,
            },
          ],
        })
      : ApolloServerPluginLandingPageDisabled(),
  ]

  if (isProd && enableApolloUsageReporting) {
    apolloPlugins.push(
      ApolloServerPluginUsageReporting({
        rewriteError(err) {
          graphqlLogger.error(err, "Error caught in rewriteError")
          return err
        },
      }),
    )
  }

  const apolloServer = new ApolloServer({
    schema,
    introspection: apolloConfig.playground,
    plugins: apolloPlugins,
    context: async (context) => {
      // @ts-expect-error: TODO
      const tokenPayload = context.req?.token ?? null

      const body = context.req?.body ?? null

      const ipString = isDev
        ? context.req?.ip
        : context.req?.headers["x-real-ip"] || context.req?.headers["x-forwarded-for"]

      const ip = parseIps(ipString)

      return sessionContext({
        tokenPayload,
        ip,
        body,
      })
    },
    formatError: (err) => {
      try {
        // GraphQL shield seems to have a bug around throwing a custom ApolloError
        // This is a workaround for now
        const isShieldError = ["NOT_AUTHENTICATED", "NOT_AUTHORIZED"].includes(
          err.message,
        )

        const reportErrorToClient =
          isShieldError || err instanceof ApolloError || err instanceof GraphQLError

        const reportedError = {
          message: err.message,
          locations: err.locations,
          path: err.path,
          code: isShieldError ? err.message : err.extensions?.code,
        }

        return reportErrorToClient
          ? reportedError
          : { message: `Error processing GraphQL request ${reportedError.code}` }
      } catch (err) {
        return mapError(err)
      }
    },
  })

  app.use("/auth", authRouter)

  const enablePolicy = apolloConfig.playground ? false : undefined

  app.use(
    helmet({
      crossOriginEmbedderPolicy: enablePolicy,
      crossOriginOpenerPolicy: enablePolicy,
      crossOriginResourcePolicy: enablePolicy,
      contentSecurityPolicy: enablePolicy,
    }),
  )

  app.use(
    PinoHttp({
      logger: graphqlLogger,
      wrapSerializers: false,

      // Define custom serializers
      serializers: {
        // TODO: sanitize
        err: pino.stdSerializers.err,
        req: pino.stdSerializers.req,
        res: (res) => ({
          // FIXME: kind of a hack. body should be in in req. but have not being able to do it.
          body: res.req.body,
          ...pino.stdSerializers.res(res),
        }),
      },
      autoLogging: {
        ignorePaths: ["/healthz"],
      },
    }),
  )

  app.use(
    expressjwt({
      secret: JWT_SECRET,
      algorithms: jwtAlgorithms,
      credentialsRequired: false,
      requestProperty: "token",
    }),
  )

  // Health check
  app.get(
    "/healthz",
    healthzHandler({
      checkDbConnectionStatus: true,
      checkRedisStatus: true,
      checkLndsStatus: false,
    }),
  )

  await apolloServer.start()

  apolloServer.applyMiddleware({ app, path: "/graphql" })

  return new Promise((resolve, reject) => {
    httpServer.listen({ port }, () => {
      if (startSubscriptionServer) {
        const apolloSubscriptionServer = new SubscriptionServer(
          {
            execute: execute as unknown as ExecuteFunction,
            subscribe: subscribe as unknown as SubscribeFunction,
            schema,
            async onConnect(connectionParams, webSocket, connectionContext) {
              const { request } = connectionContext

              let tokenPayload: string | jwt.JwtPayload | null = null
              const authz =
                connectionParams.authorization || connectionParams.Authorization
              if (authz) {
                const rawToken = authz.slice(7)
                tokenPayload = jwt.verify(rawToken, JWT_SECRET, {
                  algorithms: jwtAlgorithms,
                })

                if (typeof tokenPayload === "string") {
                  throw new Error("tokenPayload should be an object")
                }
              }

              return sessionContext({
                tokenPayload,
                ip: request?.socket?.remoteAddress,

                // TODO: Resolve what's needed here
                body: null,
              })
            },
          },
          {
            server: httpServer,
            path: apolloServer.graphqlPath,
          },
        )
        ;["SIGINT", "SIGTERM"].forEach((signal) => {
          process.on(signal, () => apolloSubscriptionServer.close())
        })
      }

      console.log(
        `🚀 Server ready at http://localhost:${port}${apolloServer.graphqlPath}`,
      )
      resolve({ app, httpServer, apolloServer })
    })

    httpServer.on("error", (err) => {
      console.error(err)
      reject(err)
    })
  })
}
