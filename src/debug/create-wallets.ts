/**
 * how to run:
 *
 * Make sure there's a file named reimbursements.json in src/debug
 * following the structure:
 * {
 *  "feeUpdateOperations" = [
 *    { "walletId": "first-wallet-id", fee: 13, memo: "your memo" },
 *    { "walletId": "second-wallet-id", fee: 10, memo: "refund" },
 *  ]
 * }
 * yarn ts-node --files -r tsconfig-paths/register src/debug/reimburse.ts
 */

import { intraledgerPaymentSendWalletId } from "@app/wallets"
import { BTC_NETWORK, JWT_SECRET } from "@config"
import { checkedToSats } from "@domain/bitcoin"
import { checkedToWalletId, WalletCurrency, WalletType } from "@domain/wallets"
import { createToken } from "@services/jwt"
import { baseLogger } from "@services/logger"
import { setupMongoConnection } from "@services/mongodb"
import { AccountsRepository, WalletsRepository } from "@services/mongoose"
import { User } from "@services/mongoose/schema"
import * as jwt from "jsonwebtoken"

import { reimbursements } from "./reimbursements.json"

type reimbursement = {
  recipientWalletId: string
  amount: number
  memo: string
}

const getRandomInvalidPhone = () => {
  return `+abc${Math.floor(Math.random() * 999_999_999_999_999)}`
}

type generatedWallets = {
  accountId: AccountId
  btcWalletId: WalletId
  usdWalletId: WalletId
  jwtToken: JwtToken
}

const generateWallets = async (count: number) => {
  await setupMongoConnection()
  const wallets: Array<generatedWallets> = []
  for (let i = 0; i < count; i++) {
    const phone = getRandomInvalidPhone() as PhoneNumber
    const account = await User.create({ phone })

    const btcWallet = await WalletsRepository().persistNew({
      accountId: account._id,
      type: WalletType.Checking,
      currency: WalletCurrency.Btc,
    })
    if (btcWallet instanceof Error) return btcWallet

    const usdWallet = await WalletsRepository().persistNew({
      accountId: account._id,
      type: WalletType.Checking,
      currency: WalletCurrency.Usd,
    })

    if (usdWallet instanceof Error) return usdWallet

    const network = BTC_NETWORK

    const jwtToken = createToken({ uid: account._id, network })

    wallets.push({
      accountId: account._id,
      btcWalletId: btcWallet.id,
      usdWalletId: usdWallet.id,
      jwtToken,
    })

    console.log("verify", jwt.verify(jwtToken, JWT_SECRET))
  }

  return wallets
}

const main = async () => {
  const args = process.argv
  if (args.length === 5) {
    const numWallets = parseInt(args[2])

    const disbursementAmount = checkedToSats(parseInt(args[4]))
    if (disbursementAmount instanceof Error) return disbursementAmount

    const disburserWalletId = checkedToWalletId(args[3])
    if (disburserWalletId instanceof Error) return disburserWalletId

    const wallets = await generateWallets(numWallets)
    console.log({ wallets })
  } else {
    console.error("Invalid number of arguments")
  }
}

setupMongoConnection()
  .then(async (mongoose) => {
    await main()
    console.log(mongoose.connection.status)
  })
  .catch((err) => console.log(err))
