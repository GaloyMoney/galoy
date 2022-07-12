// Original file: ../loop.proto

import type { SwapType as _looprpc_SwapType } from '../looprpc/SwapType';
import type { SwapState as _looprpc_SwapState } from '../looprpc/SwapState';
import type { FailureReason as _looprpc_FailureReason } from '../looprpc/FailureReason';
import type { Long } from '@grpc/proto-loader';

export interface SwapStatus {
  'amt'?: (number | string | Long);
  'id'?: (string);
  'type'?: (_looprpc_SwapType | keyof typeof _looprpc_SwapType);
  'state'?: (_looprpc_SwapState | keyof typeof _looprpc_SwapState);
  'initiationTime'?: (number | string | Long);
  'lastUpdateTime'?: (number | string | Long);
  'htlcAddress'?: (string);
  'costServer'?: (number | string | Long);
  'costOnchain'?: (number | string | Long);
  'costOffchain'?: (number | string | Long);
  'idBytes'?: (Buffer | Uint8Array | string);
  'htlcAddressP2wsh'?: (string);
  'htlcAddressNp2wsh'?: (string);
  'failureReason'?: (_looprpc_FailureReason | keyof typeof _looprpc_FailureReason);
  'label'?: (string);
  'lastHop'?: (Buffer | Uint8Array | string);
  'outgoingChanSet'?: (number | string | Long)[];
}

export interface SwapStatus__Output {
  'amt': (string);
  'id': (string);
  'type': (keyof typeof _looprpc_SwapType);
  'state': (keyof typeof _looprpc_SwapState);
  'initiationTime': (string);
  'lastUpdateTime': (string);
  'htlcAddress': (string);
  'costServer': (string);
  'costOnchain': (string);
  'costOffchain': (string);
  'idBytes': (Buffer);
  'htlcAddressP2wsh': (string);
  'htlcAddressNp2wsh': (string);
  'failureReason': (keyof typeof _looprpc_FailureReason);
  'label': (string);
  'lastHop': (Buffer);
  'outgoingChanSet': (string)[];
}
