import IAccount from "../abstract/account"
import Wallet from "../../../shared/types/abstract/wallet"

import WalletId from "../../../shared/types/scalar/wallet-id"
import DisplayCurrency from "../../../shared/types/scalar/display-currency"

import AccountLevel from "../../../shared/types/scalar/account-level"

import Transaction, {
  TransactionConnection,
} from "../../../shared/types/object/transaction"

import RealtimePrice from "./realtime-price"
import { NotificationSettings } from "./notification-settings"

import PublicWallet from "./public-wallet"

import { connectionArgs } from "@/graphql/connections"
import { GT } from "@/graphql/index"
import { mapError } from "@/graphql/error-map"
import {
  majorToMinorUnit,
  SAT_PRICE_PRECISION_OFFSET,
  USD_PRICE_PRECISION_OFFSET,
} from "@/domain/fiat"
import { Accounts, Prices, Wallets } from "@/app"
import { IInvoiceConnection } from "@/graphql/shared/types/abstract/invoice"
import Username from "@/graphql/shared/types/scalar/username"
import AccountContact from "./account-contact"
import dedent from "dedent"
import { UnknownClientError } from "@/graphql/error"
import { baseLogger } from "@/services/logger"

const BusinessAccount = GT.Object({
  name: "BusinessAccount",
  interfaces: () => [IAccount],
  isTypeOf: () => false,
  fields: () => ({
    id: {
      type: GT.NonNullID,
      resolve: (source) => source.id,
    },

    wallets: {
      type: GT.NonNullList(Wallet),
      resolve: async (source: Account) => {
        return Wallets.listWalletsByAccountId(source.id)
      },
    },

    defaultWalletId: {
      type: GT.NonNull(WalletId),
      resolve: (source, args, { domainAccount }: { domainAccount: Account }) =>
        domainAccount.defaultWalletId,
    },

    defaultWallet: {
      type: GT.NonNull(PublicWallet),
      resolve: async (source) => {
        const wallet = await Wallets.getWalletForAccountById({
          accountId: source.id,
          walletId: source.defaultWalletId,
        })
        if (wallet instanceof Error) {
          throw mapError(wallet)
        }
        return wallet
      },
    },

    level: {
      type: GT.NonNull(AccountLevel),
      resolve: (source) => source.level,
    },

    displayCurrency: {
      type: GT.NonNull(DisplayCurrency),
      resolve: (source, args, { domainAccount }: { domainAccount: Account }) =>
        domainAccount.displayCurrency,
    },

    realtimePrice: {
      type: GT.NonNull(RealtimePrice),
      resolve: async (source) => {
        const currency = source.displayCurrency
        const btcPrice = await Prices.getCurrentSatPrice({ currency })
        if (btcPrice instanceof Error) throw mapError(btcPrice)

        const usdPrice = await Prices.getCurrentUsdCentPrice({ currency })
        if (usdPrice instanceof Error) throw mapError(usdPrice)

        const minorUnitPerSat = majorToMinorUnit({
          amount: btcPrice.price,
          displayCurrency: currency,
        })
        const minorUnitPerUsdCent = majorToMinorUnit({
          amount: usdPrice.price,
          displayCurrency: currency,
        })

        return {
          timestamp: btcPrice.timestamp,
          denominatorCurrency: currency,
          btcSatPrice: {
            base: Math.round(minorUnitPerSat * 10 ** SAT_PRICE_PRECISION_OFFSET),
            offset: SAT_PRICE_PRECISION_OFFSET,
            currencyUnit: "MINOR",
          },
          usdCentPrice: {
            base: Math.round(minorUnitPerUsdCent * 10 ** USD_PRICE_PRECISION_OFFSET),
            offset: USD_PRICE_PRECISION_OFFSET,
            currencyUnit: "MINOR",
          },
        }
      },
    },

    csvTransactions: {
      description:
        "return CSV stream, base64 encoded, of the list of transactions in the wallet",
      type: GT.NonNull(GT.String),
      args: {
        walletIds: {
          type: GT.NonNullList(WalletId),
        },
      },
      resolve: async (source) => {
        return Accounts.getCSVForAccount(source.id)
      },
    },
    transactions: {
      description:
        "A list of all transactions associated with walletIds optionally passed.",
      type: TransactionConnection,
      args: {
        ...connectionArgs,
        walletIds: {
          type: GT.List(WalletId),
        },
      },
      resolve: async (source, args) => {
        const { walletIds, ...rawPaginationArgs } = args

        const result = await Accounts.getTransactionsForAccountByWalletIds({
          account: source,
          walletIds,
          rawPaginationArgs,
        })

        if (result instanceof Error) {
          throw mapError(result)
        }

        return result
      },
    },
    pendingIncomingTransactions: {
      type: GT.NonNullList(Transaction),
      args: {
        walletIds: {
          type: GT.List(WalletId),
        },
      },
      resolve: async (source, args) => {
        const { walletIds } = args
        const transactions =
          await Accounts.getPendingIncomingOnChainTransactionsForAccountByWalletIds({
            account: source,
            walletIds,
          })

        if (transactions instanceof Error) {
          throw mapError(transactions)
        }
        return transactions
      },
    },
    invoices: {
      description: "A list of all invoices associated with walletIds optionally passed.",
      type: IInvoiceConnection,
      args: {
        ...connectionArgs,
        walletIds: {
          type: GT.List(WalletId),
        },
      },
      resolve: async (source, args) => {
        const { walletIds, ...rawPaginationArgs } = args
        const result = await Accounts.getInvoicesForAccountByWalletIds({
          account: source,
          walletIds,
          rawPaginationArgs,
        })

        if (result instanceof Error) {
          throw mapError(result)
        }

        return result
      },
    },

    notificationSettings: {
      type: GT.NonNull(NotificationSettings),
      resolve: async (source) => {
        const result = await Accounts.getNotificationSettingsForAccount({
          account: source,
        })

        if (result instanceof Error) {
          throw mapError(result)
        }

        return result
      },
    },

    username: {
      type: Username,
      resolve: async (source, args, { domainAccount }) => {
        return domainAccount?.username
      },
    },

    contacts: {
      type: GT.NonNullList(AccountContact), // TODO: Make it a Connection Interface
      description: dedent`Get full list of contacts.
        Can include the transactions associated with each contact.`,
      resolve: async (source, args, { domainAccount }) => domainAccount?.contacts,
    },

    contactByUsername: {
      type: GT.NonNull(AccountContact),
      description: dedent`Get single contact details.
        Can include the transactions associated with the contact.`,
      args: {
        username: { type: GT.NonNull(Username) },
      },
      resolve: async (source, args, { domainAccount }) => {
        const { username } = args
        if (!domainAccount) {
          throw new UnknownClientError({
            message: "Something went wrong",
            logger: baseLogger,
          })
        }
        if (username instanceof Error) {
          throw username
        }
        const contact = await Accounts.getContactByUsername({
          account: domainAccount,
          contactUsername: username,
        })
        if (contact instanceof Error) {
          throw mapError(contact)
        }

        return contact
      },
    },
  }),
})

export default BusinessAccount
