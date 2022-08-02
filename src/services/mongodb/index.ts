import mongoose from "mongoose"
import * as Medici from "medici"

import { ConfigError } from "@config"
import { WalletCurrency } from "@domain/shared"
import { LnPayment } from "@services/lnd/schema"
import { lazyLoadLedgerAdmin } from "@services/ledger"
import { WalletsRepository } from "@services/mongoose"
import { fromObjectId } from "@services/mongoose/utils"
import { TransactionMetadata } from "@services/ledger/schema"
import { PaymentFlowState } from "@services/payment-flow/schema"

import { baseLogger } from "../logger"
import {
  AccountCustomFields,
  DbMetadata,
  PhoneCode,
  User,
  Wallet,
  WalletInvoice,
} from "../mongoose/schema"

export const ledgerAdmin = lazyLoadLedgerAdmin({
  bankOwnerWalletResolver: async () => {
    const result = await User.findOne({ role: "bankowner" }, { defaultWalletId: 1 })
    if (!result) throw new ConfigError("missing bankowner")
    return result.defaultWalletId
  },
  dealerBtcWalletResolver: async () => {
    const user: UserRecord | null = await User.findOne({ role: "dealer" }, { id: 1 })
    if (!user) throw new ConfigError("missing dealer")
    // FIXME remove the use of UserRecord when role if part of the AccountRepository
    const accountId = fromObjectId<AccountId>(user._id)
    const wallets = await WalletsRepository().listByAccountId(accountId)
    if (wallets instanceof Error) {
      baseLogger.error({ err: wallets }, "Error while listing wallets for dealer")
      throw new ConfigError("Couldn't load dealer wallets")
    }
    const wallet = wallets.find((wallet) => wallet.currency === WalletCurrency.Btc)
    if (wallet === undefined) throw new ConfigError("missing dealer btc wallet")
    return wallet.id
  },
  dealerUsdWalletResolver: async () => {
    const user: UserRecord | null = await User.findOne({ role: "dealer" }, { id: 1 })
    if (!user) throw new ConfigError("missing dealer")
    // FIXME remove the use of UserRecord when role if part of the AccountRepository
    const accountId = fromObjectId<AccountId>(user._id)
    const wallets = await WalletsRepository().listByAccountId(accountId)
    if (wallets instanceof Error) {
      baseLogger.error({ err: wallets }, "Error while listing wallets for dealer")
      throw new ConfigError("Couldn't load dealer wallets")
    }
    const wallet = wallets.find((wallet) => wallet.currency === WalletCurrency.Usd)
    if (wallet === undefined) throw new ConfigError("missing dealer usd wallet")
    return wallet.id
  },
  funderWalletResolver: async () => {
    const result = await User.findOne({ role: "funder" }, { defaultWalletId: 1 })
    if (!result) throw new ConfigError("missing funder")
    return result.defaultWalletId
  },
})

// TODO add an event listenever if we got disconnecter from MongoDb
// after a first successful connection

const user = process.env.MONGODB_USER ?? "testGaloy"
const password = process.env.MONGODB_PASSWORD
const address = process.env.MONGODB_ADDRESS ?? "mongodb"
const db = process.env.MONGODB_DATABASE ?? "galoy"

const path = `mongodb://${user}:${password}@${address}/${db}`

export const setupMongoConnection = async (syncIndexes = false) => {
  try {
    await mongoose.connect(path, { autoIndex: false })
  } catch (err) {
    baseLogger.fatal({ err, user, address, db }, `error connecting to mongodb`)
    throw err
  }

  try {
    mongoose.set("runValidators", true)
    if (syncIndexes) {
      await AccountCustomFields.syncIndexes()
      await DbMetadata.syncIndexes()
      await LnPayment.syncIndexes()
      await Medici.syncIndexes()
      await PaymentFlowState.syncIndexes()
      await PhoneCode.syncIndexes()
      await TransactionMetadata.syncIndexes()
      await User.syncIndexes()
      await Wallet.syncIndexes()
      await WalletInvoice.syncIndexes()
    }
  } catch (err) {
    baseLogger.fatal({ err, user, address, db }, `error setting the indexes`)
    throw err
  }

  return mongoose
}
