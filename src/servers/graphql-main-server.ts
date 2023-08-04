import dotenv from "dotenv"
import { applyMiddleware } from "graphql-middleware"
import { shield } from "graphql-shield"
import { Rule } from "graphql-shield/typings/rules"

import { bootstrap } from "@app/bootstrap"

import { setupMongoConnection } from "@services/mongodb"
import { activateLndHealthCheck } from "@services/lnd/health"
import { baseLogger } from "@services/logger"

import { env } from "@config"

import { gqlMainSchema, mutationFields, queryFields } from "@graphql/public"

import { isAuthenticated, startApolloServer } from "./graphql-server"
import { walletIdMiddleware } from "./middlewares/wallet-id"
import { startApolloServerForAdminSchema } from "./graphql-admin-server"

const graphqlLogger = baseLogger.child({ module: "graphql" })

dotenv.config()

export async function startApolloServerForCoreSchema() {
  const authedQueryFields: { [key: string]: Rule } = {}
  for (const key of Object.keys({
    ...queryFields.authed.atAccountLevel,
    ...queryFields.authed.atWalletLevel,
  })) {
    authedQueryFields[key] = isAuthenticated
  }

  const authedMutationFields: { [key: string]: Rule } = {}
  for (const key of Object.keys({
    ...mutationFields.authed.atAccountLevel,
    ...mutationFields.authed.atWalletLevel,
  })) {
    authedMutationFields[key] = isAuthenticated
  }

  const permissions = shield(
    {
      Query: authedQueryFields,
      Mutation: authedMutationFields,
    },
    { allowExternalErrors: true },
  )

  const schema = applyMiddleware(gqlMainSchema, permissions, walletIdMiddleware)
  return startApolloServer({
    schema,
    port: env.GALOY_API_PORT,
    type: "main",
  })
}

if (require.main === module) {
  setupMongoConnection(true)
    .then(async () => {
      activateLndHealthCheck()

      const res = await bootstrap()
      if (res instanceof Error) throw res

      await Promise.race([
        startApolloServerForCoreSchema(),
        startApolloServerForAdminSchema(),
      ])
    })
    .catch((err) => graphqlLogger.error(err, "server error"))
}
