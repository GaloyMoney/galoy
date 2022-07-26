import { AccountDataUpdateError } from "@domain/accounts"
import {
  CouldNotFindError,
  RepositoryError,
  UnknownRepositoryError,
} from "@domain/errors"

import { AccountData } from "./schema"
import { toObjectId, fromObjectId } from "./utils"

export const AccountDataRepository = (): IAccountDataRepository => {
  const findById = async (
    accountId: AccountId,
  ): Promise<AccountData | RepositoryError> => {
    try {
      const result = await AccountData.findOne({ _id: toObjectId<AccountId>(accountId) })
      if (!result) return new CouldNotFindError()

      return translateToAccountData(result)
    } catch (err) {
      return new UnknownRepositoryError(err.message || err)
    }
  }

  const listByCustomField = async ({
    key,
    value,
  }: FindByCustomFieldArgs): Promise<AccountData[] | RepositoryError> => {
    try {
      const result = await AccountData.find({ [`customFields.${key}`]: value })
      if (!result || result.length === 0) return new CouldNotFindError()

      return result.map(translateToAccountData)
    } catch (err) {
      return new UnknownRepositoryError(err.message || err)
    }
  }

  const update = async ({
    id,
    transactionsCallback,
    customFields,
  }: AccountData): Promise<AccountData | RepositoryError> => {
    try {
      const result = await AccountData.findOneAndUpdate(
        { _id: toObjectId<AccountId>(id) },
        {
          transactionsCallback,
          customFields,
        },
        {
          new: true,
        },
      )
      if (!result) return new AccountDataUpdateError()

      return translateToAccountData(result)
    } catch (err) {
      return new UnknownRepositoryError(err.message || err)
    }
  }

  return { findById, listByCustomField, update }
}

const translateToAccountData = (result: AccountDataRecord): AccountData => ({
  id: fromObjectId<AccountId>(result._id),
  transactionsCallback: result.transactionsCallback,
  customFields: result.customFields,
})
