import {
  BtcPaymentAmount,
  UsdPaymentAmount,
  WalletCurrency,
  ZERO_CENTS,
  ZERO_SATS,
} from "@/domain/shared"

import { WalletInvoiceReceiver } from "@/domain/wallet-invoices/wallet-invoice-receiver"

describe("WalletInvoiceReceiver", () => {
  const midPriceRatio = 2n
  const usdFromBtcMidPrice = async (amount: BtcPaymentAmount) => {
    const finalAmount = amount.amount / midPriceRatio || 1n
    return Promise.resolve({
      amount: finalAmount,
      currency: WalletCurrency.Usd,
    })
  }

  const immediatePriceRation = 3n
  const usdFromBtc = async (amount: BtcPaymentAmount) => {
    return Promise.resolve({
      amount: amount.amount / immediatePriceRation,
      currency: WalletCurrency.Usd,
    })
  }

  const receivedBtc = BtcPaymentAmount(1200n)

  const recipientAccountId = "recipientAccountId" as AccountId

  const recipientBtcWalletDescriptor = {
    id: "recipientBtcWalletId" as WalletId,
    currency: WalletCurrency.Btc,
    accountId: recipientAccountId,
  }

  const recipientUsdWalletDescriptor = {
    id: "recipientUsdWalletId" as WalletId,
    currency: WalletCurrency.Usd,
    accountId: recipientAccountId,
  }

  const recipientWalletDescriptors = {
    [WalletCurrency.Btc]: recipientBtcWalletDescriptor,
    [WalletCurrency.Usd]: recipientUsdWalletDescriptor,
  }

  const mockLnInvoice: LnInvoice = {
    destination: "destination" as Pubkey,
    paymentHash: "paymentHash" as PaymentHash,
    paymentRequest: "paymentRequest" as EncodedPaymentRequest,
    paymentSecret: "paymentSecret" as PaymentIdentifyingSecret,
    milliSatsAmount: 0 as MilliSatoshis,
    description: "description",
    routeHints: [] as Hop[][],
    features: [] as LnInvoiceFeature[],
    expiresAt: new Date(),
    isExpired: false,
    cltvDelta: null,
    amount: null,
    paymentAmount: null,
    createdAt: new Date(),
  }

  describe("for btc invoice", () => {
    const btcInvoice: WalletInvoice = {
      paymentHash: "paymentHash" as PaymentHash,
      secret: "secret" as SecretPreImage,
      selfGenerated: false,
      pubkey: "pubkey" as Pubkey,
      usdAmount: undefined,
      paid: false,
      recipientWalletDescriptor: recipientBtcWalletDescriptor,
      createdAt: new Date(),
      lnInvoice: mockLnInvoice,
      processingCompleted: false,
      externalId: "externalId" as LedgerExternalId,
    }

    it("returns correct amounts", async () => {
      const walletInvoiceAmounts = await WalletInvoiceReceiver({
        walletInvoice: btcInvoice,
        receivedBtc,
        recipientWalletDescriptors,
      }).withConversion({
        mid: { usdFromBtc: usdFromBtcMidPrice },
        hedgeBuyUsd: { usdFromBtc },
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
        recipientWalletDescriptor: recipientUsdWalletDescriptor,
        selfGenerated: false,
        pubkey: "pubkey" as Pubkey,
        usdAmount: UsdPaymentAmount(BigInt(100)),
        paid: false,
        createdAt: new Date(),
        lnInvoice: mockLnInvoice,
        externalId: "externalId" as LedgerExternalId,
        processingCompleted: false,
      }

      it("returns correct amounts", async () => {
        const walletInvoiceAmounts = await WalletInvoiceReceiver({
          walletInvoice: amountUsdInvoice,
          receivedBtc,
          recipientWalletDescriptors,
        }).withConversion({
          mid: { usdFromBtc: usdFromBtcMidPrice },
          hedgeBuyUsd: { usdFromBtc },
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
    describe("with no amount", () => {
      const noAmountUsdInvoice: WalletInvoice = {
        paymentHash: "paymentHash" as PaymentHash,
        secret: "secret" as SecretPreImage,
        recipientWalletDescriptor: recipientUsdWalletDescriptor,
        selfGenerated: false,
        pubkey: "pubkey" as Pubkey,
        paid: false,
        createdAt: new Date(),
        lnInvoice: mockLnInvoice,
        processingCompleted: false,
        externalId: "externalId" as LedgerExternalId,
      }

      it("returns correct amounts", async () => {
        const walletInvoiceAmounts = await WalletInvoiceReceiver({
          walletInvoice: noAmountUsdInvoice,
          receivedBtc,
          recipientWalletDescriptors,
        }).withConversion({
          mid: { usdFromBtc: usdFromBtcMidPrice },
          hedgeBuyUsd: { usdFromBtc },
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

      it("credits amount less than 1 cent amount to recipient btc wallet", async () => {
        const walletInvoiceAmounts = await WalletInvoiceReceiver({
          walletInvoice: noAmountUsdInvoice,
          receivedBtc: BtcPaymentAmount(1n),
          recipientWalletDescriptors,
        }).withConversion({
          mid: { usdFromBtc: usdFromBtcMidPrice },
          hedgeBuyUsd: { usdFromBtc },
        })
        if (walletInvoiceAmounts instanceof Error) throw walletInvoiceAmounts

        const { recipientWalletDescriptor } = walletInvoiceAmounts
        expect(recipientWalletDescriptor).toStrictEqual(recipientBtcWalletDescriptor)
      })
    })
  })
})
