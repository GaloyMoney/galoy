import { AccountStatus } from "@domain/accounts/primitives"
import { DisplayCurrency } from "@domain/fiat"

const displayCurrencyConfigSchema = {
  type: "object",
  properties: {
    code: { type: "string", default: "USD", enum: Object.values(DisplayCurrency) },
    symbol: { type: "string", default: "$" },
  },
  required: ["code", "symbol"],
  additionalProperties: false,
} as const

const dealerConfigSchema = {
  type: "object",
  properties: {
    usd: {
      type: "object",
      properties: {
        hedgingEnabled: { type: "boolean", default: false },
      },
      required: ["hedgingEnabled"],
    },
  },
  required: ["usd"],
} as const

const buildNumberConfigSchema = {
  type: "object",
  properties: {
    minBuildNumber: { type: "integer" },
    lastBuildNumber: { type: "integer" },
  },
  required: ["minBuildNumber", "lastBuildNumber"],
  additionalProperties: false,
}

const rewardsConfigSchema = {
  type: "object",
  properties: {
    allowPhoneCountries: {
      type: "array",
      items: { type: "string" },
      uniqueItems: true,
    },
    denyPhoneCountries: {
      type: "array",
      items: { type: "string" },
      uniqueItems: true,
    },
    allowIPCountries: {
      type: "array",
      items: { type: "string" },
      uniqueItems: true,
    },
    denyIPCountries: {
      type: "array",
      items: { type: "string" },
      uniqueItems: true,
    },
    allowASNs: {
      type: "array",
      items: { type: "string" },
      uniqueItems: true,
    },
    denyASNs: {
      type: "array",
      items: { type: "string" },
      uniqueItems: true,
    },
  },
  required: [
    "allowPhoneCountries",
    "denyPhoneCountries",
    "allowIPCountries",
    "denyIPCountries",
    "allowASNs",
    "denyASNs",
  ],
  additionalProperties: false,
}

const accountLimitConfigSchema = {
  type: "object",
  properties: {
    level: {
      type: "object",
      properties: {
        1: { type: "integer" },
        2: { type: "integer" },
      },
      required: ["1", "2"],
      additionalProperties: false,
    },
  },
  required: ["level"],
  additionalProperties: false,
}

const rateLimitConfigSchema = {
  type: "object",
  properties: {
    points: { type: "integer" },
    duration: { type: "integer" },
    blockDuration: { type: "integer" },
  },
  required: ["points", "duration", "blockDuration"],
  additionalProperties: false,
}

const lndConfig = {
  type: "object",
  properties: {
    name: { type: "string" },
    type: {
      type: "array",
      items: { enum: ["offchain", "onchain"] },
      uniqueItems: true,
    },
    priority: { type: "integer" },
  },
  required: ["name", "type", "priority"],
  additionalProperties: false,
}

export const configSchema = {
  type: "object",
  properties: {
    PROXY_CHECK_APIKEY: { type: "string" }, // TODO: move out of yaml and to env
    name: { type: "string" },
    lightningAddressDomain: { type: "string" },
    lightningAddressDomainAliases: {
      type: "array",
      items: { type: "string" },
      uniqueItems: true,
    },
    locale: { type: "string", enum: ["en", "es"], default: "en" },
    displayCurrency: displayCurrencyConfigSchema,
    funder: { type: "string" },
    dealer: dealerConfigSchema,
    ratioPrecision: { type: "number" },
    buildVersion: {
      type: "object",
      properties: {
        android: buildNumberConfigSchema,
        ios: buildNumberConfigSchema,
      },
      required: ["ios", "android"],
    },
    rewards: rewardsConfigSchema,
    coldStorage: {
      type: "object",
      properties: {
        minOnChainHotWalletBalance: { type: "integer" },
        minRebalanceSize: { type: "integer" },
        maxHotWalletBalance: { type: "integer" },
        walletPattern: { type: "string" },
        // TODO: confusing: 2 properties with the same name
        onChainWallet: { type: "string" },
        targetConfirmations: { type: "integer" },
      },
      required: [
        "minOnChainHotWalletBalance",
        "minRebalanceSize",
        "maxHotWalletBalance",
        "walletPattern",
        "targetConfirmations",
      ],
      additionalProperties: false,
    },
    lndScbBackupBucketName: { type: "string" },
    test_accounts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          ref: { type: "string" },
          phone: { type: "string" },
          code: { type: "string" },
          needUsdWallet: { type: "boolean" },
          username: { type: "string" },
          phoneMetadataCarrierType: { type: "string" },
          title: { type: "string" },
          role: { type: "string" },
          currency: { type: "string" },
        },
        required: ["ref", "phone", "code"],
        additionalProperties: false,
      },
      uniqueItems: true,
    },
    rateLimits: {
      type: "object",
      properties: {
        requestPhoneCodePerPhone: rateLimitConfigSchema,
        requestPhoneCodePerPhoneMinInterval: rateLimitConfigSchema,
        requestPhoneCodePerIp: rateLimitConfigSchema,
        failedLoginAttemptPerPhone: rateLimitConfigSchema,
        failedLoginAttemptPerEmailAddress: rateLimitConfigSchema,
        failedLoginAttemptPerIp: rateLimitConfigSchema,
        invoiceCreateAttempt: rateLimitConfigSchema,
        invoiceCreateForRecipientAttempt: rateLimitConfigSchema,
        onChainAddressCreateAttempt: rateLimitConfigSchema,
      },
      required: [
        "requestPhoneCodePerPhone",
        "requestPhoneCodePerPhoneMinInterval",
        "requestPhoneCodePerIp",
        "failedLoginAttemptPerPhone",
        "failedLoginAttemptPerEmailAddress",
        "failedLoginAttemptPerIp",
        "invoiceCreateAttempt",
        "invoiceCreateForRecipientAttempt",
        "onChainAddressCreateAttempt",
      ],
      additionalProperties: false,
    },
    accounts: {
      type: "object",
      properties: {
        initialStatus: { type: "string", enum: Object.values(AccountStatus) },
        customFields: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              type: {
                type: "string",
                enum: ["string", "integer", "float", "boolean"],
              },
              required: { type: "boolean", default: false },
              editable: { type: "boolean", default: false },
              index: { type: "boolean", default: false },
            },
            required: ["name", "type"],
            additionalProperties: false,
          },
          uniqueItems: true,
        },
      },
      required: ["initialStatus"],
      additionalProperties: false,
    },
    accountLimits: {
      type: "object",
      properties: {
        withdrawal: accountLimitConfigSchema,
        intraLedger: accountLimitConfigSchema,
      },
      required: ["withdrawal", "intraLedger"],
      additionalProperties: false,
    },
    spamLimits: {
      type: "object",
      properties: {
        memoSharingSatsThreshold: { type: "integer" },
      },
      required: ["memoSharingSatsThreshold"],
      additionalProperties: false,
    },
    twoFALimits: {
      type: "object",
      properties: {
        threshold: { type: "integer" },
      },
      required: ["threshold"],
      additionalProperties: false,
    },
    ipRecording: {
      type: "object",
      properties: {
        enabled: { type: "boolean" },
        proxyChecking: {
          type: "object",
          properties: {
            enabled: { type: "boolean" },
          },
          required: ["enabled"],
          additionalProperties: false,
        },
      },
      required: ["enabled"],
      additionalProperties: false,
    },
    fees: {
      type: "object",
      properties: {
        deposit: { type: "number" },
        withdraw: {
          type: "object",
          properties: {
            method: {
              type: "string",
              enum: ["flat", "proportionalOnImbalance"],
            },
            ratio: { type: "number" },
            threshold: { type: "integer" },
            daysLookback: { type: "integer" },
            defaultMin: { type: "integer" },
          },
          required: ["method", "ratio", "threshold", "daysLookback", "defaultMin"],
          additionalProperties: false,
        },
      },
      required: ["withdraw", "deposit"],
      additionalProperties: false,
    },
    lnds: {
      type: "array",
      items: lndConfig,
      uniqueItems: true,
    },
    onChainWallet: {
      type: "object",
      properties: {
        dustThreshold: { type: "integer" },
        minConfirmations: { type: "integer" },
        scanDepth: { type: "integer" }, // TODO: improve naming
        scanDepthOutgoing: { type: "integer" },
        scanDepthChannelUpdate: { type: "integer" },
      },
      required: [
        "dustThreshold",
        "minConfirmations",
        "scanDepth",
        "scanDepthOutgoing",
        "scanDepthChannelUpdate",
      ],
      additionalProperties: false,
    },
    apollo: {
      type: "object",
      properties: {
        playground: { type: "boolean" },
        playgroundUrl: { type: "string" },
      },
      required: ["playground"],
      if: {
        properties: { playground: { const: true } },
      },
      then: { required: ["playgroundUrl"] },
      additionalProperties: false,
    },
    userActivenessMonthlyVolumeThreshold: { type: "integer" },
    cronConfig: {
      type: "object",
      properties: {
        rebalanceEnabled: { type: "boolean" },
      },
      required: ["rebalanceEnabled"],
      additionalProperties: false,
    },
    kratosConfig: {
      type: "object",
      properties: {
        serverURL: { type: "string" },
        corsAllowedOrigins: {
          type: "array",
          items: { type: "string" },
          uniqueItems: true,
        },
      },
      required: ["serverURL", "corsAllowedOrigins"],
      additionalProperties: false,
    },
    captcha: {
      type: "object",
      properties: {
        mandatory: { type: "boolean" },
      },
      required: ["mandatory"],
      additionalProperties: false,
    },
    skipFeeProbe: {
      type: "array",
      items: { type: "string", maxLength: 66, minLength: 66 },
      uniqueItems: true,
    },
  },
  required: [
    "name",
    "buildVersion",
    "coldStorage",
    "lndScbBackupBucketName",
    "rateLimits",
    "accountLimits",
    "spamLimits",
    "twoFALimits",
    "ipRecording",
    "fees",
    "lnds",
    "onChainWallet",
    "userActivenessMonthlyVolumeThreshold",
    "cronConfig",
    "kratosConfig",
    "captcha",
  ],
  additionalProperties: false,
} as const
