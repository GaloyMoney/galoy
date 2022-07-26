import crypto from "crypto"

import { WalletCurrency } from "@domain/shared"
import { getSecretAndPaymentHash } from "@domain/bitcoin/lightning"
import { WalletInvoicesRepository } from "@services/mongoose"

import { createUserAndWalletFromUserRef } from "test/helpers"

beforeAll(async () => {
  await createUserAndWalletFromUserRef("B")
})

const createTestWalletInvoice = (): WalletInvoice => {
  return {
    ...getSecretAndPaymentHash(),
    selfGenerated: false,
    pubkey: "pubkey" as Pubkey,
    paid: false,
    recipientWalletDescriptor: {
      currency: WalletCurrency.Btc,
      id: crypto.randomUUID() as WalletId,
    },
    usdAmount: {
      currency: WalletCurrency.Usd,
      amount: 10n,
    },
  }
}

describe("WalletInvoices", () => {
  it("persists and finds an invoice", async () => {
    const repo = WalletInvoicesRepository()
    const invoiceToPersist = createTestWalletInvoice()
    const persistResult = await repo.persistNew(invoiceToPersist)
    expect(persistResult).not.toBeInstanceOf(Error)

    const { paymentHash } = persistResult as WalletInvoice
    const lookedUpInvoice = await repo.findByPaymentHash(paymentHash)
    expect(lookedUpInvoice).not.toBeInstanceOf(Error)
    expect(lookedUpInvoice).toEqual(invoiceToPersist)
  })

  it("updates an invoice", async () => {
    const repo = WalletInvoicesRepository()
    const invoiceToPersist = createTestWalletInvoice()
    const persistResult = await repo.persistNew(invoiceToPersist)
    expect(persistResult).not.toBeInstanceOf(Error)

    const invoiceToUpdate = persistResult as WalletInvoice
    const updatedResult = await repo.markAsPaid(invoiceToUpdate.paymentHash)
    expect(updatedResult).not.toBeInstanceOf(Error)
    expect(updatedResult).toHaveProperty("paid", true)

    const { paymentHash } = updatedResult as WalletInvoice
    const lookedUpInvoice = await repo.findByPaymentHash(paymentHash)
    expect(lookedUpInvoice).not.toBeInstanceOf(Error)
    expect(lookedUpInvoice).toEqual(updatedResult)
    expect(lookedUpInvoice).toHaveProperty("paid", true)
  })

  it("deletes an invoice by hash", async () => {
    const repo = WalletInvoicesRepository()
    const invoiceToPersist = createTestWalletInvoice()
    const persistResult = await repo.persistNew(invoiceToPersist)
    expect(persistResult).not.toBeInstanceOf(Error)

    const { paymentHash } = persistResult as WalletInvoice
    const isDeleted = await repo.deleteByPaymentHash(paymentHash)
    expect(isDeleted).not.toBeInstanceOf(Error)
    expect(isDeleted).toEqual(true)
  })
})
