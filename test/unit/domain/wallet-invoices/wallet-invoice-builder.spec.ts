import { toSats } from "@domain/bitcoin"
import { sha256 } from "@domain/bitcoin/lightning"
import { BtcPaymentAmount, WalletCurrency } from "@domain/shared"
import { WalletInvoiceBuilder } from "@domain/wallet-invoices/wallet-invoice-builder"

describe("WalletInvoiceBuilder", () => {
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
  const uncheckedAmount = 100
  const dealerPriceRatio = 2n
  const btcFromUsd = async (amount: UsdPaymentAmount) => {
    return Promise.resolve({
      amount: amount.amount / dealerPriceRatio,
      currency: WalletCurrency.Btc,
    })
  }

  const registerInvoice = async (args: NewRegisterInvoiceArgs) => {
    const amount = toSats(args.btcPaymentAmount.amount)

    const lnInvoice = {
      destination: "pubkey" as Pubkey,
      paymentHash: args.paymentHash,
      paymentRequest: "paymentRequest" as EncodedPaymentRequest,
      milliSatsAmount: (amount * 1000) as MilliSatoshis,
      description: args.description,
      cltvDelta: null,
      amount,
      paymentAmount: args.btcPaymentAmount,
      routeHints: [[]],
      paymentSecret: null,
      features: [],
      expiresAt: args.expiresAt,
      isExpired: false,
    }

    const invoice: RegisteredInvoice = {
      invoice: lnInvoice,
      pubkey: "pubkey" as Pubkey,
      descriptionHash: args.descriptionHash,
    }

    return invoice
  }

  const WIB = WalletInvoiceBuilder({
    dealerBtcFromUsd: btcFromUsd,
    lnRegisterInvoice: registerInvoice,
  })

  const checkSecretAndHash = ({ lnInvoice, walletInvoice }: LnAndWalletInvoice) => {
    const { secret } = walletInvoice
    const hashFromSecret = sha256(Buffer.from(secret, "hex"))
    expect(hashFromSecret).toEqual(walletInvoice.paymentHash)
    expect(walletInvoice.paymentHash).toEqual(lnInvoice.paymentHash)
    expect(lnInvoice).not.toHaveProperty("secret")
  }

  const testDescription = "testdescription"
  const WIBWithDescription = WIB.withDescription({
    description: testDescription,
  })
  const checkDescription = ({ lnInvoice }: LnAndWalletInvoice) => {
    expect(lnInvoice.description).toEqual(testDescription)
  }

  describe("generated for self", () => {
    const WIBWithCreator = WIBWithDescription.generatedForSelf()
    const checkCreator = ({ walletInvoice }: LnAndWalletInvoice) => {
      expect(walletInvoice.selfGenerated).toEqual(true)
    }

    describe("with btc recipient wallet", () => {
      const WIBWithRecipient = WIBWithCreator.withRecipientWallet(recipientBtcWallet)
      const checkRecipientWallet = ({ walletInvoice }: LnAndWalletInvoice) => {
        expect(walletInvoice.recipientWalletDescriptor).toEqual(recipientBtcWallet)
      }

      describe("with amount", () => {
        it("registers and persists invoice with no conversion", async () => {
          const WIBWithAmount = await WIBWithRecipient.withAmount(uncheckedAmount)

          if (WIBWithAmount instanceof Error) throw WIBWithAmount
          const checkAmount = ({ lnInvoice, walletInvoice }: LnAndWalletInvoice) => {
            expect(lnInvoice).toEqual(
              expect.objectContaining({
                amount: uncheckedAmount as Satoshis,
                paymentAmount: BtcPaymentAmount(BigInt(uncheckedAmount)),
                milliSatsAmount: (1000 * uncheckedAmount) as MilliSatoshis,
              }),
            )
            expect(walletInvoice).toEqual(
              expect.objectContaining({
                usdAmount: undefined,
                paid: false,
              }),
            )
          }
          const invoices = await WIBWithAmount.registerInvoice()

          if (invoices instanceof Error) throw invoices

          checkSecretAndHash(invoices)
          checkAmount(invoices)
          checkDescription(invoices)
          checkCreator(invoices)
          checkRecipientWallet(invoices)
        })
      })

      describe("with no amount", () => {
        it("registers and persists invoice", async () => {
          const WIBWithAmount = await WIBWithRecipient.withoutAmount()

          if (WIBWithAmount instanceof Error) throw WIBWithAmount
          const checkAmount = ({ lnInvoice, walletInvoice }: LnAndWalletInvoice) => {
            expect(lnInvoice).toEqual(
              expect.objectContaining({
                amount: 0 as Satoshis,
                paymentAmount: BtcPaymentAmount(BigInt(0)),
                milliSatsAmount: 0 as MilliSatoshis,
              }),
            )
            expect(walletInvoice).toEqual(
              expect.objectContaining({
                usdAmount: undefined,
                paid: false,
              }),
            )
          }
          const invoices = await WIBWithAmount.registerInvoice()

          if (invoices instanceof Error) throw invoices

          checkSecretAndHash(invoices)
          checkAmount(invoices)
          checkDescription(invoices)
          checkCreator(invoices)
          checkRecipientWallet(invoices)
        })
      })
    })

    describe("with usd recipient wallet", () => {
      const WIBWithRecipient = WIBWithCreator.withRecipientWallet(recipientUsdWallet)
      const checkRecipientWallet = ({ walletInvoice }: LnAndWalletInvoice) => {
        expect(walletInvoice.recipientWalletDescriptor).toEqual(recipientUsdWallet)
      }

      describe("with amount", () => {
        it("registers and persists invoice with conversion", async () => {
          const WIBWithAmount = await WIBWithRecipient.withAmount(uncheckedAmount)

          if (WIBWithAmount instanceof Error) throw WIBWithAmount
          const checkAmount = ({ lnInvoice, walletInvoice }: LnAndWalletInvoice) => {
            const convertedAmount = BigInt(uncheckedAmount) / dealerPriceRatio
            expect(lnInvoice).toEqual(
              expect.objectContaining({
                amount: Number(convertedAmount) as Satoshis,
                paymentAmount: BtcPaymentAmount(convertedAmount),
                milliSatsAmount: (1000 * Number(convertedAmount)) as MilliSatoshis,
              }),
            )
            expect(walletInvoice).toEqual(
              expect.objectContaining({
                usdAmount: {
                  currency: WalletCurrency.Usd,
                  amount: BigInt(uncheckedAmount),
                },
                paid: false,
              }),
            )
          }
          const invoices = await WIBWithAmount.registerInvoice()

          if (invoices instanceof Error) throw invoices

          checkSecretAndHash(invoices)
          checkAmount(invoices)
          checkDescription(invoices)
          checkCreator(invoices)
          checkRecipientWallet(invoices)
        })
      })

      describe("with no amount", () => {
        it("registers and persists invoice", async () => {
          const WIBWithAmount = await WIBWithRecipient.withoutAmount()

          if (WIBWithAmount instanceof Error) throw WIBWithAmount
          const checkAmount = ({ lnInvoice, walletInvoice }: LnAndWalletInvoice) => {
            expect(lnInvoice).toEqual(
              expect.objectContaining({
                amount: 0 as Satoshis,
                paymentAmount: BtcPaymentAmount(BigInt(0)),
                milliSatsAmount: 0 as MilliSatoshis,
              }),
            )
            expect(walletInvoice).toEqual(
              expect.objectContaining({
                usdAmount: undefined,
                paid: false,
              }),
            )
          }

          const invoices = await WIBWithAmount.registerInvoice()

          if (invoices instanceof Error) throw invoices

          checkSecretAndHash(invoices)
          checkAmount(invoices)
          checkDescription(invoices)
          checkCreator(invoices)
          checkRecipientWallet(invoices)
        })
      })
    })
  })
})
