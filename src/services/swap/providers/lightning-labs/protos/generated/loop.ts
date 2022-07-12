import type * as grpc from '@grpc/grpc-js';
import type { EnumTypeDefinition, MessageTypeDefinition } from '@grpc/proto-loader';

import type { SwapClientClient as _looprpc_SwapClientClient, SwapClientDefinition as _looprpc_SwapClientDefinition } from './looprpc/SwapClient';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SubtypeConstructor<Constructor extends new (...args: any) => any, Subtype> = {
  new(...args: ConstructorParameters<Constructor>): Subtype;
};

export interface ProtoGrpcType {
  looprpc: {
    AutoReason: EnumTypeDefinition
    Disqualified: MessageTypeDefinition
    FailureReason: EnumTypeDefinition
    GetLiquidityParamsRequest: MessageTypeDefinition
    HopHint: MessageTypeDefinition
    InQuoteResponse: MessageTypeDefinition
    InTermsResponse: MessageTypeDefinition
    LiquidityParameters: MessageTypeDefinition
    LiquidityRule: MessageTypeDefinition
    LiquidityRuleType: EnumTypeDefinition
    ListSwapsRequest: MessageTypeDefinition
    ListSwapsResponse: MessageTypeDefinition
    LoopInRequest: MessageTypeDefinition
    LoopOutRequest: MessageTypeDefinition
    LsatToken: MessageTypeDefinition
    MonitorRequest: MessageTypeDefinition
    OutQuoteResponse: MessageTypeDefinition
    OutTermsResponse: MessageTypeDefinition
    ProbeRequest: MessageTypeDefinition
    ProbeResponse: MessageTypeDefinition
    QuoteRequest: MessageTypeDefinition
    RouteHint: MessageTypeDefinition
    SetLiquidityParamsRequest: MessageTypeDefinition
    SetLiquidityParamsResponse: MessageTypeDefinition
    SuggestSwapsRequest: MessageTypeDefinition
    SuggestSwapsResponse: MessageTypeDefinition
    SwapClient: SubtypeConstructor<typeof grpc.Client, _looprpc_SwapClientClient> & { service: _looprpc_SwapClientDefinition }
    SwapInfoRequest: MessageTypeDefinition
    SwapResponse: MessageTypeDefinition
    SwapState: EnumTypeDefinition
    SwapStatus: MessageTypeDefinition
    SwapType: EnumTypeDefinition
    TermsRequest: MessageTypeDefinition
    TokensRequest: MessageTypeDefinition
    TokensResponse: MessageTypeDefinition
  }
}

