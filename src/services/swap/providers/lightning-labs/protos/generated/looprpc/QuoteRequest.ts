// Original file: ../loop.proto

import type { Long } from '@grpc/proto-loader';

export interface QuoteRequest {
  'amt'?: (number | string | Long);
  'confTarget'?: (number);
  'externalHtlc'?: (boolean);
  'swapPublicationDeadline'?: (number | string | Long);
  'loopInLastHop'?: (Buffer | Uint8Array | string);
  'private'?: (boolean);
}

export interface QuoteRequest__Output {
  'amt': (string);
  'confTarget': (number);
  'externalHtlc': (boolean);
  'swapPublicationDeadline': (string);
  'loopInLastHop': (Buffer);
  'private': (boolean);
}
