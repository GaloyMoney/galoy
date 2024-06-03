type LnPaymentPartial = {
  readonly paymentHash: PaymentHash
  readonly paymentRequest: EncodedPaymentRequest | undefined
  readonly sentFromPubkey: Pubkey | undefined
}

// Makes all properties non-readonly except the properties passed in as K
type Writeable<T, K extends keyof T> = Pick<T, K> & {
  -readonly [P in keyof T as Exclude<P, K>]: T[P]
}

type PersistedLnPaymentLookup = Writeable<LnPaymentLookup, "paymentHash"> & {
  sentFromPubkey: Pubkey
  isCompleteRecord: boolean
}

interface ILnPaymentsRepository {
  findByPaymentHash(
    paymentHash: PaymentHash,
  ): Promise<PersistedLnPaymentLookup | RepositoryError>
  listIncomplete(): Promise<PersistedLnPaymentLookup[] | RepositoryError>
  persistNew(
    lnPaymentPartial: LnPaymentPartial,
  ): Promise<LnPaymentPartial | RepositoryError>
  update(
    lnPayment: PersistedLnPaymentLookup,
  ): Promise<PersistedLnPaymentLookup | RepositoryError>
}
