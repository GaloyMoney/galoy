// The paginatedLedger function is a copy of medici's MainBook.ledger function
// but without the page/perPage logic and with new args first/last
// that paginate the database response based on the transaction _id field

// This should be used for any list of transactions that's exposed in the API

import { Types } from "mongoose"

import { parseFilterQuery } from "medici/build/helper/parse/parseFilterQuery"

import { Transaction } from "@services/ledger/schema"

import { MainBook } from "./books"

export const DEFAULT_MAX_CONNECTION_LIMIT = 100

type IFilterQuery = {
  account?: string | string[]
  _journal?: Types.ObjectId | string
  start_date?: Date | string | number
  end_date?: Date | string | number
} & Partial<ILedgerTransaction>

export const paginatedLedger = async ({
  query,
  paginationArgs,
}: {
  query: IFilterQuery
  paginationArgs?: PaginationArgs
}): Promise<PaginatedArray<ILedgerTransaction>> => {
  const filterQuery = parseFilterQuery(query, MainBook)

  if (paginationArgs?.after) {
    filterQuery["_id"] = { $lt: new Types.ObjectId(paginationArgs.after) }
  }

  if (paginationArgs?.before) {
    filterQuery["_id"] = { $gt: new Types.ObjectId(paginationArgs.before) }
  }

  const findPromise = Transaction.collection
    .find<ILedgerTransaction>(filterQuery, {
      limit: DEFAULT_MAX_CONNECTION_LIMIT,
      sort: {
        datetime: -1,
        timestamp: -1,
      },
    })
    .toArray()

  const countPromise = Transaction.countDocuments(filterQuery)

  return {
    slice: await findPromise,
    total: await countPromise,
  }
}
