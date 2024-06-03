import { ErrorLevel } from "@/domain/shared"
import { CouldNotFindLnPaymentFromHashError } from "@/domain/errors"
import { UnknownLightningServiceError } from "@/domain/bitcoin/lightning"

import {
  addAttributesToCurrentSpan,
  asyncRunInSpan,
  recordExceptionInCurrentSpan,
  SemanticAttributes,
} from "@/services/tracing"
import { LndService } from "@/services/lnd"
import { LnPaymentsRepository } from "@/services/mongoose"

export const deleteLnPaymentsBefore = async (
  timestamp: Date,
): Promise<true | ApplicationError> => {
  const paymentHashesBefore = listAllPaymentsBefore(timestamp)

  for await (const paymentHashAndPubkey of paymentHashesBefore) {
    if (paymentHashAndPubkey instanceof Error) return paymentHashAndPubkey
    await checkAndDeletePaymentForHash(paymentHashAndPubkey)
  }

  return true
}

const checkAndDeletePaymentForHash = async ({
  paymentHash,
  pubkey,
}: {
  paymentHash: PaymentHash
  pubkey: Pubkey
}): Promise<boolean | ApplicationError> =>
  asyncRunInSpan(
    "app.lightning.checkAndDeletePaymentForHash",
    {
      attributes: {
        [SemanticAttributes.CODE_FUNCTION]: "checkAndDeletePaymentForHash",
        [SemanticAttributes.CODE_NAMESPACE]: "lightning",
        paymentHash,
        pubkey,
        deleted: false,
      },
    },
    async () => {
      const lnPayment = await LnPaymentsRepository().findByPaymentHash(paymentHash)
      if (lnPayment instanceof Error) {
        if (lnPayment instanceof CouldNotFindLnPaymentFromHashError) {
          // Attempt to get paymentRequest from lnd
          const lndService = LndService()
          if (lndService instanceof Error) return lndService
          const lnPaymentLookup = await lndService.lookupPayment({ pubkey, paymentHash })
          if (lnPaymentLookup instanceof Error) return lnPaymentLookup
          const { paymentRequest, confirmedDetails } =
            "createdAt" in lnPaymentLookup
              ? lnPaymentLookup
              : { paymentRequest: undefined, confirmedDetails: undefined }

          // only record exception when payment is not a rebalance
          if (confirmedDetails && !lndService.isLocal(confirmedDetails.destination)) {
            recordExceptionInCurrentSpan({ error: lnPayment, level: ErrorLevel.Critical })
          }

          await LnPaymentsRepository().persistNew({
            paymentHash,
            paymentRequest,
            sentFromPubkey: pubkey,
          })

          addAttributesToCurrentSpan({ existedInRepository: false })
          return false
        }
        addAttributesToCurrentSpan({ ["existedInRepository.undefined"]: true })
        return lnPayment
      }

      addAttributesToCurrentSpan({
        existedInRepository: true,
        isCompleteRecord: lnPayment.isCompleteRecord,
      })
      if (!lnPayment.isCompleteRecord) return false

      const lndService = LndService()
      if (lndService instanceof Error) return lndService

      const deleted = lndService.deletePaymentByHash({ paymentHash, pubkey })
      if (deleted instanceof Error) return deleted
      addAttributesToCurrentSpan({ deleted: true })

      return true
    },
  )

const listAllPaymentsBefore = async function* (
  timestamp: Date,
): AsyncGenerator<{ paymentHash: PaymentHash; pubkey: Pubkey } | LightningServiceError> {
  const lndService = LndService()
  if (lndService instanceof Error) {
    yield lndService
    return
  }
  const pubkeys: Pubkey[] = lndService.listActivePubkeys()
  const listFns: ListLnPayments[] = [
    lndService.listSettledPayments,
    lndService.listFailedPayments,
  ]

  for (const pubkey of pubkeys) {
    for (const listFn of listFns) {
      let after: PagingStartToken | PagingContinueToken | PagingStopToken = undefined
      while (after !== false) {
        const result: ListLnPaymentsResult | LightningServiceError = await listFn({
          after,
          pubkey,
        })
        if (result instanceof Error) {
          yield result
          return
        }

        if (after === result.endCursor) {
          yield new UnknownLightningServiceError()
          return
        }
        after = result.endCursor

        for (const payment of result.lnPayments) {
          if (payment.createdAt < timestamp) {
            yield { paymentHash: payment.paymentHash, pubkey }
          }
        }
      }
    }
  }
}
