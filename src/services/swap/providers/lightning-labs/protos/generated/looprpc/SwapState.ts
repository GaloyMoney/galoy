// Original file: ../loop.proto

export enum SwapState {
  INITIATED = 0,
  PREIMAGE_REVEALED = 1,
  HTLC_PUBLISHED = 2,
  SUCCESS = 3,
  FAILED = 4,
  INVOICE_SETTLED = 5,
}
