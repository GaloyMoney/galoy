import fs from "fs"

import yaml from "js-yaml"
import merge from "lodash.merge"

import { baseLogger } from "@services/logger"
import { checkedToScanDepth } from "@domain/bitcoin/onchain"
import { checkedToTargetConfs, toSats } from "@domain/bitcoin"

import { ConfigError } from "./error"

const defaultContent = fs.readFileSync("./default.yaml", "utf8")
export const defaultConfig = yaml.load(defaultContent)

let customContent, customConfig

try {
  customContent = fs.readFileSync("/var/yaml/custom.yaml", "utf8")
  customConfig = yaml.load(customContent)
} catch (err) {
  if (process.env.NETWORK !== "regtest") {
    baseLogger.info({ err }, "no custom.yaml available. using default values")
  }
}

export const yamlConfig = merge(defaultConfig, customConfig)

export const MEMO_SHARING_SATS_THRESHOLD = yamlConfig.limits.memoSharingSatsThreshold
export const MEMO_SHARING_CENTS_THRESHOLD = yamlConfig.limits.memoSharingCentsThreshold

export const ONCHAIN_MIN_CONFIRMATIONS = yamlConfig.onChainWallet.minConfirmations
// how many block are we looking back for getChainTransactions
const getOnChainScanDepth = (val: number): ScanDepth => {
  const scanDepth = checkedToScanDepth(val)
  if (scanDepth instanceof Error) throw scanDepth
  return scanDepth
}
export const ONCHAIN_SCAN_DEPTH = getOnChainScanDepth(yamlConfig.onChainWallet.scanDepth)
export const ONCHAIN_SCAN_DEPTH_OUTGOING = getOnChainScanDepth(
  yamlConfig.onChainWallet.scanDepthOutgoing,
)
export const ONCHAIN_SCAN_DEPTH_CHANNEL_UPDATE = getOnChainScanDepth(
  yamlConfig.onChainWallet.scanDepthChannelUpdate,
)

export const USER_ACTIVENESS_MONTHLY_VOLUME_THRESHOLD = toSats(
  yamlConfig.userActivenessMonthlyVolumeThreshold,
)

export const getGaloyInstanceName = (): string => yamlConfig.name

export const getBitcoinCoreRPCConfig = () => {
  return {
    network: process.env.NETWORK,
    username: process.env.BITCOINDRPCUSER || "rpcuser",
    password: process.env.BITCOINDRPCPASS,
    host: process.env.BITCOINDADDR,
    port: process.env.BITCOINDPORT,
    version: "0.22.0",
  }
}

export const getLndParams = (): LndParams[] => {
  const config = yamlConfig.lnds

  config.forEach((input) => {
    const keys = ["_TLS", "_MACAROON", "_DNS", "_PUBKEY"]
    keys.forEach((key) => {
      if (!process.env[`${input.name}${key}`]) {
        throw new ConfigError(`lnd params missing for: ${input.name}${key}`)
      }
    })
  })

  return config.map((input) => ({
    cert: process.env[`${input.name}_TLS`],
    macaroon: process.env[`${input.name}_MACAROON`],
    node: process.env[`${input.name}_DNS`],
    port: process.env[`${input.name}_RPCPORT`] ?? 10009,
    pubkey: process.env[`${input.name}_PUBKEY`],
    priority: 1, // will be overridden if present in the yaml
    ...input,
  }))
}

export const getFeeRates = (feesConfig = yamlConfig.fees): FeeRates => ({
  depositFeeVariable: feesConfig.deposit,
  depositFeeFixed: 0,
  withdrawFeeVariable: 0,
  withdrawFeeFixed: feesConfig.withdraw,
})

export const getWithdrawFeeRange = (
  withdrawFeeConfig = yamlConfig.withdrawFeeRange,
): WithdrawFeeRange => ({
  min: withdrawFeeConfig.min,
  max: withdrawFeeConfig.max,
})

export const getUserLimits = ({
  level,
  limitsConfig = yamlConfig.limits,
}: UserLimitsArgs): IUserLimits => {
  return {
    onUsLimit: limitsConfig.onUs.level[level] as Satoshis,
    withdrawalLimit: limitsConfig.withdrawal.level[level] as Satoshis,
  }
}

export const getTwoFALimits = (): TwoFALimits => ({
  threshold: yamlConfig.twoFA.threshold,
})

const getRateLimits = (config): RateLimitOptions => {
  /**
   * Returns a subset of the required parameters for the
   * 'rate-limiter-flexible.RateLimiterRedis' object.
   */
  return {
    points: config.points,
    duration: config.duration,
    blockDuration: config.blockDuration,
  }
}

export const getRequestPhoneCodePerPhoneLimits = () =>
  getRateLimits(yamlConfig.limits.requestPhoneCodePerPhone)

export const getRequestPhoneCodePerPhoneMinIntervalLimits = () =>
  getRateLimits(yamlConfig.limits.requestPhoneCodePerPhoneMinInterval)

export const getRequestPhoneCodePerIpLimits = () =>
  getRateLimits(yamlConfig.limits.requestPhoneCodePerIp)

export const getFailedLoginAttemptPerPhoneLimits = () =>
  getRateLimits(yamlConfig.limits.failedLoginAttemptPerPhone)

export const getFailedLoginAttemptPerIpLimits = () =>
  getRateLimits(yamlConfig.limits.failedLoginAttemptPerIp)

export const getInvoiceCreateAttemptLimits = () =>
  getRateLimits(yamlConfig.limits.invoiceCreateAttempt)

export const getInvoiceCreateForRecipientAttemptLimits = () =>
  getRateLimits(yamlConfig.limits.invoiceCreateForRecipientAttempt)

export const getOnChainAddressCreateAttemptLimits = () =>
  getRateLimits(yamlConfig.limits.onChainAddressCreateAttempt)

export const getOnChainWalletConfig = () => ({
  dustThreshold: yamlConfig.onChainWallet.dustThreshold,
})

export const getTransactionLimits = ({
  level,
  limitsConfig = yamlConfig.limits,
}: UserLimitsArgs): ITransactionLimits => {
  return {
    ...getUserLimits({ level, limitsConfig }),
  }
}

export const getUserWalletConfig = (
  user,
  limitsConfig = yamlConfig.limits,
): UserWalletConfig => {
  const transactionLimits = getTransactionLimits({ level: user.level, limitsConfig })
  const onChainWalletConfig = getOnChainWalletConfig()
  return {
    name: yamlConfig.name,
    dustThreshold: onChainWalletConfig.dustThreshold,
    onchainMinConfirmations: ONCHAIN_MIN_CONFIRMATIONS,
    limits: transactionLimits,
  }
}

export const getColdStorageConfig = (): ColdStorageConfig => {
  const config = yamlConfig.coldStorage

  const targetConfirmations = checkedToTargetConfs(config.targetConfirmations)
  if (targetConfirmations instanceof Error) throw targetConfirmations

  return {
    minOnChainHotWalletBalance: toSats(config.minOnChainHotWalletBalance),
    maxHotWalletBalance: toSats(config.maxHotWalletBalance),
    minRebalanceSize: toSats(config.minRebalanceSize),
    walletPattern: config.walletPattern,
    onChainWallet: config.onChainWallet,
    targetConfirmations,
  }
}

export const getBuildVersions = (): {
  minBuildNumberAndroid: number
  lastBuildNumberAndroid: number
  minBuildNumberIos: number
  lastBuildNumberIos: number
} => {
  const { android, ios } = yamlConfig.buildVersion

  return {
    minBuildNumberAndroid: android.minBuildNumber,
    lastBuildNumberAndroid: android.lastBuildNumber,
    minBuildNumberIos: ios.minBuildNumber,
    lastBuildNumberIos: ios.lastBuildNumber,
  }
}

export const PROXY_CHECK_APIKEY = yamlConfig?.PROXY_CHECK_APIKEY

export const getIpConfig = (config = yamlConfig): IpConfig => ({
  ipRecordingEnabled:
    process.env.NODE_ENV === "test" ? false : config.ipRecording?.enabled,
  proxyCheckingEnabled: config.ipRecording?.proxyChecking?.enabled,
})

export const getApolloConfig = (config = yamlConfig): ApolloConfig => config.apollo
export const getTwoFAConfig = (config = yamlConfig): TwoFAConfig => config.twoFA

export const LND_SCB_BACKUP_BUCKET_NAME = yamlConfig.lndScbBackupBucketName

export const getTestAccounts = (config = yamlConfig): TestAccount[] =>
  config.test_accounts
