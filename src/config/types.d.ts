type IpConfig = {
  ipRecordingEnabled: boolean
  proxyCheckingEnabled: boolean
}

type Levels = number[]

type CronConfig = {
  rebalanceEnabled: boolean
}

type KratosConfig = {
  serverURL: string
  corsAllowedOrigins: string[]
}

type CaptchaConfig = {
  mandatory: boolean
}

type ApolloConfig = {
  playground: boolean
  playgroundUrl: string
}

type TwoFAConfig = {
  threshold: number
}

type AccountsConfig = {
  initialStatus: AccountStatus
  customFields: CustomField[]
}
