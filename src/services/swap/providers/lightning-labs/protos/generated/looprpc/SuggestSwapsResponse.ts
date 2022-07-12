// Original file: ../loop.proto

import type { LoopOutRequest as _looprpc_LoopOutRequest, LoopOutRequest__Output as _looprpc_LoopOutRequest__Output } from '../looprpc/LoopOutRequest';
import type { Disqualified as _looprpc_Disqualified, Disqualified__Output as _looprpc_Disqualified__Output } from '../looprpc/Disqualified';
import type { LoopInRequest as _looprpc_LoopInRequest, LoopInRequest__Output as _looprpc_LoopInRequest__Output } from '../looprpc/LoopInRequest';

export interface SuggestSwapsResponse {
  'loopOut'?: (_looprpc_LoopOutRequest)[];
  'disqualified'?: (_looprpc_Disqualified)[];
  'loopIn'?: (_looprpc_LoopInRequest)[];
}

export interface SuggestSwapsResponse__Output {
  'loopOut': (_looprpc_LoopOutRequest__Output)[];
  'disqualified': (_looprpc_Disqualified__Output)[];
  'loopIn': (_looprpc_LoopInRequest__Output)[];
}
