import { toSats } from "@domain/bitcoin"
import { InsufficientBalanceError, InvalidCurrencyForWalletError } from "@domain/errors"
import { toCents } from "@domain/fiat"
import { PaymentFlow } from "@domain/payments"
import { WalletCurrency } from "@domain/shared"
import { PaymentInitiationMethod, SettlementMethod } from "@domain/wallets"

describe("PaymentFlowFromLedgerTransaction", () => {
  const satsAmount = toSats(20_000)
  const centsAmount = toCents(1_000)
  const satsFee = toSats(400)
  const centsFee = toCents(20)
  const timestamp = new Date()

  const paymentFlowState: PaymentFlowState<WalletCurrency, WalletCurrency> = {
    senderWalletId: "walletId" as WalletId,
    settlementMethod: SettlementMethod.Lightning,
    paymentInitiationMethod: PaymentInitiationMethod.Lightning,

    paymentHash: "paymentHash" as PaymentHash,
    descriptionFromInvoice: "",
    createdAt: timestamp,
    paymentSentAndPending: true,

    btcPaymentAmount: {
      amount: BigInt(satsAmount),
      currency: WalletCurrency.Btc,
    },
    usdPaymentAmount: {
      amount: BigInt(centsAmount),
      currency: WalletCurrency.Usd,
    },

    inputAmount: undefined as unknown as bigint,
    senderWalletCurrency: undefined as unknown as WalletCurrency,

    btcProtocolFee: {
      amount: BigInt(satsFee),
      currency: WalletCurrency.Btc,
    },
    usdProtocolFee: {
      amount: BigInt(centsFee),
      currency: WalletCurrency.Usd,
    },
  }

  const walletsToTest = [
    {
      name: "btc",
      senderCurrency: WalletCurrency.Btc,
      sendAmount: BigInt(satsAmount + satsFee),
      inputAmount: BigInt(satsAmount),
    },
    {
      name: "usd",
      senderCurrency: WalletCurrency.Usd,
      sendAmount: BigInt(centsAmount + centsFee),
      inputAmount: BigInt(centsAmount),
    },
  ]
  describe("checkBalanceForSend", () => {
    for (const { name, senderCurrency, sendAmount, inputAmount } of walletsToTest) {
      describe(`${name} sending wallet`, () => {
        const paymentFlow = PaymentFlow({
          ...paymentFlowState,
          inputAmount,
          senderWalletCurrency: senderCurrency,
        })
        if (paymentFlow instanceof Error) throw paymentFlow

        it("passes for send amount under balance", () => {
          const balanceForSend = {
            amount: sendAmount + 1n,
            currency: senderCurrency,
          }
          const check = paymentFlow.checkBalanceForSend(balanceForSend)
          expect(check).not.toBeInstanceOf(Error)
          expect(check).toBe(true)
        })

        it("passes for send amount equal to balance", () => {
          const balanceForSend = {
            amount: sendAmount,
            currency: senderCurrency,
          }
          const check = paymentFlow.checkBalanceForSend(balanceForSend)
          expect(check).not.toBeInstanceOf(Error)
          expect(check).toBe(true)
        })

        it("fails for send amount above to balance", () => {
          const balanceForSend = {
            amount: sendAmount - 1n,
            currency: senderCurrency,
          }
          const check = paymentFlow.checkBalanceForSend(balanceForSend)
          expect(check).toBeInstanceOf(InsufficientBalanceError)
        })

        it("fails for wrong balance currency", () => {
          const balanceForSend = {
            amount: sendAmount + 1n,
            currency:
              senderCurrency === WalletCurrency.Btc
                ? WalletCurrency.Usd
                : WalletCurrency.Btc,
          }
          const check = paymentFlow.checkBalanceForSend(balanceForSend)
          expect(check).toBeInstanceOf(InvalidCurrencyForWalletError)
        })
      })
    }
  })
})
