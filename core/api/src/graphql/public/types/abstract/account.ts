import AccountLevel from "../../../shared/types/scalar/account-level"

import Wallet from "../../../shared/types/abstract/wallet"

import CallbackEndpoint from "../object/callback-endpoint"

import { NotificationSettings } from "../object/notification-settings"

import { GT } from "@/graphql/index"
import { connectionArgs } from "@/graphql/connections"

import WalletId from "@/graphql/shared/types/scalar/wallet-id"
import AccountLimits from "@/graphql/public/types/object/account-limits"
import RealtimePrice from "@/graphql/public/types/object/realtime-price"
import PublicWallet from "@/graphql/public/types/object/public-wallet"
import DisplayCurrency from "@/graphql/shared/types/scalar/display-currency"
import Transaction, {
  TransactionConnection,
} from "@/graphql/shared/types/object/transaction"
import { IInvoiceConnection } from "@/graphql/shared/types/abstract/invoice"
import Username from "@/graphql/shared/types/scalar/username"
import AccountContact from "../object/account-contact"

const IAccount = GT.Interface({
  name: "Account",
  fields: () => ({
    id: {
      type: GT.NonNullID,
    },
    callbackEndpoints: {
      type: GT.NonNullList(CallbackEndpoint),
    },
    wallets: {
      type: GT.NonNullList(Wallet),
    },
    defaultWalletId: {
      type: GT.NonNull(WalletId),
      deprecationReason: "Shifting property to 'defaultWallet.id'",
    },
    defaultWallet: {
      type: GT.NonNull(PublicWallet),
    },
    displayCurrency: {
      type: GT.NonNull(DisplayCurrency),
    },
    level: {
      type: GT.NonNull(AccountLevel),
    },
    realtimePrice: {
      type: GT.NonNull(RealtimePrice),
    },
    csvTransactions: {
      type: GT.NonNull(GT.String),
      args: {
        walletIds: {
          type: GT.NonNullList(WalletId),
        },
      },
    },
    limits: {
      type: GT.NonNull(AccountLimits),
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
    pendingIncomingTransactions: {
      type: GT.NonNullList(Transaction),
      args: {
        walletIds: {
          type: GT.List(WalletId),
        },
      },
    },
    invoices: {
      type: IInvoiceConnection,
      args: {
        ...connectionArgs,
        walletIds: {
          type: GT.List(WalletId),
        },
      },
    },
    notificationSettings: {
      type: GT.NonNull(NotificationSettings),
    },
    walletById: {
      type: GT.NonNull(Wallet),
      args: {
        walletId: {
          type: GT.NonNull(WalletId),
        },
      },
    },
    username: {
      type: Username,
    },
    contacts: {
      type: GT.NonNullList(AccountContact),
    },
    contactByUsername: {
      type: GT.NonNull(AccountContact),
      args: {
        username: { type: GT.NonNull(Username) },
      },
    },
    
    // FUTURE-PLAN: Support a `users: [User!]!` field here
  }),
})

export default IAccount
