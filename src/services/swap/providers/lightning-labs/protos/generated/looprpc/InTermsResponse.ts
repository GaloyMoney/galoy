// Original file: ../loop.proto

import type { Long } from '@grpc/proto-loader';

export interface InTermsResponse {
  'minSwapAmount'?: (number | string | Long);
  'maxSwapAmount'?: (number | string | Long);
}

export interface InTermsResponse__Output {
  'minSwapAmount': (string);
  'maxSwapAmount': (string);
}
