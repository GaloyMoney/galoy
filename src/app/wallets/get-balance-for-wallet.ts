import { LedgerService } from "@services/ledger"
import { updatePendingPaymentsByWalletId } from "@app/payments"

export const getBalanceForWallet = async ({
  walletId,
  logger,
}: {
  walletId: WalletId
  logger: Logger
}): Promise<CurrencyBaseAmount | ApplicationError> => {
  const updatePaymentsResult = await updatePendingPaymentsByWalletId({
    walletId,
    logger,
  })
  if (updatePaymentsResult instanceof Error) return updatePaymentsResult

  return LedgerService().getWalletBalance(walletId)
}
