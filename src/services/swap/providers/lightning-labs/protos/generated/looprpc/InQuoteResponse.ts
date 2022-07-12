// Original file: ../loop.proto

import type { Long } from '@grpc/proto-loader';

export interface InQuoteResponse {
  'swapFeeSat'?: (number | string | Long);
  'htlcPublishFeeSat'?: (number | string | Long);
  'cltvDelta'?: (number);
  'confTarget'?: (number);
}

export interface InQuoteResponse__Output {
  'swapFeeSat': (string);
  'htlcPublishFeeSat': (string);
  'cltvDelta': (number);
  'confTarget': (number);
}
