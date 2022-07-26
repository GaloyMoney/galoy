import {
  BtcPaymentAmount,
  UsdPaymentAmount,
  WalletCurrency,
  ZERO_CENTS,
  ZERO_SATS,
} from "@domain/shared"

import { WalletInvoiceReceiver } from "@domain/wallet-invoices/wallet-invoice-receiver"

describe("WalletInvoiceReceiver", () => {
  const midPriceRatio = 2n
  const usdFromBtcMidPrice = async (amount: BtcPaymentAmount) => {
    return Promise.resolve({
      amount: amount.amount * midPriceRatio,
      currency: WalletCurrency.Usd,
    })
  }

  const immediatePriceRation = 3n
  const usdFromBtc = async (amount: BtcPaymentAmount) => {
    return Promise.resolve({
      amount: amount.amount * immediatePriceRation,
      currency: WalletCurrency.Usd,
    })
  }

  const receivedBtc = BtcPaymentAmount(1200n)
  const recipientBtcWallet = {
    id: "recipientWalletId" as WalletId,
    currency: WalletCurrency.Btc,
    username: "Username" as Username,
  }
  const recipientUsdWallet = {
    id: "recipientWalletId" as WalletId,
    currency: WalletCurrency.Usd,
    username: "Username" as Username,
  }

  describe("for btc invoice", () => {
    const btcInvoice: WalletInvoice = {
      paymentHash: "paymentHash" as PaymentHash,
      secret: "secret" as SecretPreImage,
      selfGenerated: false,
      pubkey: "pubkey" as Pubkey,
      usdAmount: undefined,
      paid: false,
      recipientWalletDescriptor: recipientBtcWallet,
    }

    it("returns correct amounts", async () => {
      const walletInvoiceAmounts = await WalletInvoiceReceiver({
        walletInvoice: btcInvoice,
        receivedBtc,
        usdFromBtcMidPrice,
        usdFromBtc,
      })

      if (walletInvoiceAmounts instanceof Error) throw walletInvoiceAmounts

      const usdToCreditReceiver = await usdFromBtcMidPrice(receivedBtc)

      if (usdToCreditReceiver instanceof Error) throw usdToCreditReceiver

      expect(walletInvoiceAmounts).toEqual(
        expect.objectContaining({
          usdBankFee: ZERO_CENTS,
          btcBankFee: ZERO_SATS,
          usdToCreditReceiver,
          btcToCreditReceiver: receivedBtc,
        }),
      )
    })
  })

  describe("for usd invoice", () => {
    describe("with cents amount", () => {
      const amountUsdInvoice: WalletInvoice = {
        paymentHash: "paymentHash" as PaymentHash,
        secret: "secret" as SecretPreImage,
        recipientWalletDescriptor: recipientUsdWallet,
        selfGenerated: false,
        pubkey: "pubkey" as Pubkey,
        usdAmount: UsdPaymentAmount(BigInt(100)),
        paid: false,
      }

      it("returns correct amounts", async () => {
        const walletInvoiceAmounts = await WalletInvoiceReceiver({
          walletInvoice: amountUsdInvoice,
          receivedBtc,
          usdFromBtcMidPrice,
          usdFromBtc,
        })

        if (walletInvoiceAmounts instanceof Error) throw walletInvoiceAmounts

        expect(walletInvoiceAmounts).toEqual(
          expect.objectContaining({
            usdBankFee: ZERO_CENTS,
            btcBankFee: ZERO_SATS,
            usdToCreditReceiver: amountUsdInvoice.usdAmount,
            btcToCreditReceiver: receivedBtc,
          }),
        )
      })
    })
  })

  describe("for usd invoice", () => {
    describe("with no amount", () => {
      const noAmountUsdInvoice: WalletInvoice = {
        paymentHash: "paymentHash" as PaymentHash,
        secret: "secret" as SecretPreImage,
        recipientWalletDescriptor: recipientUsdWallet,
        selfGenerated: false,
        pubkey: "pubkey" as Pubkey,
        paid: false,
      }

      it("returns correct amounts", async () => {
        const walletInvoiceAmounts = await WalletInvoiceReceiver({
          walletInvoice: noAmountUsdInvoice,
          receivedBtc,
          usdFromBtcMidPrice,
          usdFromBtc,
        })

        if (walletInvoiceAmounts instanceof Error) throw walletInvoiceAmounts

        const usdToCreditReceiver = await usdFromBtc(receivedBtc)
        if (usdToCreditReceiver instanceof Error) throw usdToCreditReceiver

        expect(walletInvoiceAmounts).toEqual(
          expect.objectContaining({
            usdBankFee: ZERO_CENTS,
            btcBankFee: ZERO_SATS,
            usdToCreditReceiver,
            btcToCreditReceiver: receivedBtc,
          }),
        )
      })
    })
  })
})
