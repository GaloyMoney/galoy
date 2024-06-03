import { UnknownLightningServiceError } from "@/domain/bitcoin/lightning"
import { LndService } from "@/services/lnd"
import { baseLogger } from "@/services/logger"
import { LnPaymentsRepository } from "@/services/mongoose/ln-payments"
import {
  addAttributesToCurrentSpan,
  asyncRunInSpan,
  SemanticAttributes,
} from "@/services/tracing"

export const updateLnPayments = async (): Promise<true | ApplicationError> => {
  let processedLnPaymentsHashes: PaymentHash[] | ApplicationError = []

  const incompleteLnPayments = await LnPaymentsRepository().listIncomplete()
  if (incompleteLnPayments instanceof Error) return incompleteLnPayments

  const pubkeysFromPayments = new Set(incompleteLnPayments.map((p) => p.sentFromPubkey))

  const lndService = LndService()
  if (lndService instanceof Error) return lndService

  const listFns: ListLnPayments[] = [
    lndService.listSettledPayments,
    lndService.listFailedPayments,
  ]
  const pubkeys = lndService
    .listActivePubkeys()
    .filter((pubkey) => pubkeysFromPayments.has(pubkey))

  for (const idx in pubkeys)
    addAttributesToCurrentSpan({ [`pubkey.${idx}`]: pubkeys[idx] })

  for (const listFn of listFns) {
    for (const pubkey of pubkeys) {
      processedLnPaymentsHashes = await updateLnPaymentsByFunction({
        processedLnPaymentsHashes,
        incompleteLnPayments,
        pubkey,
        listFn,
      })
    }
  }
  return true
}

const updateLnPaymentsByFunction = async ({
  processedLnPaymentsHashes,
  incompleteLnPayments,
  pubkey,
  listFn,
}: {
  processedLnPaymentsHashes: PaymentHash[]
  incompleteLnPayments: PersistedLnPaymentLookup[]
  pubkey: Pubkey
  listFn: ListLnPayments
}): Promise<PaymentHash[]> => {
  let after: PagingStartToken | PagingContinueToken | PagingStopToken = undefined
  let updatedProcessedHashes = processedLnPaymentsHashes
  while (updatedProcessedHashes.length < incompleteLnPayments.length && after !== false) {
    const results:
      | LightningError
      | {
          after: PagingContinueToken | PagingStopToken
          processedLnPaymentsHashes: PaymentHash[]
        } = await asyncRunInSpan(
      "app.lightning.updateLnPaymentsPaginated",
      {
        attributes: {
          [SemanticAttributes.CODE_FUNCTION]: "updateLnPaymentsPaginated",
          [SemanticAttributes.CODE_NAMESPACE]: "app.lightning",
          [`${SemanticAttributes.CODE_FUNCTION}.params.cursor`]: String(after),
          [`${SemanticAttributes.CODE_FUNCTION}.params.listPaymentsMethod`]: listFn.name,
          [`${SemanticAttributes.CODE_FUNCTION}.params.pubkey`]: pubkey,
          [`${SemanticAttributes.CODE_FUNCTION}.params.totalIncomplete`]:
            incompleteLnPayments.length,
          [`${SemanticAttributes.CODE_FUNCTION}.params.processedCount`]:
            updatedProcessedHashes.length,
        },
      },
      async () => {
        if (after === false) return new UnknownLightningServiceError()
        return updateLnPaymentsPaginated({
          processedLnPaymentsHashes: updatedProcessedHashes,
          incompleteLnPayments,
          after,
          pubkey,
          listFn,
        })
      },
    )
    if (results instanceof Error) break
    ;({ after, processedLnPaymentsHashes: updatedProcessedHashes } = results)
  }

  return updatedProcessedHashes
}

const updateLnPaymentsPaginated = async ({
  processedLnPaymentsHashes,
  incompleteLnPayments,
  after,
  pubkey,
  listFn,
}: {
  processedLnPaymentsHashes: PaymentHash[]
  incompleteLnPayments: PersistedLnPaymentLookup[]
  after: PagingStartToken | PagingContinueToken
  pubkey: Pubkey
  listFn: ListLnPayments
}): Promise<
  | {
      after: PagingContinueToken | PagingStopToken
      processedLnPaymentsHashes: PaymentHash[]
    }
  | LightningError
> => {
  // Fetch from Lightning service
  const results: ListLnPaymentsResult | LightningServiceError = await listFn({
    pubkey,
    after,
  })
  if (results instanceof Error) {
    baseLogger.error({ error: results }, `Could not fetch payments for pubkey ${pubkey}`)
    return results
  }
  if (after === results.endCursor) return new UnknownLightningServiceError()
  const updatedAfter = results.endCursor

  // Update LnPayments repository
  for (const payment of results.lnPayments) {
    const persistedPaymentLookup = incompleteLnPayments.find(
      (elem) => elem.paymentHash === payment.paymentHash,
    )
    if (!persistedPaymentLookup) return { after: updatedAfter, processedLnPaymentsHashes }

    persistedPaymentLookup.sentFromPubkey = pubkey

    persistedPaymentLookup.createdAt = payment.createdAt
    persistedPaymentLookup.status = payment.status
    persistedPaymentLookup.milliSatsAmount = payment.milliSatsAmount
    persistedPaymentLookup.roundedUpAmount = payment.roundedUpAmount
    persistedPaymentLookup.confirmedDetails = payment.confirmedDetails
    persistedPaymentLookup.attempts = payment.attempts

    persistedPaymentLookup.isCompleteRecord = true

    const updatedPaymentLookup =
      await LnPaymentsRepository().update(persistedPaymentLookup)
    if (updatedPaymentLookup instanceof Error) {
      baseLogger.error(
        { error: updatedPaymentLookup },
        "Could not update LnPayments repository",
      )
      return { after: updatedAfter, processedLnPaymentsHashes }
    }
    processedLnPaymentsHashes.push(payment.paymentHash)
  }
  return { after: updatedAfter, processedLnPaymentsHashes }
}
