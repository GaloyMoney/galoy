export const AmountCalculator = (): AmountCalculator => {
  const add = <T extends WalletCurrency>(a: PaymentAmount<T>, b: PaymentAmount<T>) => {
    return {
      currency: a.currency,
      amount: a.amount + b.amount,
    }
  }

  const sub = <T extends WalletCurrency>(a: PaymentAmount<T>, b: PaymentAmount<T>) => {
    return {
      currency: a.currency,
      amount: a.amount - b.amount,
    }
  }

  const divRound = <T extends WalletCurrency>(
    a: PaymentAmount<T>,
    b: bigint,
  ): PaymentAmount<T> => {
    const quotient = a.amount / b

    const roundDownBound = b / 2n
    const mod = a.amount % b
    return mod > roundDownBound
      ? { amount: quotient + 1n, currency: a.currency }
      : { amount: quotient, currency: a.currency }
  }

  const divFloor = <T extends WalletCurrency>(
    a: PaymentAmount<T>,
    b: bigint,
  ): PaymentAmount<T> => {
    const quotient = a.amount / b

    return { amount: quotient, currency: a.currency }
  }

  const divCeil = <T extends WalletCurrency>(
    a: PaymentAmount<T>,
    b: bigint,
  ): PaymentAmount<T> => {
    const quotient = a.amount / b

    const mod = a.amount % b
    return mod > 0n
      ? { amount: quotient + 1n, currency: a.currency }
      : { amount: quotient, currency: a.currency }
  }

  const mulBasisPoints = <T extends WalletCurrency>(
    amount: PaymentAmount<T>,
    basisPoints: bigint,
  ) =>
    divRound({ amount: amount.amount * basisPoints, currency: amount.currency }, 10_000n)

  const min = <T extends WalletCurrency>(...args: PaymentAmount<T>[]) =>
    args.reduce((min, val) => (val.amount < min.amount ? val : min))

  const max = <T extends WalletCurrency>(...args: PaymentAmount<T>[]) =>
    args.reduce((max, val) => (val.amount > max.amount ? val : max))

  return {
    sub,
    add,
    divRound,
    divFloor,
    divCeil,
    mulBasisPoints,
    min,
    max,
  }
}
