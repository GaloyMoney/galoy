// Original file: ../loop.proto

import type * as grpc from '@grpc/grpc-js'
import type { MethodDefinition } from '@grpc/proto-loader'
import type { GetLiquidityParamsRequest as _looprpc_GetLiquidityParamsRequest, GetLiquidityParamsRequest__Output as _looprpc_GetLiquidityParamsRequest__Output } from '../looprpc/GetLiquidityParamsRequest';
import type { InQuoteResponse as _looprpc_InQuoteResponse, InQuoteResponse__Output as _looprpc_InQuoteResponse__Output } from '../looprpc/InQuoteResponse';
import type { InTermsResponse as _looprpc_InTermsResponse, InTermsResponse__Output as _looprpc_InTermsResponse__Output } from '../looprpc/InTermsResponse';
import type { LiquidityParameters as _looprpc_LiquidityParameters, LiquidityParameters__Output as _looprpc_LiquidityParameters__Output } from '../looprpc/LiquidityParameters';
import type { ListSwapsRequest as _looprpc_ListSwapsRequest, ListSwapsRequest__Output as _looprpc_ListSwapsRequest__Output } from '../looprpc/ListSwapsRequest';
import type { ListSwapsResponse as _looprpc_ListSwapsResponse, ListSwapsResponse__Output as _looprpc_ListSwapsResponse__Output } from '../looprpc/ListSwapsResponse';
import type { LoopInRequest as _looprpc_LoopInRequest, LoopInRequest__Output as _looprpc_LoopInRequest__Output } from '../looprpc/LoopInRequest';
import type { LoopOutRequest as _looprpc_LoopOutRequest, LoopOutRequest__Output as _looprpc_LoopOutRequest__Output } from '../looprpc/LoopOutRequest';
import type { MonitorRequest as _looprpc_MonitorRequest, MonitorRequest__Output as _looprpc_MonitorRequest__Output } from '../looprpc/MonitorRequest';
import type { OutQuoteResponse as _looprpc_OutQuoteResponse, OutQuoteResponse__Output as _looprpc_OutQuoteResponse__Output } from '../looprpc/OutQuoteResponse';
import type { OutTermsResponse as _looprpc_OutTermsResponse, OutTermsResponse__Output as _looprpc_OutTermsResponse__Output } from '../looprpc/OutTermsResponse';
import type { ProbeRequest as _looprpc_ProbeRequest, ProbeRequest__Output as _looprpc_ProbeRequest__Output } from '../looprpc/ProbeRequest';
import type { ProbeResponse as _looprpc_ProbeResponse, ProbeResponse__Output as _looprpc_ProbeResponse__Output } from '../looprpc/ProbeResponse';
import type { QuoteRequest as _looprpc_QuoteRequest, QuoteRequest__Output as _looprpc_QuoteRequest__Output } from '../looprpc/QuoteRequest';
import type { SetLiquidityParamsRequest as _looprpc_SetLiquidityParamsRequest, SetLiquidityParamsRequest__Output as _looprpc_SetLiquidityParamsRequest__Output } from '../looprpc/SetLiquidityParamsRequest';
import type { SetLiquidityParamsResponse as _looprpc_SetLiquidityParamsResponse, SetLiquidityParamsResponse__Output as _looprpc_SetLiquidityParamsResponse__Output } from '../looprpc/SetLiquidityParamsResponse';
import type { SuggestSwapsRequest as _looprpc_SuggestSwapsRequest, SuggestSwapsRequest__Output as _looprpc_SuggestSwapsRequest__Output } from '../looprpc/SuggestSwapsRequest';
import type { SuggestSwapsResponse as _looprpc_SuggestSwapsResponse, SuggestSwapsResponse__Output as _looprpc_SuggestSwapsResponse__Output } from '../looprpc/SuggestSwapsResponse';
import type { SwapInfoRequest as _looprpc_SwapInfoRequest, SwapInfoRequest__Output as _looprpc_SwapInfoRequest__Output } from '../looprpc/SwapInfoRequest';
import type { SwapResponse as _looprpc_SwapResponse, SwapResponse__Output as _looprpc_SwapResponse__Output } from '../looprpc/SwapResponse';
import type { SwapStatus as _looprpc_SwapStatus, SwapStatus__Output as _looprpc_SwapStatus__Output } from '../looprpc/SwapStatus';
import type { TermsRequest as _looprpc_TermsRequest, TermsRequest__Output as _looprpc_TermsRequest__Output } from '../looprpc/TermsRequest';
import type { TokensRequest as _looprpc_TokensRequest, TokensRequest__Output as _looprpc_TokensRequest__Output } from '../looprpc/TokensRequest';
import type { TokensResponse as _looprpc_TokensResponse, TokensResponse__Output as _looprpc_TokensResponse__Output } from '../looprpc/TokensResponse';

export interface SwapClientClient extends grpc.Client {
  GetLiquidityParams(argument: _looprpc_GetLiquidityParamsRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_looprpc_LiquidityParameters__Output>): grpc.ClientUnaryCall;
  GetLiquidityParams(argument: _looprpc_GetLiquidityParamsRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_looprpc_LiquidityParameters__Output>): grpc.ClientUnaryCall;
  GetLiquidityParams(argument: _looprpc_GetLiquidityParamsRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_looprpc_LiquidityParameters__Output>): grpc.ClientUnaryCall;
  GetLiquidityParams(argument: _looprpc_GetLiquidityParamsRequest, callback: grpc.requestCallback<_looprpc_LiquidityParameters__Output>): grpc.ClientUnaryCall;
  getLiquidityParams(argument: _looprpc_GetLiquidityParamsRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_looprpc_LiquidityParameters__Output>): grpc.ClientUnaryCall;
  getLiquidityParams(argument: _looprpc_GetLiquidityParamsRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_looprpc_LiquidityParameters__Output>): grpc.ClientUnaryCall;
  getLiquidityParams(argument: _looprpc_GetLiquidityParamsRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_looprpc_LiquidityParameters__Output>): grpc.ClientUnaryCall;
  getLiquidityParams(argument: _looprpc_GetLiquidityParamsRequest, callback: grpc.requestCallback<_looprpc_LiquidityParameters__Output>): grpc.ClientUnaryCall;
  
  GetLoopInQuote(argument: _looprpc_QuoteRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_looprpc_InQuoteResponse__Output>): grpc.ClientUnaryCall;
  GetLoopInQuote(argument: _looprpc_QuoteRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_looprpc_InQuoteResponse__Output>): grpc.ClientUnaryCall;
  GetLoopInQuote(argument: _looprpc_QuoteRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_looprpc_InQuoteResponse__Output>): grpc.ClientUnaryCall;
  GetLoopInQuote(argument: _looprpc_QuoteRequest, callback: grpc.requestCallback<_looprpc_InQuoteResponse__Output>): grpc.ClientUnaryCall;
  getLoopInQuote(argument: _looprpc_QuoteRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_looprpc_InQuoteResponse__Output>): grpc.ClientUnaryCall;
  getLoopInQuote(argument: _looprpc_QuoteRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_looprpc_InQuoteResponse__Output>): grpc.ClientUnaryCall;
  getLoopInQuote(argument: _looprpc_QuoteRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_looprpc_InQuoteResponse__Output>): grpc.ClientUnaryCall;
  getLoopInQuote(argument: _looprpc_QuoteRequest, callback: grpc.requestCallback<_looprpc_InQuoteResponse__Output>): grpc.ClientUnaryCall;
  
  GetLoopInTerms(argument: _looprpc_TermsRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_looprpc_InTermsResponse__Output>): grpc.ClientUnaryCall;
  GetLoopInTerms(argument: _looprpc_TermsRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_looprpc_InTermsResponse__Output>): grpc.ClientUnaryCall;
  GetLoopInTerms(argument: _looprpc_TermsRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_looprpc_InTermsResponse__Output>): grpc.ClientUnaryCall;
  GetLoopInTerms(argument: _looprpc_TermsRequest, callback: grpc.requestCallback<_looprpc_InTermsResponse__Output>): grpc.ClientUnaryCall;
  getLoopInTerms(argument: _looprpc_TermsRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_looprpc_InTermsResponse__Output>): grpc.ClientUnaryCall;
  getLoopInTerms(argument: _looprpc_TermsRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_looprpc_InTermsResponse__Output>): grpc.ClientUnaryCall;
  getLoopInTerms(argument: _looprpc_TermsRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_looprpc_InTermsResponse__Output>): grpc.ClientUnaryCall;
  getLoopInTerms(argument: _looprpc_TermsRequest, callback: grpc.requestCallback<_looprpc_InTermsResponse__Output>): grpc.ClientUnaryCall;
  
  GetLsatTokens(argument: _looprpc_TokensRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_looprpc_TokensResponse__Output>): grpc.ClientUnaryCall;
  GetLsatTokens(argument: _looprpc_TokensRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_looprpc_TokensResponse__Output>): grpc.ClientUnaryCall;
  GetLsatTokens(argument: _looprpc_TokensRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_looprpc_TokensResponse__Output>): grpc.ClientUnaryCall;
  GetLsatTokens(argument: _looprpc_TokensRequest, callback: grpc.requestCallback<_looprpc_TokensResponse__Output>): grpc.ClientUnaryCall;
  getLsatTokens(argument: _looprpc_TokensRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_looprpc_TokensResponse__Output>): grpc.ClientUnaryCall;
  getLsatTokens(argument: _looprpc_TokensRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_looprpc_TokensResponse__Output>): grpc.ClientUnaryCall;
  getLsatTokens(argument: _looprpc_TokensRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_looprpc_TokensResponse__Output>): grpc.ClientUnaryCall;
  getLsatTokens(argument: _looprpc_TokensRequest, callback: grpc.requestCallback<_looprpc_TokensResponse__Output>): grpc.ClientUnaryCall;
  
  ListSwaps(argument: _looprpc_ListSwapsRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_looprpc_ListSwapsResponse__Output>): grpc.ClientUnaryCall;
  ListSwaps(argument: _looprpc_ListSwapsRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_looprpc_ListSwapsResponse__Output>): grpc.ClientUnaryCall;
  ListSwaps(argument: _looprpc_ListSwapsRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_looprpc_ListSwapsResponse__Output>): grpc.ClientUnaryCall;
  ListSwaps(argument: _looprpc_ListSwapsRequest, callback: grpc.requestCallback<_looprpc_ListSwapsResponse__Output>): grpc.ClientUnaryCall;
  listSwaps(argument: _looprpc_ListSwapsRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_looprpc_ListSwapsResponse__Output>): grpc.ClientUnaryCall;
  listSwaps(argument: _looprpc_ListSwapsRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_looprpc_ListSwapsResponse__Output>): grpc.ClientUnaryCall;
  listSwaps(argument: _looprpc_ListSwapsRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_looprpc_ListSwapsResponse__Output>): grpc.ClientUnaryCall;
  listSwaps(argument: _looprpc_ListSwapsRequest, callback: grpc.requestCallback<_looprpc_ListSwapsResponse__Output>): grpc.ClientUnaryCall;
  
  LoopIn(argument: _looprpc_LoopInRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_looprpc_SwapResponse__Output>): grpc.ClientUnaryCall;
  LoopIn(argument: _looprpc_LoopInRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_looprpc_SwapResponse__Output>): grpc.ClientUnaryCall;
  LoopIn(argument: _looprpc_LoopInRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_looprpc_SwapResponse__Output>): grpc.ClientUnaryCall;
  LoopIn(argument: _looprpc_LoopInRequest, callback: grpc.requestCallback<_looprpc_SwapResponse__Output>): grpc.ClientUnaryCall;
  loopIn(argument: _looprpc_LoopInRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_looprpc_SwapResponse__Output>): grpc.ClientUnaryCall;
  loopIn(argument: _looprpc_LoopInRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_looprpc_SwapResponse__Output>): grpc.ClientUnaryCall;
  loopIn(argument: _looprpc_LoopInRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_looprpc_SwapResponse__Output>): grpc.ClientUnaryCall;
  loopIn(argument: _looprpc_LoopInRequest, callback: grpc.requestCallback<_looprpc_SwapResponse__Output>): grpc.ClientUnaryCall;
  
  LoopOut(argument: _looprpc_LoopOutRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_looprpc_SwapResponse__Output>): grpc.ClientUnaryCall;
  LoopOut(argument: _looprpc_LoopOutRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_looprpc_SwapResponse__Output>): grpc.ClientUnaryCall;
  LoopOut(argument: _looprpc_LoopOutRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_looprpc_SwapResponse__Output>): grpc.ClientUnaryCall;
  LoopOut(argument: _looprpc_LoopOutRequest, callback: grpc.requestCallback<_looprpc_SwapResponse__Output>): grpc.ClientUnaryCall;
  loopOut(argument: _looprpc_LoopOutRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_looprpc_SwapResponse__Output>): grpc.ClientUnaryCall;
  loopOut(argument: _looprpc_LoopOutRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_looprpc_SwapResponse__Output>): grpc.ClientUnaryCall;
  loopOut(argument: _looprpc_LoopOutRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_looprpc_SwapResponse__Output>): grpc.ClientUnaryCall;
  loopOut(argument: _looprpc_LoopOutRequest, callback: grpc.requestCallback<_looprpc_SwapResponse__Output>): grpc.ClientUnaryCall;
  
  LoopOutQuote(argument: _looprpc_QuoteRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_looprpc_OutQuoteResponse__Output>): grpc.ClientUnaryCall;
  LoopOutQuote(argument: _looprpc_QuoteRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_looprpc_OutQuoteResponse__Output>): grpc.ClientUnaryCall;
  LoopOutQuote(argument: _looprpc_QuoteRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_looprpc_OutQuoteResponse__Output>): grpc.ClientUnaryCall;
  LoopOutQuote(argument: _looprpc_QuoteRequest, callback: grpc.requestCallback<_looprpc_OutQuoteResponse__Output>): grpc.ClientUnaryCall;
  loopOutQuote(argument: _looprpc_QuoteRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_looprpc_OutQuoteResponse__Output>): grpc.ClientUnaryCall;
  loopOutQuote(argument: _looprpc_QuoteRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_looprpc_OutQuoteResponse__Output>): grpc.ClientUnaryCall;
  loopOutQuote(argument: _looprpc_QuoteRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_looprpc_OutQuoteResponse__Output>): grpc.ClientUnaryCall;
  loopOutQuote(argument: _looprpc_QuoteRequest, callback: grpc.requestCallback<_looprpc_OutQuoteResponse__Output>): grpc.ClientUnaryCall;
  
  LoopOutTerms(argument: _looprpc_TermsRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_looprpc_OutTermsResponse__Output>): grpc.ClientUnaryCall;
  LoopOutTerms(argument: _looprpc_TermsRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_looprpc_OutTermsResponse__Output>): grpc.ClientUnaryCall;
  LoopOutTerms(argument: _looprpc_TermsRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_looprpc_OutTermsResponse__Output>): grpc.ClientUnaryCall;
  LoopOutTerms(argument: _looprpc_TermsRequest, callback: grpc.requestCallback<_looprpc_OutTermsResponse__Output>): grpc.ClientUnaryCall;
  loopOutTerms(argument: _looprpc_TermsRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_looprpc_OutTermsResponse__Output>): grpc.ClientUnaryCall;
  loopOutTerms(argument: _looprpc_TermsRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_looprpc_OutTermsResponse__Output>): grpc.ClientUnaryCall;
  loopOutTerms(argument: _looprpc_TermsRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_looprpc_OutTermsResponse__Output>): grpc.ClientUnaryCall;
  loopOutTerms(argument: _looprpc_TermsRequest, callback: grpc.requestCallback<_looprpc_OutTermsResponse__Output>): grpc.ClientUnaryCall;
  
  Monitor(argument: _looprpc_MonitorRequest, metadata: grpc.Metadata, options?: grpc.CallOptions): grpc.ClientReadableStream<_looprpc_SwapStatus__Output>;
  Monitor(argument: _looprpc_MonitorRequest, options?: grpc.CallOptions): grpc.ClientReadableStream<_looprpc_SwapStatus__Output>;
  monitor(argument: _looprpc_MonitorRequest, metadata: grpc.Metadata, options?: grpc.CallOptions): grpc.ClientReadableStream<_looprpc_SwapStatus__Output>;
  monitor(argument: _looprpc_MonitorRequest, options?: grpc.CallOptions): grpc.ClientReadableStream<_looprpc_SwapStatus__Output>;
  
  Probe(argument: _looprpc_ProbeRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_looprpc_ProbeResponse__Output>): grpc.ClientUnaryCall;
  Probe(argument: _looprpc_ProbeRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_looprpc_ProbeResponse__Output>): grpc.ClientUnaryCall;
  Probe(argument: _looprpc_ProbeRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_looprpc_ProbeResponse__Output>): grpc.ClientUnaryCall;
  Probe(argument: _looprpc_ProbeRequest, callback: grpc.requestCallback<_looprpc_ProbeResponse__Output>): grpc.ClientUnaryCall;
  probe(argument: _looprpc_ProbeRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_looprpc_ProbeResponse__Output>): grpc.ClientUnaryCall;
  probe(argument: _looprpc_ProbeRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_looprpc_ProbeResponse__Output>): grpc.ClientUnaryCall;
  probe(argument: _looprpc_ProbeRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_looprpc_ProbeResponse__Output>): grpc.ClientUnaryCall;
  probe(argument: _looprpc_ProbeRequest, callback: grpc.requestCallback<_looprpc_ProbeResponse__Output>): grpc.ClientUnaryCall;
  
  SetLiquidityParams(argument: _looprpc_SetLiquidityParamsRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_looprpc_SetLiquidityParamsResponse__Output>): grpc.ClientUnaryCall;
  SetLiquidityParams(argument: _looprpc_SetLiquidityParamsRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_looprpc_SetLiquidityParamsResponse__Output>): grpc.ClientUnaryCall;
  SetLiquidityParams(argument: _looprpc_SetLiquidityParamsRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_looprpc_SetLiquidityParamsResponse__Output>): grpc.ClientUnaryCall;
  SetLiquidityParams(argument: _looprpc_SetLiquidityParamsRequest, callback: grpc.requestCallback<_looprpc_SetLiquidityParamsResponse__Output>): grpc.ClientUnaryCall;
  setLiquidityParams(argument: _looprpc_SetLiquidityParamsRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_looprpc_SetLiquidityParamsResponse__Output>): grpc.ClientUnaryCall;
  setLiquidityParams(argument: _looprpc_SetLiquidityParamsRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_looprpc_SetLiquidityParamsResponse__Output>): grpc.ClientUnaryCall;
  setLiquidityParams(argument: _looprpc_SetLiquidityParamsRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_looprpc_SetLiquidityParamsResponse__Output>): grpc.ClientUnaryCall;
  setLiquidityParams(argument: _looprpc_SetLiquidityParamsRequest, callback: grpc.requestCallback<_looprpc_SetLiquidityParamsResponse__Output>): grpc.ClientUnaryCall;
  
  SuggestSwaps(argument: _looprpc_SuggestSwapsRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_looprpc_SuggestSwapsResponse__Output>): grpc.ClientUnaryCall;
  SuggestSwaps(argument: _looprpc_SuggestSwapsRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_looprpc_SuggestSwapsResponse__Output>): grpc.ClientUnaryCall;
  SuggestSwaps(argument: _looprpc_SuggestSwapsRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_looprpc_SuggestSwapsResponse__Output>): grpc.ClientUnaryCall;
  SuggestSwaps(argument: _looprpc_SuggestSwapsRequest, callback: grpc.requestCallback<_looprpc_SuggestSwapsResponse__Output>): grpc.ClientUnaryCall;
  suggestSwaps(argument: _looprpc_SuggestSwapsRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_looprpc_SuggestSwapsResponse__Output>): grpc.ClientUnaryCall;
  suggestSwaps(argument: _looprpc_SuggestSwapsRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_looprpc_SuggestSwapsResponse__Output>): grpc.ClientUnaryCall;
  suggestSwaps(argument: _looprpc_SuggestSwapsRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_looprpc_SuggestSwapsResponse__Output>): grpc.ClientUnaryCall;
  suggestSwaps(argument: _looprpc_SuggestSwapsRequest, callback: grpc.requestCallback<_looprpc_SuggestSwapsResponse__Output>): grpc.ClientUnaryCall;
  
  SwapInfo(argument: _looprpc_SwapInfoRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_looprpc_SwapStatus__Output>): grpc.ClientUnaryCall;
  SwapInfo(argument: _looprpc_SwapInfoRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_looprpc_SwapStatus__Output>): grpc.ClientUnaryCall;
  SwapInfo(argument: _looprpc_SwapInfoRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_looprpc_SwapStatus__Output>): grpc.ClientUnaryCall;
  SwapInfo(argument: _looprpc_SwapInfoRequest, callback: grpc.requestCallback<_looprpc_SwapStatus__Output>): grpc.ClientUnaryCall;
  swapInfo(argument: _looprpc_SwapInfoRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_looprpc_SwapStatus__Output>): grpc.ClientUnaryCall;
  swapInfo(argument: _looprpc_SwapInfoRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_looprpc_SwapStatus__Output>): grpc.ClientUnaryCall;
  swapInfo(argument: _looprpc_SwapInfoRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_looprpc_SwapStatus__Output>): grpc.ClientUnaryCall;
  swapInfo(argument: _looprpc_SwapInfoRequest, callback: grpc.requestCallback<_looprpc_SwapStatus__Output>): grpc.ClientUnaryCall;
  
}

export interface SwapClientHandlers extends grpc.UntypedServiceImplementation {
  GetLiquidityParams: grpc.handleUnaryCall<_looprpc_GetLiquidityParamsRequest__Output, _looprpc_LiquidityParameters>;
  
  GetLoopInQuote: grpc.handleUnaryCall<_looprpc_QuoteRequest__Output, _looprpc_InQuoteResponse>;
  
  GetLoopInTerms: grpc.handleUnaryCall<_looprpc_TermsRequest__Output, _looprpc_InTermsResponse>;
  
  GetLsatTokens: grpc.handleUnaryCall<_looprpc_TokensRequest__Output, _looprpc_TokensResponse>;
  
  ListSwaps: grpc.handleUnaryCall<_looprpc_ListSwapsRequest__Output, _looprpc_ListSwapsResponse>;
  
  LoopIn: grpc.handleUnaryCall<_looprpc_LoopInRequest__Output, _looprpc_SwapResponse>;
  
  LoopOut: grpc.handleUnaryCall<_looprpc_LoopOutRequest__Output, _looprpc_SwapResponse>;
  
  LoopOutQuote: grpc.handleUnaryCall<_looprpc_QuoteRequest__Output, _looprpc_OutQuoteResponse>;
  
  LoopOutTerms: grpc.handleUnaryCall<_looprpc_TermsRequest__Output, _looprpc_OutTermsResponse>;
  
  Monitor: grpc.handleServerStreamingCall<_looprpc_MonitorRequest__Output, _looprpc_SwapStatus>;
  
  Probe: grpc.handleUnaryCall<_looprpc_ProbeRequest__Output, _looprpc_ProbeResponse>;
  
  SetLiquidityParams: grpc.handleUnaryCall<_looprpc_SetLiquidityParamsRequest__Output, _looprpc_SetLiquidityParamsResponse>;
  
  SuggestSwaps: grpc.handleUnaryCall<_looprpc_SuggestSwapsRequest__Output, _looprpc_SuggestSwapsResponse>;
  
  SwapInfo: grpc.handleUnaryCall<_looprpc_SwapInfoRequest__Output, _looprpc_SwapStatus>;
  
}

export interface SwapClientDefinition extends grpc.ServiceDefinition {
  GetLiquidityParams: MethodDefinition<_looprpc_GetLiquidityParamsRequest, _looprpc_LiquidityParameters, _looprpc_GetLiquidityParamsRequest__Output, _looprpc_LiquidityParameters__Output>
  GetLoopInQuote: MethodDefinition<_looprpc_QuoteRequest, _looprpc_InQuoteResponse, _looprpc_QuoteRequest__Output, _looprpc_InQuoteResponse__Output>
  GetLoopInTerms: MethodDefinition<_looprpc_TermsRequest, _looprpc_InTermsResponse, _looprpc_TermsRequest__Output, _looprpc_InTermsResponse__Output>
  GetLsatTokens: MethodDefinition<_looprpc_TokensRequest, _looprpc_TokensResponse, _looprpc_TokensRequest__Output, _looprpc_TokensResponse__Output>
  ListSwaps: MethodDefinition<_looprpc_ListSwapsRequest, _looprpc_ListSwapsResponse, _looprpc_ListSwapsRequest__Output, _looprpc_ListSwapsResponse__Output>
  LoopIn: MethodDefinition<_looprpc_LoopInRequest, _looprpc_SwapResponse, _looprpc_LoopInRequest__Output, _looprpc_SwapResponse__Output>
  LoopOut: MethodDefinition<_looprpc_LoopOutRequest, _looprpc_SwapResponse, _looprpc_LoopOutRequest__Output, _looprpc_SwapResponse__Output>
  LoopOutQuote: MethodDefinition<_looprpc_QuoteRequest, _looprpc_OutQuoteResponse, _looprpc_QuoteRequest__Output, _looprpc_OutQuoteResponse__Output>
  LoopOutTerms: MethodDefinition<_looprpc_TermsRequest, _looprpc_OutTermsResponse, _looprpc_TermsRequest__Output, _looprpc_OutTermsResponse__Output>
  Monitor: MethodDefinition<_looprpc_MonitorRequest, _looprpc_SwapStatus, _looprpc_MonitorRequest__Output, _looprpc_SwapStatus__Output>
  Probe: MethodDefinition<_looprpc_ProbeRequest, _looprpc_ProbeResponse, _looprpc_ProbeRequest__Output, _looprpc_ProbeResponse__Output>
  SetLiquidityParams: MethodDefinition<_looprpc_SetLiquidityParamsRequest, _looprpc_SetLiquidityParamsResponse, _looprpc_SetLiquidityParamsRequest__Output, _looprpc_SetLiquidityParamsResponse__Output>
  SuggestSwaps: MethodDefinition<_looprpc_SuggestSwapsRequest, _looprpc_SuggestSwapsResponse, _looprpc_SuggestSwapsRequest__Output, _looprpc_SuggestSwapsResponse__Output>
  SwapInfo: MethodDefinition<_looprpc_SwapInfoRequest, _looprpc_SwapStatus, _looprpc_SwapInfoRequest__Output, _looprpc_SwapStatus__Output>
}
