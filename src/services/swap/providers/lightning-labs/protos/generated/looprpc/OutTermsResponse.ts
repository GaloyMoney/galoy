// Original file: ../loop.proto

import type { Long } from '@grpc/proto-loader';

export interface OutTermsResponse {
  'minSwapAmount'?: (number | string | Long);
  'maxSwapAmount'?: (number | string | Long);
  'minCltvDelta'?: (number);
  'maxCltvDelta'?: (number);
}

export interface OutTermsResponse__Output {
  'minSwapAmount': (string);
  'maxSwapAmount': (string);
  'minCltvDelta': (number);
  'maxCltvDelta': (number);
}
