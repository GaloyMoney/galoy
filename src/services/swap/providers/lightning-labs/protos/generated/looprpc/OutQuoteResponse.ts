// Original file: ../loop.proto

import type { Long } from '@grpc/proto-loader';

export interface OutQuoteResponse {
  'swapFeeSat'?: (number | string | Long);
  'prepayAmtSat'?: (number | string | Long);
  'htlcSweepFeeSat'?: (number | string | Long);
  'swapPaymentDest'?: (Buffer | Uint8Array | string);
  'cltvDelta'?: (number);
  'confTarget'?: (number);
}

export interface OutQuoteResponse__Output {
  'swapFeeSat': (string);
  'prepayAmtSat': (string);
  'htlcSweepFeeSat': (string);
  'swapPaymentDest': (Buffer);
  'cltvDelta': (number);
  'confTarget': (number);
}
