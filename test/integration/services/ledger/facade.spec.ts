import crypto from "crypto"

import { BtcWalletDescriptor, UsdWalletDescriptor, WalletCurrency } from "@domain/shared"
import * as LedgerFacade from "@services/ledger/facade"

import {
  recordLnIntraLedgerPayment,
  recordReceiveLnPayment,
  recordSendLnPayment,
} from "./helpers"

describe("Facade", () => {
  const receiveAmount = {
    usd: { amount: 100n, currency: WalletCurrency.Usd },
    btc: { amount: 200n, currency: WalletCurrency.Btc },
  }
  const sendAmount = {
    usd: { amount: 20n, currency: WalletCurrency.Usd },
    btc: { amount: 40n, currency: WalletCurrency.Btc },
  }
  const bankFee = {
    usd: { amount: 10n, currency: WalletCurrency.Usd },
    btc: { amount: 20n, currency: WalletCurrency.Btc },
  }

  describe("recordReceive", () => {
    it("receives to btc wallet", async () => {
      const btcWalletDescriptor = BtcWalletDescriptor(crypto.randomUUID() as WalletId)
      await recordReceiveLnPayment({
        walletDescriptor: btcWalletDescriptor,
        paymentAmount: receiveAmount,
        bankFee,
      })

      const balance = await LedgerFacade.getLedgerAccountBalanceForWalletId(
        btcWalletDescriptor,
      )
      if (balance instanceof Error) throw balance
      expect(balance).toEqual(
        expect.objectContaining({
          amount: receiveAmount.btc.amount,
          currency: WalletCurrency.Btc,
        }),
      )
    })
  })

  describe("recordSend", () => {
    it("sends from btc wallet", async () => {
      const btcWalletDescriptor = BtcWalletDescriptor(crypto.randomUUID() as WalletId)

      const startingBalance = await LedgerFacade.getLedgerAccountBalanceForWalletId(
        btcWalletDescriptor,
      )
      if (startingBalance instanceof Error) throw startingBalance

      await recordSendLnPayment({
        walletDescriptor: btcWalletDescriptor,
        paymentAmount: sendAmount,
        bankFee,
      })

      const balance = await LedgerFacade.getLedgerAccountBalanceForWalletId(
        btcWalletDescriptor,
      )
      if (balance instanceof Error) throw balance
      expect(balance).toEqual(
        expect.objectContaining({
          amount: startingBalance.amount - sendAmount.btc.amount,
          currency: WalletCurrency.Btc,
        }),
      )
    })
  })

  describe("recordIntraledger", () => {
    it("sends from btc wallet to usd wallet", async () => {
      const btcWalletDescriptor = BtcWalletDescriptor(crypto.randomUUID() as WalletId)
      const usdWalletDescriptor = UsdWalletDescriptor(crypto.randomUUID() as WalletId)

      const startingBalanceSender = await LedgerFacade.getLedgerAccountBalanceForWalletId(
        btcWalletDescriptor,
      )
      if (startingBalanceSender instanceof Error) throw startingBalanceSender

      await recordLnIntraLedgerPayment({
        senderWalletDescriptor: btcWalletDescriptor,
        recipientWalletDescriptor: usdWalletDescriptor,
        paymentAmount: sendAmount,
      })

      const finishBalanceSender = await LedgerFacade.getLedgerAccountBalanceForWalletId(
        btcWalletDescriptor,
      )
      if (finishBalanceSender instanceof Error) throw finishBalanceSender
      expect(finishBalanceSender).toEqual(
        expect.objectContaining({
          amount: startingBalanceSender.amount - sendAmount.btc.amount,
          currency: WalletCurrency.Btc,
        }),
      )

      const finishBalanceReceiver = await LedgerFacade.getLedgerAccountBalanceForWalletId(
        usdWalletDescriptor,
      )
      if (finishBalanceReceiver instanceof Error) throw finishBalanceReceiver
      expect(finishBalanceReceiver).toEqual(
        expect.objectContaining({
          amount: sendAmount.usd.amount,
          currency: WalletCurrency.Usd,
        }),
      )
    })
  })
})
