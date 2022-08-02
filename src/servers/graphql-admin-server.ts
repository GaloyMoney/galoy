import dotenv from "dotenv"
import { applyMiddleware } from "graphql-middleware"
import { and, shield } from "graphql-shield"

import { baseLogger } from "@services/logger"
import { setupMongoConnection } from "@services/mongodb"

import { activateLndHealthCheck } from "@services/lnd/health"

import { GALOY_ADMIN_PORT } from "@config"

import { gqlAdminSchema } from "../graphql"

import { isAuthenticated, isEditor, serverPath } from "./helper"

dotenv.config()

const graphqlLogger = baseLogger.child({ module: "graphql" })

export async function startApolloServerForAdminSchema() {
  const permissions = shield(
    {
      Query: {
        allLevels: and(isAuthenticated, isEditor),
        accountDetailsByUserPhone: and(isAuthenticated, isEditor),
        accountDetailsByUsername: and(isAuthenticated, isEditor),
        transactionById: and(isAuthenticated, isEditor),
        transactionsByHash: and(isAuthenticated, isEditor),
        lightningInvoice: and(isAuthenticated, isEditor),
        lightningPayment: and(isAuthenticated, isEditor),
        wallet: and(isAuthenticated, isEditor),
        listWalletIds: and(isAuthenticated, isEditor),
      },
      Mutation: {
        accountUpdateStatus: and(isAuthenticated, isEditor),
        accountUpdateLevel: and(isAuthenticated, isEditor),
        businessUpdateMapInfo: and(isAuthenticated, isEditor),
        coldStorageRebalanceToHotWallet: and(isAuthenticated, isEditor),
      },
    },
    { allowExternalErrors: true },
  )

  const schema = applyMiddleware(gqlAdminSchema, permissions)

  const { startApolloServer } = await import(serverPath)
  return startApolloServer({ schema, port: GALOY_ADMIN_PORT })
}

if (require.main === module) {
  setupMongoConnection()
    .then(async () => {
      activateLndHealthCheck()
      await startApolloServerForAdminSchema()
    })
    .catch((err) => graphqlLogger.error(err, "server error"))
}
