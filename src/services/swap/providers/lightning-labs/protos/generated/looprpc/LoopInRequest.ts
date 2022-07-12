// Original file: ../loop.proto

import type { Long } from '@grpc/proto-loader';

export interface LoopInRequest {
  'amt'?: (number | string | Long);
  'maxSwapFee'?: (number | string | Long);
  'maxMinerFee'?: (number | string | Long);
  'lastHop'?: (Buffer | Uint8Array | string);
  'externalHtlc'?: (boolean);
  'htlcConfTarget'?: (number);
  'label'?: (string);
  'initiator'?: (string);
  'private'?: (boolean);
}

export interface LoopInRequest__Output {
  'amt': (string);
  'maxSwapFee': (string);
  'maxMinerFee': (string);
  'lastHop': (Buffer);
  'externalHtlc': (boolean);
  'htlcConfTarget': (number);
  'label': (string);
  'initiator': (string);
  'private': (boolean);
}
