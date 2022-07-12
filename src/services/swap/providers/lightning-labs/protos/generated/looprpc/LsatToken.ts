// Original file: ../loop.proto

import type { Long } from '@grpc/proto-loader';

export interface LsatToken {
  'baseMacaroon'?: (Buffer | Uint8Array | string);
  'paymentHash'?: (Buffer | Uint8Array | string);
  'paymentPreimage'?: (Buffer | Uint8Array | string);
  'amountPaidMsat'?: (number | string | Long);
  'routingFeePaidMsat'?: (number | string | Long);
  'timeCreated'?: (number | string | Long);
  'expired'?: (boolean);
  'storageName'?: (string);
}

export interface LsatToken__Output {
  'baseMacaroon': (Buffer);
  'paymentHash': (Buffer);
  'paymentPreimage': (Buffer);
  'amountPaidMsat': (string);
  'routingFeePaidMsat': (string);
  'timeCreated': (string);
  'expired': (boolean);
  'storageName': (string);
}
