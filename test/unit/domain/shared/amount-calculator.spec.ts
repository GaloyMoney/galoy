import { AmountCalculator, WalletCurrency } from "@domain/shared"

describe("AmountCalculator", () => {
  const calc = AmountCalculator()

  describe("adds", () => {
    const currency = WalletCurrency.Btc
    const a = { amount: 200n, currency }
    const b = { amount: 100n, currency }

    it("adds two payment amounts", () => {
      const res = calc.add(a, b)
      expect(res).toStrictEqual({ amount: 300n, currency })
    })

    // TODO: implement
    it.skip("fails with two payment amounts of mismatched currencies", () => {
      const res1 = calc.add(a, { amount: 200n, currency: WalletCurrency.Usd })
      expect(res1).toBeInstanceOf(Error)

      const res2 = calc.add({ amount: 100n, currency: WalletCurrency.Usd }, b)
      expect(res2).toBeInstanceOf(Error)
    })
  })

  describe("subs", () => {
    const currency = WalletCurrency.Btc
    const a = { amount: 200n, currency }
    const b = { amount: 100n, currency }

    it("sub two payment amounts", () => {
      const res = calc.sub(a, b)
      expect(res).toStrictEqual({ amount: 100n, currency })
    })

    // TODO: implement
    it.skip("fails with two payment amounts of mismatched currencies", () => {
      const res1 = calc.sub(a, { amount: 200n, currency: WalletCurrency.Usd })
      expect(res1).toBeInstanceOf(Error)

      const res2 = calc.sub({ amount: 100n, currency: WalletCurrency.Usd }, b)
      expect(res2).toBeInstanceOf(Error)
    })

    // TODO: implement
    it.skip("fails with if 1st value is smaller than 2nd one", () => {
      const res = calc.sub(b, a)
      expect(res).toBeInstanceOf(Error)
    })
  })

  describe("divides", () => {
    const currency = WalletCurrency.Btc

    const pivot = 200n
    const divisor = 100n
    const divisorBound = 50n
    const quotient = 2n

    const describeCases = [
      {
        type: "normal",
        div: calc.divRound,
        up: "up",
        down: "down",
      },
      {
        type: "floor",
        div: calc.divFloor,
        up: "down",
        down: "down",
      },
      {
        type: "ceil",
        div: calc.divCeil,
        up: "up",
        down: "up",
      },
    ]
    const itCases = ({ up, down }) => [
      {
        title: `no rounding if remainder is 0`,
        amount: pivot,
        result: {
          normal: quotient,
          floor: quotient,
          ceil: quotient,
        },
      },
      {
        title: `rounds ${down} if remainder is just above pivot`,
        amount: pivot + 1n,
        result: {
          normal: quotient,
          floor: quotient,
          ceil: quotient + 1n,
        },
      },
      {
        title: `rounds ${up} if remainder is just below pivot`,
        amount: pivot - 1n,
        result: {
          normal: quotient,
          floor: quotient - 1n,
          ceil: quotient,
        },
      },
      {
        title: `rounds ${down} if remainder is just below half of the divisor`,
        amount: pivot + (divisorBound - 1n),
        result: {
          normal: quotient,
          floor: quotient,
          ceil: quotient + 1n,
        },
      },
      {
        title: `rounds ${up} if remainder is just above half of the divisor`,
        amount: pivot + (divisorBound + 1n),
        result: {
          normal: quotient + 1n,
          floor: quotient,
          ceil: quotient + 1n,
        },
      },
      {
        title: `rounds ${down} if remainder is half of the divisor`,
        amount: pivot + divisorBound,
        result: {
          normal: quotient,
          floor: quotient,
          ceil: quotient + 1n,
        },
      },
    ]

    for (const describeGroup of describeCases) {
      describe(`by rounding to ${describeGroup.type}`, () => {
        const { up, down } = describeGroup
        for (const testCase of itCases({ up, down })) {
          const { title, amount } = testCase
          const expectedResult = testCase.result[describeGroup.type]

          it(title, () => {
            const result = describeGroup.div({ amount, currency }, divisor)
            expect(result.amount).toEqual(expectedResult)
            expect(result.currency).toBe(currency)
          })
        }
      })
    }
  })

  describe("applies basis point fraction to an amount", () => {
    const basisPoints = 50n // 0.5% or 0.005

    it("correctly applies basis points to an amount", () => {
      const amount = { amount: 20_000n, currency: WalletCurrency.Btc }
      const expectedAmount = 100n // 0.5% of 20_000
      const percentageOfAmount = calc.mulBasisPoints(amount, basisPoints)
      expect(percentageOfAmount.amount).toEqual(expectedAmount)
    })

    it("correctly applies basis points with rounding down from x.50", () => {
      const amount = { amount: 17_500n, currency: WalletCurrency.Btc }
      const expectedAmount = 87n // 0.5% of 17_500, rounded down from 87.5
      const percentageOfAmount = calc.mulBasisPoints(amount, basisPoints)
      expect(percentageOfAmount.amount).toEqual(expectedAmount)
    })

    it("correctly applies basis points with rounding up from x.5x", () => {
      const amount = { amount: 17_501n, currency: WalletCurrency.Btc }
      const expectedAmount = 88n // 0.5% of 17_501, rounded up from 87.505
      const percentageOfAmount = calc.mulBasisPoints(amount, basisPoints)
      expect(percentageOfAmount.amount).toEqual(expectedAmount)
    })

    it("correctly applies basis points to a small amount down to 0n", () => {
      const amount = { amount: 100n, currency: WalletCurrency.Btc }
      const expectedAmount = 0n // 0.5% of 100, rounded down from 0.5
      const percentageOfAmount = calc.mulBasisPoints(amount, basisPoints)
      expect(percentageOfAmount.amount).toEqual(expectedAmount)
    })

    it("correctly applies basis points to a small amount up  to 1n", () => {
      const amount = { amount: 101n, currency: WalletCurrency.Btc }
      const expectedAmount = 1n // 0.5% of 101, rounded up from 0.505
      const percentageOfAmount = calc.mulBasisPoints(amount, basisPoints)
      expect(percentageOfAmount.amount).toEqual(expectedAmount)
    })
  })

  describe("min", () => {
    it("returns the min from 2 payment amounts", () => {
      const minimum = calc.min(
        { amount: 10n, currency: WalletCurrency.Btc },
        { amount: 3n, currency: WalletCurrency.Btc },
      )
      expect(minimum).toStrictEqual({ amount: 3n, currency: WalletCurrency.Btc })
    })

    it("returns the min from multiple payment amounts", () => {
      const paymentAmounts = [
        { amount: 10n, currency: WalletCurrency.Btc },
        { amount: 3n, currency: WalletCurrency.Btc },
        { amount: 7n, currency: WalletCurrency.Btc },
      ]
      const minimum = calc.min(...paymentAmounts)
      expect(minimum).toStrictEqual({ amount: 3n, currency: WalletCurrency.Btc })
    })
  })

  describe("max", () => {
    it("returns the max from 2 payment amounts", () => {
      const maximum = calc.max(
        { amount: 10n, currency: WalletCurrency.Btc },
        { amount: 3n, currency: WalletCurrency.Btc },
      )
      expect(maximum).toStrictEqual({ amount: 10n, currency: WalletCurrency.Btc })
    })

    it("returns the max from multiple payment amounts", () => {
      const paymentAmounts = [
        { amount: 10n, currency: WalletCurrency.Btc },
        { amount: 3n, currency: WalletCurrency.Btc },
        { amount: 7n, currency: WalletCurrency.Btc },
      ]
      const maximum = calc.max(...paymentAmounts)
      expect(maximum).toStrictEqual({ amount: 10n, currency: WalletCurrency.Btc })
    })
  })
})
