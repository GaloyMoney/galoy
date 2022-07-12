// Original file: ../loop.proto

import type { Long } from '@grpc/proto-loader';

export interface ProbeRequest {
  'amt'?: (number | string | Long);
  'lastHop'?: (Buffer | Uint8Array | string);
}

export interface ProbeRequest__Output {
  'amt': (string);
  'lastHop': (Buffer);
}
