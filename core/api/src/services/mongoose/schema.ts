import crypto from "crypto"

import mongoose from "mongoose"

import { getDefaultAccountsConfig, Levels } from "@/config"
import { AccountIdRegex, AccountStatus, UsernameRegex } from "@/domain/accounts"
import { WalletIdRegex, WalletType } from "@/domain/wallets"
import { WalletCurrency } from "@/domain/shared"

import { Languages } from "@/domain/users"

import { CarrierType } from "@/domain/phone-provider"
import { checkedToLedgerExternalId } from "@/domain/ledger"

// TODO migration:
// rename InvoiceUser collection to walletInvoice

// mongoose.set("debug", true)

const Schema = mongoose.Schema

const dbMetadataSchema = new Schema<DbMetadataRecord>({
  routingFeeLastEntry: Date, // TODO: rename to routingRevenueLastEntry
})
export const DbMetadata = mongoose.model("DbMetadata", dbMetadataSchema)

const walletInvoiceSchema = new Schema<WalletInvoiceRecord>({
  _id: { type: String }, // hash of invoice
  walletId: {
    required: true,
    type: String,
    validate: {
      validator: function (v: string) {
        return v.match(WalletIdRegex)
      },
    },
  },

  accountId: {
    required: true,
    type: String,
    validate: {
      validator: function (v: string) {
        return v.match(AccountIdRegex)
      },
    },
  },

  // Usd quote. sats is attached in the invoice directly.
  // this is the option price given by the dealer
  // is optional, BTC wallet or invoice on USD with no amount doesn't have cents
  cents: {
    type: Number,
    validate: {
      validator: Number.isInteger,
      message: "{VALUE} is not an integer value",
    },
  },

  secret: {
    required: true,
    type: String,
    length: 64,
  },

  currency: {
    required: true,
    type: String,
    enum: Object.values(WalletCurrency),
  },

  timestamp: {
    type: Date,
    default: Date.now,
  },

  selfGenerated: {
    type: Boolean,
    default: true,
  },

  pubkey: {
    type: String,
    required: true,
  },

  paid: {
    type: Boolean,
    default: false,
  },

  processingCompleted: {
    type: Boolean,
    default: false,
  },

  paymentRequest: {
    type: String,
  },

  externalId: {
    required: true,
    type: String,
    validator: (v: string) => !(checkedToLedgerExternalId(v) instanceof Error),
  },
})

walletInvoiceSchema.index({ walletId: 1, paid: 1 })
walletInvoiceSchema.index({ paid: 1, processingCompleted: 1 })
walletInvoiceSchema.index({ accountId: 1, externalId: 1 }, { unique: true })

export const WalletInvoice = mongoose.model<WalletInvoiceRecord>(
  "InvoiceUser",
  walletInvoiceSchema,
)

const WalletSchema = new Schema<WalletRecord>({
  id: {
    type: String,
    index: true,
    unique: true,
    required: true,
    default: () => crypto.randomUUID(),
  },
  accountId: {
    type: String,
    ref: "Account",
    index: true,
    required: true,
  },
  type: {
    type: String,
    enum: Object.values(WalletType),
    required: true,
    default: WalletType.Checking,
  },
  currency: {
    type: String,
    enum: Object.values(WalletCurrency),
    required: true,
    default: WalletCurrency.Btc,
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  onchain: {
    type: [
      {
        pubkey: String,
        address: {
          type: String,
          // TODO: index?
          required: true,
        },
      },
    ],
    default: [],
  },
})

export const Wallet = mongoose.model<WalletRecord>("Wallet", WalletSchema)

const AccountSchema = new Schema<AccountRecord>(
  {
    id: {
      type: String,
      index: true,
      unique: true,
      sparse: true,
      required: true,
      default: () => crypto.randomUUID(),
    },
    withdrawFee: {
      type: Number,
      min: 0,
      required: false,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
    role: {
      type: String,
      // FIXME: role is a mix between 2 things here
      // there can be many users
      // there can be only one dealer, bankowner and funder
      // so we may want different property to differentiate those
      enum: ["user", "dealer", "bankowner", "funder"],
      required: true,
      default: "user",
      // TODO : enforce the fact there can be only one dealer/bankowner/funder
    },

    level: {
      type: Number,
      enum: Levels,
    },

    kratosUserId: {
      type: String,
      index: true,
      unique: true,
      sparse: true,
    },

    username: {
      type: String,
      match: [UsernameRegex, "Username can only have alphabets, numbers and underscores"],
      minlength: 3,
      maxlength: 50,
      index: {
        unique: true,
        collation: { locale: "en", strength: 2 },
        partialFilterExpression: { username: { $type: "string" } },
      },
    },
    contactEnabled: {
      type: Boolean,
      default: true,
    },
    contacts: {
      type: [
        {
          id: {
            type: String,
            collation: { locale: "en", strength: 2 },
          },
          name: {
            type: String,
            // TODO: add constraint here
          },
          transactionsCount: {
            type: Number,
            default: 1,
          },
        },
      ],
      default: [],
    },

    statusHistory: {
      type: [
        {
          status: {
            type: String,
            required: true,
            enum: Object.values(AccountStatus),
          },
          updatedAt: {
            type: Date,
            default: Date.now,
            required: true,
          },

          // TODO: rename to updatedByPrivilegedClientId
          updatedByUserId: {
            type: String,
            required: false,
          },
          updatedByPrivilegedClientId: {
            type: String,
            required: false,
          },
          comment: {
            type: String,
            required: false,
          },
        },
      ],
      default: [
        {
          status: getDefaultAccountsConfig().initialStatus,
          comment: "to be overridden by createAccount",
        },
      ],
    },

    defaultWalletId: {
      type: String,
      index: true,
    },

    displayCurrency: String, // FIXME: should be an enum
  },
  { id: false },
)

AccountSchema.index({
  title: 1,
  coordinates: 1,
})

export const Account = mongoose.model<AccountRecord>("Account", AccountSchema)

const QuizSchema = new Schema<QuizCompletedRecord>({
  accountId: {
    type: String,
    ref: "Account",
    required: true,
  },
  quizId: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
})

QuizSchema.index({ accountId: 1, quizId: 1 }, { unique: true })

export const Quiz = mongoose.model<QuizCompletedRecord>("Quiz", QuizSchema)

const SupportChatSchema = new Schema<SupportChatRecord>({
  accountId: {
    type: String,
    ref: "Account",
    required: true,
  },
  supportChatId: {
    type: String,
    required: true,
    unique: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
})

export const SupportChat = mongoose.model<SupportChatRecord>(
  "SupportChat",
  SupportChatSchema,
)

const pointSchema = new Schema<LocationRecord>({
  type: {
    type: String,
    enum: ["Point"],
    required: true,
  },
  coordinates: {
    type: [Number],
    required: true,
  },
})

const MerchantSchema = new Schema<MerchantRecord>({
  id: {
    type: String,
    index: true,
    unique: true,
    sparse: true,
    required: true,
    default: () => crypto.randomUUID(),
  },
  username: {
    type: String,
    required: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
  },
  location: {
    type: pointSchema,
    index: "2dsphere",
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  validated: {
    type: Boolean,
    default: false,
    index: true,
  },
})

export const Merchant = mongoose.model<MerchantRecord>("Merchant", MerchantSchema)

const AccountIpsSchema = new Schema<AccountIpsRecord>({
  ip: {
    type: String,
    required: true,
  },
  metadata: {
    type: {
      provider: String,
      country: String,
      isoCode: String,
      region: String,
      city: String,
      //using Type instead of type due to its special status in mongoose
      Type: String,
      asn: String,
      proxy: Boolean,
    },
  },
  firstConnection: {
    type: Date,
    default: Date.now,
  },
  lastConnection: Date,
  accountId: {
    type: String,
    ref: "Account",
    index: true,
    required: true,
  },
})

export const AccountIps = mongoose.model<AccountIpsRecord>("AccountIp", AccountIpsSchema)

AccountIpsSchema.index({
  accountId: 1,
  ip: 1,
})

const UserSchema = new Schema(
  {
    createdAt: {
      type: Date,
      default: Date.now,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    language: {
      type: String,
      enum: [...Languages, ""],
      default: "",
    },
    deviceTokens: {
      type: [String],
      default: [],
    },
    phoneMetadata: {
      type: {
        carrier: {
          error_code: String, // TODO: check as historical value may have number
          mobile_country_code: String,
          mobile_network_code: String,
          name: String,
          type: {
            types: String,
            enum: Object.values(CarrierType),
          },
        },
        countryCode: {
          type: String,
          index: true,
        },
      },
      default: undefined,
    },
    phone: {
      type: String,
      index: true,
      unique: true,
      sparse: true,
    },
    deletedPhones: {
      type: [String],
    },
    deviceId: {
      type: String,
    },
    deletedEmail: {
      type: [String],
    },
  },
  { id: false },
)

UserSchema.index({
  "userId": 1,
  "phoneMetadata.countryCode": 1,
})

export const User = mongoose.model<UserRecord>("User", UserSchema)

const paymentFlowStateSchema = new Schema<PaymentFlowStateRecord>(
  {
    senderWalletId: { type: String, required: true },
    senderWalletCurrency: { type: String, required: true },
    senderAccountId: { type: String, required: true },
    settlementMethod: { type: String, required: true },
    paymentInitiationMethod: { type: String, required: true },
    paymentHash: String,
    intraLedgerHash: String,
    createdAt: { type: Date, required: true },
    paymentSentAndPending: { type: Boolean, required: true },
    descriptionFromInvoice: String,

    btcPaymentAmount: { type: Number, required: true },
    usdPaymentAmount: { type: Number, required: true },
    inputAmount: { type: Number, required: true },

    btcProtocolAndBankFee: { type: Number, required: true },
    usdProtocolAndBankFee: { type: Number, required: true },

    recipientWalletId: String,
    recipientWalletCurrency: String,
    recipientAccountId: String,
    recipientPubkey: String,
    recipientUsername: String,
    recipientUserId: String,

    outgoingNodePubkey: String,
    cachedRoute: Schema.Types.Mixed,
  },
  { id: false },
)

paymentFlowStateSchema.index({
  paymentHash: 1,
})

export const PaymentFlowState = mongoose.model(
  "Payment_Flow_State",
  paymentFlowStateSchema,
)

const WalletOnChainPendingReceiveSchema = new Schema<WalletOnChainPendingReceiveRecord>(
  {
    walletId: { type: String, required: true },
    address: { type: String, required: true },
    transactionHash: { type: String, required: true },
    vout: { type: Number, required: true },
    walletAmount: { type: Number, required: true },
    walletFee: { type: Number, required: true },
    walletCurrency: { type: String, required: true },

    displayAmount: { type: String, required: true },
    displayFee: { type: String, required: true },
    displayPriceBase: { type: String, required: true },
    displayPriceOffset: { type: String, required: true },
    displayPriceCurrency: { type: String, required: true },

    createdAt: { type: Date, default: Date.now },
  },
  { id: false },
)

WalletOnChainPendingReceiveSchema.index({ walletId: 1, createdAt: -1 })
WalletOnChainPendingReceiveSchema.index({ transactionHash: 1, vout: 1 }, { unique: true })

export const WalletOnChainPendingReceive =
  mongoose.model<WalletOnChainPendingReceiveRecord>(
    "WalletOnChainPendingReceive",
    WalletOnChainPendingReceiveSchema,
  )
