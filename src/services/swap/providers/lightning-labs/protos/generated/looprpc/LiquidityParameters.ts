// Original file: ../loop.proto

import type { LiquidityRule as _looprpc_LiquidityRule, LiquidityRule__Output as _looprpc_LiquidityRule__Output } from '../looprpc/LiquidityRule';
import type { Long } from '@grpc/proto-loader';

export interface LiquidityParameters {
  'rules'?: (_looprpc_LiquidityRule)[];
  'sweepFeeRateSatPerVbyte'?: (number | string | Long);
  'maxSwapFeePpm'?: (number | string | Long);
  'maxRoutingFeePpm'?: (number | string | Long);
  'maxPrepayRoutingFeePpm'?: (number | string | Long);
  'maxPrepaySat'?: (number | string | Long);
  'maxMinerFeeSat'?: (number | string | Long);
  'sweepConfTarget'?: (number);
  'failureBackoffSec'?: (number | string | Long);
  'autoloop'?: (boolean);
  'autoloopBudgetSat'?: (number | string | Long);
  'autoloopBudgetStartSec'?: (number | string | Long);
  'autoMaxInFlight'?: (number | string | Long);
  'minSwapAmount'?: (number | string | Long);
  'maxSwapAmount'?: (number | string | Long);
  'feePpm'?: (number | string | Long);
  'htlcConfTarget'?: (number);
}

export interface LiquidityParameters__Output {
  'rules': (_looprpc_LiquidityRule__Output)[];
  'sweepFeeRateSatPerVbyte': (string);
  'maxSwapFeePpm': (string);
  'maxRoutingFeePpm': (string);
  'maxPrepayRoutingFeePpm': (string);
  'maxPrepaySat': (string);
  'maxMinerFeeSat': (string);
  'sweepConfTarget': (number);
  'failureBackoffSec': (string);
  'autoloop': (boolean);
  'autoloopBudgetSat': (string);
  'autoloopBudgetStartSec': (string);
  'autoMaxInFlight': (string);
  'minSwapAmount': (string);
  'maxSwapAmount': (string);
  'feePpm': (string);
  'htlcConfTarget': (number);
}
