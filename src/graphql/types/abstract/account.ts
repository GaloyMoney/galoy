import { GT } from "@graphql/index"
import { connectionArgs } from "graphql-relay"

import { TransactionConnection } from "../object/transaction"
import AccountCustomFields from "../object/account-custom-fields"

import WalletId from "../scalar/wallet-id"

import Wallet from "./wallet"

const IAccount = GT.Interface({
  name: "Account",
  fields: () => ({
    id: {
      type: GT.NonNullID,
    },
    wallets: {
      type: GT.NonNullList(Wallet),
    },
    defaultWalletId: {
      type: GT.NonNull(WalletId),
    },
    csvTransactions: {
      type: GT.NonNull(GT.String),
      args: {
        walletIds: {
          type: GT.NonNullList(WalletId),
        },
      },
    },
    transactions: {
      type: TransactionConnection,
      args: {
        ...connectionArgs,
        walletIds: {
          type: GT.List(WalletId),
        },
      },
    },

    data: {
      type: AccountCustomFields,
    },

    // FUTURE-PLAN: Support a `users: [User!]!` field here
  }),
})

export default IAccount
