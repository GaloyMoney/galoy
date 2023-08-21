import { checkedToAccountUuid } from "@domain/accounts"
import { AccountsRepository } from "@services/mongoose/accounts"
import { UsersRepository } from "@services/mongoose/users"
import { NotificationsService } from "@services/notifications"

export const sendAdminPushNotification = async ({
  accountId: accountIdRaw,
  title,
  body,
}: {
  accountId: string
  title: string
  body: string
}): Promise<true | ApplicationError> => {
  const accountId = checkedToAccountUuid(accountIdRaw)
  if (accountId instanceof Error) return accountId

  const accountsRepo = AccountsRepository()
  const account = await accountsRepo.findByUuid(accountId)
  if (account instanceof Error) return account
  const kratosUserId = account.kratosUserId

  const usersRepo = UsersRepository()
  const user = await usersRepo.findById(kratosUserId)
  if (user instanceof Error) return user

  const success = await NotificationsService().sendAdminPushNotification({
    deviceTokens: user.deviceTokens,
    title,
    body,
  })

  if (success instanceof Error) return success

  return success
}
