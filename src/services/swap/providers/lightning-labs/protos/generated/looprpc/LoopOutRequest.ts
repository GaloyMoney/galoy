// Original file: ../loop.proto

import type { Long } from '@grpc/proto-loader';

export interface LoopOutRequest {
  'amt'?: (number | string | Long);
  'dest'?: (string);
  'maxSwapRoutingFee'?: (number | string | Long);
  'maxPrepayRoutingFee'?: (number | string | Long);
  'maxSwapFee'?: (number | string | Long);
  'maxPrepayAmt'?: (number | string | Long);
  'maxMinerFee'?: (number | string | Long);
  'loopOutChannel'?: (number | string | Long);
  'sweepConfTarget'?: (number);
  'swapPublicationDeadline'?: (number | string | Long);
  'outgoingChanSet'?: (number | string | Long)[];
  'label'?: (string);
  'htlcConfirmations'?: (number);
  'initiator'?: (string);
}

export interface LoopOutRequest__Output {
  'amt': (string);
  'dest': (string);
  'maxSwapRoutingFee': (string);
  'maxPrepayRoutingFee': (string);
  'maxSwapFee': (string);
  'maxPrepayAmt': (string);
  'maxMinerFee': (string);
  'loopOutChannel': (string);
  'sweepConfTarget': (number);
  'swapPublicationDeadline': (string);
  'outgoingChanSet': (string)[];
  'label': (string);
  'htlcConfirmations': (number);
  'initiator': (string);
}
