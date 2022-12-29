import dotenv from "dotenv"
import { applyMiddleware } from "graphql-middleware"
import { and, shield } from "graphql-shield"

import { baseLogger } from "@services/logger"
import { setupMongoConnection } from "@services/mongodb"

import { activateLndHealthCheck } from "@services/lnd/health"

import { GALOY_ADMIN_PORT } from "@config"
import { adminMutationFields, adminQueryFields } from "@graphql/admin"

import { gqlAdminSchema } from "../graphql"

import { startApolloServer, isAuthenticated, isEditor } from "./graphql-server"

dotenv.config()

const graphqlLogger = baseLogger.child({ module: "graphql" })

export async function startApolloServerForAdminSchema() {
  const authedQueryFields = {}
  for (const key of Object.keys(adminQueryFields.authed)) {
    authedQueryFields[key] = and(isAuthenticated, isEditor)
  }

  const authedMutationFields = {}
  for (const key of Object.keys(adminMutationFields.authed)) {
    authedMutationFields[key] = and(isAuthenticated, isEditor)
  }

  const permissions = shield(
    {
      Query: authedQueryFields,
      Mutation: authedMutationFields,
    },
    { allowExternalErrors: true },
  )

  const schema = applyMiddleware(gqlAdminSchema, permissions)
  return startApolloServer({ schema, port: GALOY_ADMIN_PORT, type: "admin" })
}

if (require.main === module) {
  setupMongoConnection()
    .then(async () => {
      activateLndHealthCheck()
      await startApolloServerForAdminSchema()
    })
    .catch((err) => graphqlLogger.error(err, "server error"))
}
