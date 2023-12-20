import { intraledgerPaymentSendWalletIdForBtcWallet } from "../payments/send-intraledger"

import { QuizzesValue } from "@/domain/earn"

import { getQuizzesConfig } from "@/config"

import { getBalanceForWallet } from "@/app/wallets"

import {
  InvalidIpMetadataError,
  InvalidQuizQuestionIdError,
  MissingIPMetadataError,
  NoBtcWalletExistsForAccountError,
  NotEnoughBalanceForQuizError,
  UnauthorizedIPError,
  UnknownRepositoryError,
} from "@/domain/errors"
import { WalletCurrency } from "@/domain/shared"
import { RateLimitConfig } from "@/domain/rate-limit"
import { checkedToAccountId } from "@/domain/accounts"
import { PhoneMetadataAuthorizer } from "@/domain/users"
import { InvalidPhoneForQuizError } from "@/domain/users/errors"
import { RateLimiterExceededError } from "@/domain/rate-limit/errors"
import { IPMetadataAuthorizer } from "@/domain/accounts-ips/ip-metadata-authorizer"

import {
  AccountsRepository,
  QuizRepository,
  WalletsRepository,
  UsersRepository,
} from "@/services/mongoose"
import { consumeLimiter } from "@/services/rate-limit"
import { getFunderWalletId } from "@/services/ledger/caching"
import { AccountsIpsRepository } from "@/services/mongoose/accounts-ips"

export const completeQuiz = async ({
  quizQuestionId: quizQuestionIdString,
  accountId: accountIdRaw,
  ip,
}: {
  quizQuestionId: string
  accountId: string
  ip: IpAddress | undefined
}): Promise<QuizQuestion | ApplicationError> => {
  const check = await checkAddQuizAttemptPerIpLimits(ip)
  if (check instanceof Error) return check

  const accountId = checkedToAccountId(accountIdRaw)
  if (accountId instanceof Error) return accountId

  const quizzesConfig = getQuizzesConfig()

  // TODO: quizQuestionId checkedFor
  const quizQuestionId = quizQuestionIdString as QuizQuestionId

  const amount = QuizzesValue[quizQuestionId]
  if (!amount) return new InvalidQuizQuestionIdError()

  const funderWalletId = await getFunderWalletId()
  const funderWallet = await WalletsRepository().findById(funderWalletId)
  if (funderWallet instanceof Error) return funderWallet
  const funderAccount = await AccountsRepository().findById(funderWallet.accountId)
  if (funderAccount instanceof Error) return funderAccount

  const recipientAccount = await AccountsRepository().findById(accountId)
  if (recipientAccount instanceof Error) return recipientAccount

  const user = await UsersRepository().findById(recipientAccount.kratosUserId)
  if (user instanceof Error) return user

  const validatedPhoneMetadata = PhoneMetadataAuthorizer(
    quizzesConfig.phoneMetadataValidationSettings,
  ).authorize(user.phoneMetadata)

  if (validatedPhoneMetadata instanceof Error) {
    return new InvalidPhoneForQuizError(validatedPhoneMetadata.name)
  }

  const accountIP = await AccountsIpsRepository().findLastByAccountId(recipientAccount.id)
  if (accountIP instanceof Error) return accountIP

  const validatedIPMetadata = IPMetadataAuthorizer(
    quizzesConfig.ipMetadataValidationSettings,
  ).authorize(accountIP.metadata)
  if (validatedIPMetadata instanceof Error) {
    if (validatedIPMetadata instanceof MissingIPMetadataError)
      return new InvalidIpMetadataError(validatedIPMetadata)

    if (validatedIPMetadata instanceof UnauthorizedIPError) return validatedIPMetadata

    return new UnknownRepositoryError("add quiz error")
  }

  const recipientWallets = await WalletsRepository().listByAccountId(accountId)
  if (recipientWallets instanceof Error) return recipientWallets

  const recipientBtcWallet = recipientWallets.find(
    (wallet) => wallet.currency === WalletCurrency.Btc,
  )
  if (recipientBtcWallet === undefined) return new NoBtcWalletExistsForAccountError()
  const recipientWalletId = recipientBtcWallet.id

  const shouldGiveSats = await QuizRepository(accountId).add(quizQuestionId)
  if (shouldGiveSats instanceof Error) return shouldGiveSats

  const funderBalance = await getBalanceForWallet({ walletId: funderWalletId })
  if (funderBalance instanceof Error) return funderBalance

  const sendCheck = FunderBalanceChecker().check({
    balance: funderBalance as Satoshis,
    amountToSend: amount,
  })
  if (sendCheck instanceof Error) return sendCheck

  const payment = await intraledgerPaymentSendWalletIdForBtcWallet({
    senderWalletId: funderWalletId,
    recipientWalletId,
    amount,
    memo: quizQuestionId,
    senderAccount: funderAccount,
  })
  if (payment instanceof Error) return payment

  return { id: quizQuestionId, earnAmount: amount }
}

const checkAddQuizAttemptPerIpLimits = async (
  ip: IpAddress | undefined,
): Promise<true | RateLimiterExceededError> => {
  if (!ip) return new InvalidIpMetadataError()

  return consumeLimiter({
    rateLimitConfig: RateLimitConfig.addQuizAttemptPerIp,
    keyToConsume: ip,
  })
}

const FunderBalanceChecker = () => {
  const check = ({
    balance,
    amountToSend,
  }: {
    balance: Satoshis
    amountToSend: Satoshis
  }): ValidationError | true => {
    if (balance < amountToSend) {
      return new NotEnoughBalanceForQuizError(JSON.stringify({ balance, amountToSend }))
    }

    return true
  }

  return { check }
}
