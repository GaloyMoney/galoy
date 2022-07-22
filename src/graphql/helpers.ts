import { GraphQLFieldConfig, GraphQLScalarType, ThunkObjMap } from "graphql"

import { WalletCurrency } from "@domain/shared"
import { WalletsRepository } from "@services/mongoose"

import { mapError } from "./error-map"

import { GT } from "./index"

export const validateIsBtcWalletForMutation = async (
  walletId: WalletId,
): Promise<true | { errors: [{ message: string }] }> => {
  const wallet = await WalletsRepository().findById(walletId)
  if (wallet instanceof Error) return { errors: [{ message: mapError(wallet).message }] }

  const MutationDoesNotMatchWalletCurrencyError =
    "MutationDoesNotMatchWalletCurrencyError"
  if (wallet.currency === WalletCurrency.Usd) {
    return { errors: [{ message: MutationDoesNotMatchWalletCurrencyError }] }
  }
  return true
}

export const validateIsUsdWalletForMutation = async (
  walletId: WalletId,
): Promise<true | { errors: [{ message: string }] }> => {
  const wallet = await WalletsRepository().findById(walletId)
  if (wallet instanceof Error) return { errors: [{ message: mapError(wallet).message }] }

  const MutationDoesNotMatchWalletCurrencyError =
    "MutationDoesNotMatchWalletCurrencyError"
  if (wallet.currency === WalletCurrency.Btc) {
    return { errors: [{ message: MutationDoesNotMatchWalletCurrencyError }] }
  }
  return true
}

export const parseDynamicFieldSchema = <TSource, TContext>(
  fields: DynamicField[],
): ThunkObjMap<GraphQLFieldConfig<TSource, TContext>> => {
  const result: ThunkObjMap<GraphQLFieldConfig<TSource, TContext>> = {}
  for (const field of fields) {
    if (result[field.name]) continue
    const type = getGT(field.type)
    result[field.name] = {
      type: field.required ? GT.NonNull(type) : type,
    }
  }
  return result
}

const getGT = (type?: string): GraphQLScalarType => {
  switch (type) {
    case "integer":
      return GT.Int
    case "float":
      return GT.Float
    case "boolean":
      return GT.Boolean
    default:
      return GT.String
  }
}
