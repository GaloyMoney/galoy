/* eslint-disable import/order */
/* eslint-disable prettier/prettier */
// Original file: ../loop.proto


import type { AutoReason as _looprpc_AutoReason } from '../looprpc/AutoReason';
import type { Long } from '@grpc/proto-loader';

export interface Disqualified {
  'channelId'?: (number | string | Long);
  'reason'?: (_looprpc_AutoReason | keyof typeof _looprpc_AutoReason);
  'pubkey'?: (Buffer | Uint8Array | string);
}

export interface Disqualified__Output {
  'channelId': (string);
  'reason': (keyof typeof _looprpc_AutoReason);
  'pubkey': (Buffer);
}
