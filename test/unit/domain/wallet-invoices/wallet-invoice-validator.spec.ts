import { AlreadyPaidError, SelfPaymentError } from "@domain/errors"
import { WalletInvoiceValidator } from "@domain/wallet-invoices"
import { WalletCurrency } from "@domain/shared"

describe("WalletInvoiceValidator", () => {
  const walletInvoice: WalletInvoice = {
    paymentHash: "paymentHash" as PaymentHash,
    secret: "secret" as SecretPreImage,
    recipientWalletDescriptor: {
      id: "toWalletId" as WalletId,
      currency: WalletCurrency.Btc,
    },
    selfGenerated: false,
    pubkey: "pubkey" as Pubkey,
    usdAmount: {
      currency: WalletCurrency.Usd,
      amount: BigInt(10),
    },
    paid: false,
  }
  const fromWalletId = "fromWalletId" as WalletId

  it("passes for unpaid invoice and valid recipient wallet", () => {
    walletInvoice.paid = false
    const walletInvoiceValidator = WalletInvoiceValidator(walletInvoice)

    const validatorResult = walletInvoiceValidator.validateToSend(fromWalletId)
    expect(validatorResult).not.toBeInstanceOf(Error)
  })

  it("fails for self recipient wallet", () => {
    walletInvoice.paid = false
    const walletInvoiceValidator = WalletInvoiceValidator(walletInvoice)

    const validatorResult = walletInvoiceValidator.validateToSend(
      walletInvoice.recipientWalletDescriptor.id,
    )
    expect(validatorResult).toBeInstanceOf(SelfPaymentError)
  })

  it("fails for non-pending invoice and valid recipient wallet", () => {
    walletInvoice.paid = true
    const walletInvoiceValidator = WalletInvoiceValidator(walletInvoice)

    const validatorResult = walletInvoiceValidator.validateToSend(fromWalletId)
    expect(validatorResult).toBeInstanceOf(AlreadyPaidError)
  })
})
