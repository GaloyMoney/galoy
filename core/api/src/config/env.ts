import { createEnv } from "@t3-oss/env-core"
import { ZodError, z } from "zod"

export const env = createEnv({
  onValidationError: (error: ZodError) => {
    console.error("❌ Invalid environment variables:", error.flatten().fieldErrors)
    throw new Error(
      `Invalid environment variables: ${JSON.stringify(error.flatten().fieldErrors)}`,
    )
  },

  server: {
    COMMITHASH: z.string().default("dev"),
    HELMREVISION: z.string().min(1),

    LOGLEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace"])
      .default("info"),

    UNSECURE_DEFAULT_LOGIN_CODE: z.string().min(1).optional(),
    UNSECURE_IP_FROM_REQUEST_OBJECT: z
      .boolean()
      .or(z.string())
      .pipe(z.coerce.boolean())
      .default(false),
    UNSECURE_PRICE_CACHE: z
      .boolean()
      .or(z.string())
      .pipe(z.coerce.boolean())
      .default(false),

    EXPORTER_PORT: z.number().or(z.string()).pipe(z.coerce.number()).default(3000),
    TRIGGER_PORT: z.number().or(z.string()).pipe(z.coerce.number()).default(8888),
    WEBSOCKET_PORT: z.number().or(z.string()).pipe(z.coerce.number()).default(4000),

    KRATOS_PG_CON: z.string().url(),
    OATHKEEPER_DECISION_ENDPOINT: z.string().url(),
    GALOY_API_PORT: z.number().or(z.string()).pipe(z.coerce.number()).default(4012),
    GALOY_ADMIN_PORT: z.number().or(z.string()).pipe(z.coerce.number()).default(4001),
    NETWORK: z.enum(["mainnet", "testnet", "signet", "regtest"]),

    PRICE_SERVER_PORT: z.number().or(z.string()).pipe(z.coerce.number()).default(3325),
    PRICE_SERVER_HOST: z.string().default("localhost"),

    TWILIO_ACCOUNT_SID: z.string().min(1),
    TWILIO_AUTH_TOKEN: z.string().min(1),
    TWILIO_VERIFY_SERVICE_ID: z.string().min(1),

    KRATOS_PUBLIC_API: z.string().url(),
    KRATOS_ADMIN_API: z.string().url(),
    KRATOS_MASTER_USER_PASSWORD: z.string().min(1),
    KRATOS_CALLBACK_API_KEY: z.string().min(1),

    BRIA_HOST: z.string().min(1),
    BRIA_PORT: z.number().min(1).or(z.string()).pipe(z.coerce.number()),
    BRIA_API_KEY: z.string().min(1),

    GEETEST_ID: z.string().min(1).optional(),
    GEETEST_KEY: z.string().min(1).optional(),

    MONGODB_CON: z.string().url(),

    GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),

    REDIS_TYPE: z.enum(["sentinel", "standalone"]).default("sentinel"),

    REDIS_MASTER_NAME: z.string().min(1),
    REDIS_PASSWORD: z.string(),
    REDIS_0_DNS: z.string().min(1),

    REDIS_0_PORT: z.number().or(z.string()).pipe(z.coerce.number()).default(26379),
    REDIS_1_DNS: z.string().min(1).optional(),
    REDIS_1_PORT: z.number().or(z.string()).pipe(z.coerce.number()).default(26379),
    REDIS_2_DNS: z.string().min(1).optional(),
    REDIS_2_PORT: z.number().or(z.string()).pipe(z.coerce.number()).default(26379),

    // LND PRIMARY
    LND_PRIORITY: z.enum(["lnd1", "lnd2"]).default("lnd1"),

    LND1_PUBKEY: z
      .string()
      .regex(/^[a-f0-9]{66}$/i)
      .optional(),
    LND1_TLS: z.string().min(1).optional(),
    LND1_MACAROON: z.string().min(1).optional(),
    LND1_DNS: z.string().min(1).optional(),
    LND1_RPCPORT: z.number().min(1).or(z.string()).pipe(z.coerce.number()).default(10009),
    LND1_TYPE: z
      .enum(["onchain", "offchain", "onchain,offchain", "offchain,onchain"])
      .default("onchain,offchain")
      .transform((x) => x.split(",")),
    LND1_NAME: z.string().min(1).default("lnd1"),

    LND2_PUBKEY: z
      .string()
      .regex(/^[a-f0-9]{66}$/i)
      .optional(),
    LND2_TLS: z.string().min(1).optional(),
    LND2_MACAROON: z.string().min(1).optional(),
    LND2_DNS: z.string().min(1).optional(),
    LND2_RPCPORT: z.number().min(1).or(z.string()).pipe(z.coerce.number()).default(10009),
    LND2_TYPE: z
      .enum(["onchain", "offchain", "onchain,offchain", "offchain,onchain"])
      .default("offchain")
      .transform((x) => x.split(",")),
    LND2_NAME: z.string().min(1).default("lnd2"),

    LND1_LOOP_TLS: z.string().min(1).optional(),
    LND1_LOOP_MACAROON: z.string().min(1).optional(),
    LND2_LOOP_TLS: z.string().min(1).optional(),
    LND2_LOOP_MACAROON: z.string().min(1).optional(),

    PRICE_HOST: z.string().min(1).default("galoy-price"),
    PRICE_PORT: z.number().min(1).or(z.string()).pipe(z.coerce.number()).default(50051),

    PRICE_HISTORY_HOST: z.string().min(1).default("price-history"),
    PRICE_HISTORY_PORT: z
      .number()
      .min(1)
      .or(z.string())
      .pipe(z.coerce.number())
      .default(50052),

    DROPBOX_ACCESS_TOKEN: z.string().min(1).optional(),
    GCS_APPLICATION_CREDENTIALS_PATH: z.string().min(1).optional(),
    NEXTCLOUD_URL: z.string().min(1).optional(),
    NEXTCLOUD_USER: z.string().min(1).optional(),
    NEXTCLOUD_PASSWORD: z.string().min(1).optional(),

    MATTERMOST_WEBHOOK_URL: z.string().min(1).optional(),

    PROXY_CHECK_APIKEY: z.string().min(1).optional(),

    SVIX_SECRET: z.string().optional(),
    SVIX_ENDPOINT: z.union([z.string().url().nullish(), z.literal("")]), // optional url
  },

  runtimeEnvStrict: {
    COMMITHASH: process.env.COMMITHASH,
    HELMREVISION: process.env.HELMREVISION,

    LOGLEVEL: process.env.LOGLEVEL,

    UNSECURE_DEFAULT_LOGIN_CODE: process.env.UNSECURE_DEFAULT_LOGIN_CODE,
    UNSECURE_IP_FROM_REQUEST_OBJECT: process.env.UNSECURE_IP_FROM_REQUEST_OBJECT,
    UNSECURE_PRICE_CACHE: process.env.UNSECURE_PRICE_CACHE,

    EXPORTER_PORT: process.env.EXPORTER_PORT,
    TRIGGER_PORT: process.env.TRIGGER_PORT,
    WEBSOCKET_PORT: process.env.WEBSOCKET_PORT,

    KRATOS_PG_CON: process.env.KRATOS_PG_CON,
    OATHKEEPER_DECISION_ENDPOINT: process.env.OATHKEEPER_DECISION_ENDPOINT,

    GALOY_API_PORT: process.env.GALOY_API_PORT,
    GALOY_ADMIN_PORT: process.env.GALOY_ADMIN_PORT,

    NETWORK: process.env.NETWORK,

    PRICE_SERVER_PORT: process.env.PRICE_SERVER_PORT,
    PRICE_SERVER_HOST: process.env.PRICE_SERVER_HOST,

    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_VERIFY_SERVICE_ID: process.env.TWILIO_VERIFY_SERVICE_ID,

    KRATOS_PUBLIC_API: process.env.KRATOS_PUBLIC_API,
    KRATOS_ADMIN_API: process.env.KRATOS_ADMIN_API,
    KRATOS_MASTER_USER_PASSWORD: process.env.KRATOS_MASTER_USER_PASSWORD,
    KRATOS_CALLBACK_API_KEY: process.env.KRATOS_CALLBACK_API_KEY,

    BRIA_HOST: process.env.BRIA_HOST,
    BRIA_PORT: process.env.BRIA_PORT,
    BRIA_API_KEY: process.env.BRIA_API_KEY,

    GEETEST_ID: process.env.GEETEST_ID,
    GEETEST_KEY: process.env.GEETEST_KEY,

    MONGODB_CON: process.env.MONGODB_CON,

    GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,

    REDIS_MASTER_NAME: process.env.REDIS_MASTER_NAME,
    REDIS_PASSWORD: process.env.REDIS_PASSWORD,
    REDIS_TYPE: process.env.REDIS_TYPE,
    REDIS_0_DNS: process.env.REDIS_0_DNS,
    REDIS_0_PORT: process.env.REDIS_0_PORT,
    REDIS_1_DNS: process.env.REDIS_1_DNS,
    REDIS_1_PORT: process.env.REDIS_1_PORT,
    REDIS_2_DNS: process.env.REDIS_2_DNS,
    REDIS_2_PORT: process.env.REDIS_2_PORT,

    LND_PRIORITY: process.env.LND_PRIORITY,

    LND1_PUBKEY: process.env.LND1_PUBKEY,
    LND1_TLS: process.env.LND1_TLS,
    LND1_MACAROON: process.env.LND1_MACAROON,
    LND1_DNS: process.env.LND1_DNS,
    LND1_RPCPORT: process.env.LND1_RPCPORT,
    LND1_TYPE: process.env.LND1_TYPE,
    LND1_NAME: process.env.LND1_NAME,

    LND2_PUBKEY: process.env.LND2_PUBKEY,
    LND2_TLS: process.env.LND2_TLS,
    LND2_MACAROON: process.env.LND2_MACAROON,
    LND2_DNS: process.env.LND2_DNS,
    LND2_RPCPORT: process.env.LND2_RPCPORT,
    LND2_TYPE: process.env.LND2_TYPE,
    LND2_NAME: process.env.LND2_NAME,

    LND1_LOOP_TLS: process.env.LND1_LOOP_TLS,
    LND1_LOOP_MACAROON: process.env.LND1_LOOP_MACAROON,
    LND2_LOOP_TLS: process.env.LND2_LOOP_TLS,
    LND2_LOOP_MACAROON: process.env.LND2_LOOP_MACAROON,

    PRICE_HOST: process.env.PRICE_HOST,
    PRICE_PORT: process.env.PRICE_PORT,

    PRICE_HISTORY_HOST: process.env.PRICE_HISTORY_HOST,
    PRICE_HISTORY_PORT: process.env.PRICE_HISTORY_PORT,

    DROPBOX_ACCESS_TOKEN: process.env.DROPBOX_ACCESS_TOKEN,
    GCS_APPLICATION_CREDENTIALS_PATH: process.env.GCS_APPLICATION_CREDENTIALS_PATH,
    NEXTCLOUD_URL: process.env.NEXTCLOUD_URL,
    NEXTCLOUD_USER: process.env.NEXTCLOUD_USER,
    NEXTCLOUD_PASSWORD: process.env.NEXTCLOUD_PASSWORD,

    MATTERMOST_WEBHOOK_URL: process.env.MATTERMOST_WEBHOOK_URL,

    PROXY_CHECK_APIKEY: process.env.PROXY_CHECK_APIKEY,

    SVIX_SECRET: process.env.SVIX_SECRET,
    SVIX_ENDPOINT: process.env.SVIX_ENDPOINT,
  },
})
