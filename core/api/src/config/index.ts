import {
  getBriaPartialConfigFromYaml,
  MEMO_SHARING_CENTS_THRESHOLD,
  MEMO_SHARING_SATS_THRESHOLD,
  getCronConfig,
} from "./yaml"
import { env } from "./env"

export * from "./error"
export * from "./yaml"
export * from "./schema"

import { ConfigError } from "./error"

import { toDays } from "@/domain/primitives"

export const MS_PER_SEC = 1000 as MilliSeconds
export const MS_PER_HOUR = (60 * 60 * MS_PER_SEC) as MilliSeconds
export const MS_PER_DAY = (24 * MS_PER_HOUR) as MilliSeconds
export const TWO_MONTHS_IN_MS = (60 * MS_PER_DAY) as MilliSeconds

export const SECS_PER_MIN = 60 as Seconds
export const SECS_PER_5_MINS = (60 * 5) as Seconds
export const SECS_PER_10_MINS = (SECS_PER_5_MINS * 2) as Seconds
export const SECS_PER_DAY = (24 * 60 * 60) as Seconds

export const ONE_DAY = toDays(1)

export const MAX_BYTES_FOR_MEMO = 639 // BOLT
export const MAX_LENGTH_FOR_FEEDBACK = 1024

export const MIN_SATS_FOR_PRICE_RATIO_PRECISION = 5000n

export const Levels: Levels = [0, 1, 2]

export const getGaloyBuildInformation = () => {
  return {
    commitHash: env.COMMITHASH,
    helmRevision: env.HELMREVISION,
  }
}

export const getJwksArgs = () => {
  const urlJkws = `${env.OATHKEEPER_DECISION_ENDPOINT}/.well-known/jwks.json`

  return {
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: urlJkws,
  }
}

export const getGeetestConfig = () => {
  const id = GEETEST_ID
  const key = GEETEST_KEY

  if (!id) throw new ConfigError("Missing GEETEST_ID config")
  if (!key) throw new ConfigError("Missing GEETEST_KEY config")

  const config = { id, key }
  return config
}

export const isRunningJest = typeof jest !== "undefined"

export const getLoopConfig = () => {
  if (getCronConfig().swapEnabled) {
    if (!LND1_LOOP_TLS) throw new ConfigError("Missing LND1_LOOP_TLS config")
    if (!LND2_LOOP_TLS) throw new ConfigError("Missing LND2_LOOP_TLS config")
    if (!LND1_LOOP_MACAROON) throw new ConfigError("Missing LND1_LOOP_MACAROON config")
    if (!LND2_LOOP_MACAROON) throw new ConfigError("Missing LND2_LOOP_MACAROON config")
    return {
      lnd1LoopTls: LND1_LOOP_TLS,
      lnd1LoopMacaroon: LND1_LOOP_MACAROON,
      lnd2LoopTls: LND2_LOOP_TLS,
      lnd2LoopMacaroon: LND2_LOOP_MACAROON,
    }
  }
  throw new ConfigError("getLoopConfig() was called though swapEnabled is false")
}

// onboarding
export const OnboardingEarn: Record<QuizQuestionId, Satoshis> = {
  walletDownloaded: 1 as Satoshis,
  walletActivated: 1 as Satoshis,
  whatIsBitcoin: 1 as Satoshis,
  sat: 2 as Satoshis,
  whereBitcoinExist: 3 as Satoshis,
  whoControlsBitcoin: 3 as Satoshis,
  copyBitcoin: 3 as Satoshis,
  moneyImportantGovernement: 4 as Satoshis,
  moneyIsImportant: 4 as Satoshis,
  whyStonesShellGold: 4 as Satoshis,
  moneyEvolution: 4 as Satoshis,
  coincidenceOfWants: 4 as Satoshis,
  moneySocialAggrement: 4 as Satoshis,
  WhatIsFiat: 5 as Satoshis,
  whyCareAboutFiatMoney: 5 as Satoshis,
  GovernementCanPrintMoney: 5 as Satoshis,
  FiatLosesValueOverTime: 5 as Satoshis,
  OtherIssues: 5 as Satoshis,
  LimitedSupply: 6 as Satoshis,
  Decentralized: 6 as Satoshis,
  NoCounterfeitMoney: 6 as Satoshis,
  HighlyDivisible: 6 as Satoshis,
  securePartOne: 6 as Satoshis,
  securePartTwo: 6 as Satoshis,
} as const

export const memoSharingConfig = {
  memoSharingSatsThreshold: MEMO_SHARING_SATS_THRESHOLD,
  memoSharingCentsThreshold: MEMO_SHARING_CENTS_THRESHOLD,
  authorizedMemos: Object.keys(OnboardingEarn),
} as const

export const getCallbackServiceConfig = (): SvixConfig => {
  const secret = env.SVIX_SECRET
  const endpoint = env.SVIX_ENDPOINT
  return { secret, endpoint }
}

export const getBriaConfig = getBriaPartialConfigFromYaml

export const COMMITHASH = env.COMMITHASH
export const HELMREVISION = env.HELMREVISION
export const LOGLEVEL = env.LOGLEVEL
export const UNSECURE_DEFAULT_LOGIN_CODE = env.UNSECURE_DEFAULT_LOGIN_CODE
export const UNSECURE_IP_FROM_REQUEST_OBJECT = env.UNSECURE_IP_FROM_REQUEST_OBJECT
export const UNSECURE_PRICE_CACHE = env.UNSECURE_PRICE_CACHE
export const EXPORTER_PORT = env.EXPORTER_PORT
export const TRIGGER_PORT = env.TRIGGER_PORT
export const WEBSOCKET_PORT = env.WEBSOCKET_PORT
export const KRATOS_PG_CON = env.KRATOS_PG_CON
export const OATHKEEPER_DECISION_ENDPOINT = env.OATHKEEPER_DECISION_ENDPOINT
export const GALOY_API_PORT = env.GALOY_API_PORT
export const GALOY_ADMIN_PORT = env.GALOY_ADMIN_PORT
export const NETWORK = env.NETWORK as BtcNetwork
export const PRICE_SERVER_PORT = env.PRICE_SERVER_PORT
export const PRICE_SERVER_HOST = env.PRICE_SERVER_HOST
export const TWILIO_ACCOUNT_SID = env.TWILIO_ACCOUNT_SID
export const TWILIO_AUTH_TOKEN = env.TWILIO_AUTH_TOKEN
export const TWILIO_VERIFY_SERVICE_ID = env.TWILIO_VERIFY_SERVICE_ID
export const KRATOS_PUBLIC_API = env.KRATOS_PUBLIC_API
export const KRATOS_ADMIN_API = env.KRATOS_ADMIN_API
export const KRATOS_MASTER_USER_PASSWORD = env.KRATOS_MASTER_USER_PASSWORD
export const KRATOS_CALLBACK_API_KEY = env.KRATOS_CALLBACK_API_KEY
export const BRIA_HOST = env.BRIA_HOST
export const BRIA_PORT = env.BRIA_PORT
export const BRIA_API_KEY = env.BRIA_API_KEY
export const GEETEST_ID = env.GEETEST_ID
export const GEETEST_KEY = env.GEETEST_KEY
export const MONGODB_CON = env.MONGODB_CON
export const GOOGLE_APPLICATION_CREDENTIALS = env.GOOGLE_APPLICATION_CREDENTIALS
export const REDIS_MASTER_NAME = env.REDIS_MASTER_NAME
export const REDIS_PASSWORD = env.REDIS_PASSWORD
export const REDIS_TYPE = env.REDIS_TYPE
export const REDIS_0_DNS = env.REDIS_0_DNS
export const REDIS_0_PORT = env.REDIS_0_PORT
export const REDIS_1_DNS = env.REDIS_1_DNS
export const REDIS_1_PORT = env.REDIS_1_PORT
export const REDIS_2_DNS = env.REDIS_2_DNS
export const REDIS_2_PORT = env.REDIS_2_PORT
export const LND_PRIORITY = env.LND_PRIORITY
export const LND1_PUBKEY = env.LND1_PUBKEY as Pubkey
export const LND1_TLS = env.LND1_TLS
export const LND1_MACAROON = env.LND1_MACAROON as Macaroon
export const LND1_DNS = env.LND1_DNS
export const LND1_RPCPORT = env.LND1_RPCPORT
export const LND1_TYPE = env.LND1_TYPE as LndNodeType[]
export const LND1_NAME = env.LND1_NAME
export const LND2_PUBKEY = env.LND2_PUBKEY as Pubkey
export const LND2_TLS = env.LND2_TLS
export const LND2_MACAROON = env.LND2_MACAROON as Macaroon
export const LND2_DNS = env.LND2_DNS
export const LND2_RPCPORT = env.LND2_RPCPORT
export const LND2_TYPE = env.LND2_TYPE as LndNodeType[]
export const LND2_NAME = env.LND2_NAME
export const LND1_LOOP_TLS = env.LND1_LOOP_TLS
export const LND1_LOOP_MACAROON = env.LND1_LOOP_MACAROON as Macaroon
export const LND2_LOOP_TLS = env.LND2_LOOP_TLS
export const LND2_LOOP_MACAROON = env.LND2_LOOP_MACAROON as Macaroon
export const PRICE_HOST = env.PRICE_HOST
export const PRICE_PORT = env.PRICE_PORT
export const PRICE_HISTORY_HOST = env.PRICE_HISTORY_HOST
export const PRICE_HISTORY_PORT = env.PRICE_HISTORY_PORT
export const DROPBOX_ACCESS_TOKEN = env.DROPBOX_ACCESS_TOKEN
export const GCS_APPLICATION_CREDENTIALS_PATH = env.GCS_APPLICATION_CREDENTIALS_PATH
export const NEXTCLOUD_URL = env.NEXTCLOUD_URL
export const NEXTCLOUD_USER = env.NEXTCLOUD_USER
export const NEXTCLOUD_PASSWORD = env.NEXTCLOUD_PASSWORD
export const MATTERMOST_WEBHOOK_URL = env.MATTERMOST_WEBHOOK_URL
export const PROXY_CHECK_APIKEY = env.PROXY_CHECK_APIKEY
