import { checkedToSats, toSats } from "@domain/bitcoin"
import { invoiceExpirationForCurrency } from "@domain/bitcoin/lightning"
import { checkedToUsername } from "@domain/users"
import { WalletInvoiceFactory } from "@domain/wallet-invoices/wallet-invoice-factory"
import { LndService } from "@services/lnd"
import {
  WalletInvoicesRepository,
  UsersRepository,
  AccountsRepository,
} from "@services/mongoose"

export const addInvoice = async ({
  walletId,
  amount,
  memo = "",
}: AddInvoiceArgs): Promise<LnInvoice | ApplicationError> => {
  const sats = checkedToSats(amount)
  if (sats instanceof Error) return sats

  const walletInvoiceFactory = WalletInvoiceFactory(walletId)
  return registerAndPersistInvoice({
    sats,
    memo,
    walletInvoiceCreateFn: walletInvoiceFactory.create,
  })
}

export const addInvoiceNoAmount = async ({
  walletId,
  memo = "",
}: AddInvoiceNoAmountArgs): Promise<LnInvoice | ApplicationError> => {
  const walletInvoiceFactory = WalletInvoiceFactory(walletId)
  return registerAndPersistInvoice({
    sats: toSats(0),
    memo,
    walletInvoiceCreateFn: walletInvoiceFactory.create,
  })
}

export const addInvoiceForRecipient = async ({
  recipient,
  amount,
  memo = "",
}: AddInvoiceForRecipientArgs): Promise<LnInvoice | ApplicationError> => {
  const username = checkedToUsername(recipient)
  if (username instanceof Error) return username
  const sats = checkedToSats(amount)
  if (sats instanceof Error) return sats

  const walletId = await walletIdFromUsername(username)
  if (walletId instanceof Error) return walletId

  const walletInvoiceFactory = WalletInvoiceFactory(walletId)
  return registerAndPersistInvoice({
    sats,
    memo,
    walletInvoiceCreateFn: walletInvoiceFactory.createForRecipient,
  })
}

export const addInvoiceNoAmountForRecipient = async ({
  recipient,
  memo = "",
}: AddInvoiceNoAmountForRecipientArgs): Promise<LnInvoice | ApplicationError> => {
  const username = checkedToUsername(recipient)
  if (username instanceof Error) return username

  const walletId = await walletIdFromUsername(username)
  if (walletId instanceof Error) return walletId

  const walletInvoiceFactory = WalletInvoiceFactory(walletId)
  return registerAndPersistInvoice({
    sats: toSats(0),
    memo,
    walletInvoiceCreateFn: walletInvoiceFactory.createForRecipient,
  })
}

const registerAndPersistInvoice = async ({
  sats,
  memo,
  walletInvoiceCreateFn,
}: {
  sats: Satoshis
  memo: string
  walletInvoiceCreateFn: WalletInvoiceFactoryCreateMethod
}): Promise<LnInvoice | ApplicationError> => {
  const walletInvoicesRepo = WalletInvoicesRepository()
  const lndService = LndService()
  if (lndService instanceof Error) return lndService

  const registeredInvoice = await lndService.registerInvoice({
    description: memo,
    satoshis: sats,
    expiresAt: invoiceExpirationForCurrency("BTC", new Date()),
  })
  if (registeredInvoice instanceof Error) return registeredInvoice
  const { invoice } = registeredInvoice

  const walletInvoice = walletInvoiceCreateFn({
    registeredInvoice,
  })
  const persistedWalletInvoice = await walletInvoicesRepo.persist(walletInvoice)
  if (persistedWalletInvoice instanceof Error) return persistedWalletInvoice

  return invoice
}

const walletIdFromUsername = async (
  username: Username,
): Promise<WalletId | RepositoryError> => {
  const usersRepo = UsersRepository()
  const accountsRepo = AccountsRepository()

  const user = await usersRepo.findByUsername(username)
  if (user instanceof Error) return user

  const defaultAccount = await accountsRepo.findById(user.defaultAccountId)
  if (defaultAccount instanceof Error) return defaultAccount

  return defaultAccount.walletIds[0]
}
