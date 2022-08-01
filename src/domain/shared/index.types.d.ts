type ErrorLevel =
  typeof import("./errors").ErrorLevel[keyof typeof import("./errors").ErrorLevel]
type ValidationError = import("./errors").ValidationError
type BigIntConversionError = import("./errors").BigIntConversionError

type WalletCurrency =
  typeof import("./primitives").WalletCurrency[keyof typeof import("./primitives").WalletCurrency]

type ExchangeCurrencyUnit =
  typeof import("./primitives").ExchangeCurrencyUnit[keyof typeof import("./primitives").ExchangeCurrencyUnit]

type Amount<T extends WalletCurrency> = {
  currency: T
  amount: bigint
}

type DisplayAmount<T extends DisplayCurrency> = {
  currency: T
  amount: number
}

type PaymentAmount<T extends WalletCurrency> = Amount<T> & {
  readonly brand?: unique symbol
}
type DisplayPaymentAmount<T extends DisplayCurrency> = DisplayAmount<T> & {
  readonly brand?: unique symbol
}

type BalanceAmount<T extends WalletCurrency> = Amount<T> & {
  readonly brand?: unique symbol
}
type DisplayBalanceAmount<T extends DisplayCurrency> = DisplayAmount<T> & {
  readonly brand?: unique symbol
}

type WalletDescriptor<T extends WalletCurrency> = {
  id: WalletId
  currency: T
}

type BtcPaymentAmount = PaymentAmount<"BTC">
type UsdPaymentAmount = PaymentAmount<"USD">

type RequireField<T, K extends keyof T> = T & Required<Pick<T, K>>

type AmountCalculator = {
  add: <T extends WalletCurrency>(
    a: PaymentAmount<T>,
    b: PaymentAmount<T>,
  ) => PaymentAmount<T>
  sub: <T extends WalletCurrency>(
    a: PaymentAmount<T>,
    b: PaymentAmount<T>,
  ) => PaymentAmount<T>
  divRound: <T extends WalletCurrency>(a: PaymentAmount<T>, b: bigint) => PaymentAmount<T>
  divFloor: <T extends WalletCurrency>(a: PaymentAmount<T>, b: bigint) => PaymentAmount<T>
  divCeil: <T extends WalletCurrency>(a: PaymentAmount<T>, b: bigint) => PaymentAmount<T>
  mulBasisPoints: <T extends WalletCurrency>(
    amount: PaymentAmount<T>,
    basisPoints: bigint,
  ) => PaymentAmount<T>
  min: <T extends WalletCurrency>(...args: PaymentAmount<T>[]) => PaymentAmount<T>
  max: <T extends WalletCurrency>(...args: PaymentAmount<T>[]) => PaymentAmount<T>
}
