// Original file: ../loop.proto

import type { LiquidityRuleType as _looprpc_LiquidityRuleType } from '../looprpc/LiquidityRuleType';
import type { SwapType as _looprpc_SwapType } from '../looprpc/SwapType';
import type { Long } from '@grpc/proto-loader';

export interface LiquidityRule {
  'channelId'?: (number | string | Long);
  'type'?: (_looprpc_LiquidityRuleType | keyof typeof _looprpc_LiquidityRuleType);
  'incomingThreshold'?: (number);
  'outgoingThreshold'?: (number);
  'pubkey'?: (Buffer | Uint8Array | string);
  'swapType'?: (_looprpc_SwapType | keyof typeof _looprpc_SwapType);
}

export interface LiquidityRule__Output {
  'channelId': (string);
  'type': (keyof typeof _looprpc_LiquidityRuleType);
  'incomingThreshold': (number);
  'outgoingThreshold': (number);
  'pubkey': (Buffer);
  'swapType': (keyof typeof _looprpc_SwapType);
}
