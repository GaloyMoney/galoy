import { GraphQLResolveInfo, GraphQLFieldResolver } from "graphql"

import { Accounts } from "@app"
import { mapError } from "@graphql/error-map"
import { mutationFields, queryFields } from "@graphql/main"

type InputArgs = Record<"input", Record<string, unknown>>

const validateWalletId = async (
  resolve: GraphQLFieldResolver<unknown, GraphQLContext | GraphQLContextAuth>,
  parent: unknown,
  args: unknown,
  context: GraphQLContext | GraphQLContextAuth,
  info: GraphQLResolveInfo,
) => {
  const { walletId } = (args as InputArgs).input || args || {}
  if (!walletId) return new Error("Invalid wallet")
  if (walletId instanceof Error) return walletId

  if (!context.domainAccount) {
    return new Error("Invalid Account")
  }

  const hasPermissions = await Accounts.hasPermissions(
    context.domainAccount.id,
    walletId as WalletId,
  )
  if (hasPermissions instanceof Error) return mapError(hasPermissions)
  if (!hasPermissions) return new Error("Invalid wallet")

  return resolve(parent, args, context, info)
}

const validateWalletIdQuery = async (
  resolve: GraphQLFieldResolver<unknown, GraphQLContext | GraphQLContextAuth>,
  parent: unknown,
  args: unknown,
  context: GraphQLContext | GraphQLContextAuth,
  info: GraphQLResolveInfo,
) => {
  const result = await validateWalletId(resolve, parent, args, context, info)
  if (result instanceof Error) throw result
  return result
}

const validateWalletIdMutation = async (
  resolve: GraphQLFieldResolver<unknown, GraphQLContext | GraphQLContextAuth>,
  parent: unknown,
  args: unknown,
  context: GraphQLContext | GraphQLContextAuth,
  info: GraphQLResolveInfo,
) => {
  const result = await validateWalletId(resolve, parent, args, context, info)
  if (result instanceof Error) return { errors: [{ message: result.message }] }
  return result
}

// Placed here because 'GraphQLFieldResolver' not working from .d.ts file
type ValidateWalletIdFn = (
  resolve: GraphQLFieldResolver<unknown, GraphQLContext | GraphQLContextAuth>,
  parent: unknown,
  args: unknown,
  context: GraphQLContext | GraphQLContextAuth,
  info: GraphQLResolveInfo,
) => Promise<unknown>

const walletIdQueryFields: { [key: string]: ValidateWalletIdFn } = {}
for (const key of Object.keys(queryFields.authed.withWalletId)) {
  walletIdQueryFields[key] = validateWalletIdQuery
}

const walletIdMutationFields: { [key: string]: ValidateWalletIdFn } = {}
for (const key of Object.keys(mutationFields.authed.withWalletId)) {
  walletIdMutationFields[key] = validateWalletIdMutation
}

export const walletIdMiddleware = {
  Query: walletIdQueryFields,
  Mutation: walletIdMutationFields,
}
