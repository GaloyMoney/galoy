// package: services.price.v1
// file: services/price/v1/price_service.proto

/* tslint:disable */
/* eslint-disable */

import * as grpc from "@grpc/grpc-js";
import * as services_price_v1_price_service_pb from "../../../services/price/v1/price_service_pb";

interface IPriceServiceService extends grpc.ServiceDefinition<grpc.UntypedServiceImplementation> {
    getCentsFromSatsForImmediateBuy: IPriceServiceService_IGetCentsFromSatsForImmediateBuy;
    getCentsFromSatsForImmediateSell: IPriceServiceService_IGetCentsFromSatsForImmediateSell;
    getCentsFromSatsForFutureBuy: IPriceServiceService_IGetCentsFromSatsForFutureBuy;
    getCentsFromSatsForFutureSell: IPriceServiceService_IGetCentsFromSatsForFutureSell;
    getSatsFromCentsForImmediateBuy: IPriceServiceService_IGetSatsFromCentsForImmediateBuy;
    getSatsFromCentsForImmediateSell: IPriceServiceService_IGetSatsFromCentsForImmediateSell;
    getSatsFromCentsForFutureBuy: IPriceServiceService_IGetSatsFromCentsForFutureBuy;
    getSatsFromCentsForFutureSell: IPriceServiceService_IGetSatsFromCentsForFutureSell;
    getCentsPerSatsExchangeMidRate: IPriceServiceService_IGetCentsPerSatsExchangeMidRate;
}

interface IPriceServiceService_IGetCentsFromSatsForImmediateBuy extends grpc.MethodDefinition<services_price_v1_price_service_pb.GetCentsFromSatsForImmediateBuyRequest, services_price_v1_price_service_pb.GetCentsFromSatsForImmediateBuyResponse> {
    path: "/services.price.v1.PriceService/GetCentsFromSatsForImmediateBuy";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<services_price_v1_price_service_pb.GetCentsFromSatsForImmediateBuyRequest>;
    requestDeserialize: grpc.deserialize<services_price_v1_price_service_pb.GetCentsFromSatsForImmediateBuyRequest>;
    responseSerialize: grpc.serialize<services_price_v1_price_service_pb.GetCentsFromSatsForImmediateBuyResponse>;
    responseDeserialize: grpc.deserialize<services_price_v1_price_service_pb.GetCentsFromSatsForImmediateBuyResponse>;
}
interface IPriceServiceService_IGetCentsFromSatsForImmediateSell extends grpc.MethodDefinition<services_price_v1_price_service_pb.GetCentsFromSatsForImmediateSellRequest, services_price_v1_price_service_pb.GetCentsFromSatsForImmediateSellResponse> {
    path: "/services.price.v1.PriceService/GetCentsFromSatsForImmediateSell";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<services_price_v1_price_service_pb.GetCentsFromSatsForImmediateSellRequest>;
    requestDeserialize: grpc.deserialize<services_price_v1_price_service_pb.GetCentsFromSatsForImmediateSellRequest>;
    responseSerialize: grpc.serialize<services_price_v1_price_service_pb.GetCentsFromSatsForImmediateSellResponse>;
    responseDeserialize: grpc.deserialize<services_price_v1_price_service_pb.GetCentsFromSatsForImmediateSellResponse>;
}
interface IPriceServiceService_IGetCentsFromSatsForFutureBuy extends grpc.MethodDefinition<services_price_v1_price_service_pb.GetCentsFromSatsForFutureBuyRequest, services_price_v1_price_service_pb.GetCentsFromSatsForFutureBuyResponse> {
    path: "/services.price.v1.PriceService/GetCentsFromSatsForFutureBuy";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<services_price_v1_price_service_pb.GetCentsFromSatsForFutureBuyRequest>;
    requestDeserialize: grpc.deserialize<services_price_v1_price_service_pb.GetCentsFromSatsForFutureBuyRequest>;
    responseSerialize: grpc.serialize<services_price_v1_price_service_pb.GetCentsFromSatsForFutureBuyResponse>;
    responseDeserialize: grpc.deserialize<services_price_v1_price_service_pb.GetCentsFromSatsForFutureBuyResponse>;
}
interface IPriceServiceService_IGetCentsFromSatsForFutureSell extends grpc.MethodDefinition<services_price_v1_price_service_pb.GetCentsFromSatsForFutureSellRequest, services_price_v1_price_service_pb.GetCentsFromSatsForFutureSellResponse> {
    path: "/services.price.v1.PriceService/GetCentsFromSatsForFutureSell";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<services_price_v1_price_service_pb.GetCentsFromSatsForFutureSellRequest>;
    requestDeserialize: grpc.deserialize<services_price_v1_price_service_pb.GetCentsFromSatsForFutureSellRequest>;
    responseSerialize: grpc.serialize<services_price_v1_price_service_pb.GetCentsFromSatsForFutureSellResponse>;
    responseDeserialize: grpc.deserialize<services_price_v1_price_service_pb.GetCentsFromSatsForFutureSellResponse>;
}
interface IPriceServiceService_IGetSatsFromCentsForImmediateBuy extends grpc.MethodDefinition<services_price_v1_price_service_pb.GetSatsFromCentsForImmediateBuyRequest, services_price_v1_price_service_pb.GetSatsFromCentsForImmediateBuyResponse> {
    path: "/services.price.v1.PriceService/GetSatsFromCentsForImmediateBuy";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<services_price_v1_price_service_pb.GetSatsFromCentsForImmediateBuyRequest>;
    requestDeserialize: grpc.deserialize<services_price_v1_price_service_pb.GetSatsFromCentsForImmediateBuyRequest>;
    responseSerialize: grpc.serialize<services_price_v1_price_service_pb.GetSatsFromCentsForImmediateBuyResponse>;
    responseDeserialize: grpc.deserialize<services_price_v1_price_service_pb.GetSatsFromCentsForImmediateBuyResponse>;
}
interface IPriceServiceService_IGetSatsFromCentsForImmediateSell extends grpc.MethodDefinition<services_price_v1_price_service_pb.GetSatsFromCentsForImmediateSellRequest, services_price_v1_price_service_pb.GetSatsFromCentsForImmediateSellResponse> {
    path: "/services.price.v1.PriceService/GetSatsFromCentsForImmediateSell";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<services_price_v1_price_service_pb.GetSatsFromCentsForImmediateSellRequest>;
    requestDeserialize: grpc.deserialize<services_price_v1_price_service_pb.GetSatsFromCentsForImmediateSellRequest>;
    responseSerialize: grpc.serialize<services_price_v1_price_service_pb.GetSatsFromCentsForImmediateSellResponse>;
    responseDeserialize: grpc.deserialize<services_price_v1_price_service_pb.GetSatsFromCentsForImmediateSellResponse>;
}
interface IPriceServiceService_IGetSatsFromCentsForFutureBuy extends grpc.MethodDefinition<services_price_v1_price_service_pb.GetSatsFromCentsForFutureBuyRequest, services_price_v1_price_service_pb.GetSatsFromCentsForFutureBuyResponse> {
    path: "/services.price.v1.PriceService/GetSatsFromCentsForFutureBuy";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<services_price_v1_price_service_pb.GetSatsFromCentsForFutureBuyRequest>;
    requestDeserialize: grpc.deserialize<services_price_v1_price_service_pb.GetSatsFromCentsForFutureBuyRequest>;
    responseSerialize: grpc.serialize<services_price_v1_price_service_pb.GetSatsFromCentsForFutureBuyResponse>;
    responseDeserialize: grpc.deserialize<services_price_v1_price_service_pb.GetSatsFromCentsForFutureBuyResponse>;
}
interface IPriceServiceService_IGetSatsFromCentsForFutureSell extends grpc.MethodDefinition<services_price_v1_price_service_pb.GetSatsFromCentsForFutureSellRequest, services_price_v1_price_service_pb.GetSatsFromCentsForFutureSellResponse> {
    path: "/services.price.v1.PriceService/GetSatsFromCentsForFutureSell";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<services_price_v1_price_service_pb.GetSatsFromCentsForFutureSellRequest>;
    requestDeserialize: grpc.deserialize<services_price_v1_price_service_pb.GetSatsFromCentsForFutureSellRequest>;
    responseSerialize: grpc.serialize<services_price_v1_price_service_pb.GetSatsFromCentsForFutureSellResponse>;
    responseDeserialize: grpc.deserialize<services_price_v1_price_service_pb.GetSatsFromCentsForFutureSellResponse>;
}
interface IPriceServiceService_IGetCentsPerSatsExchangeMidRate extends grpc.MethodDefinition<services_price_v1_price_service_pb.GetCentsPerSatsExchangeMidRateRequest, services_price_v1_price_service_pb.GetCentsPerSatsExchangeMidRateResponse> {
    path: "/services.price.v1.PriceService/GetCentsPerSatsExchangeMidRate";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<services_price_v1_price_service_pb.GetCentsPerSatsExchangeMidRateRequest>;
    requestDeserialize: grpc.deserialize<services_price_v1_price_service_pb.GetCentsPerSatsExchangeMidRateRequest>;
    responseSerialize: grpc.serialize<services_price_v1_price_service_pb.GetCentsPerSatsExchangeMidRateResponse>;
    responseDeserialize: grpc.deserialize<services_price_v1_price_service_pb.GetCentsPerSatsExchangeMidRateResponse>;
}

export const PriceServiceService: IPriceServiceService;

export interface IPriceServiceServer extends grpc.UntypedServiceImplementation {
    getCentsFromSatsForImmediateBuy: grpc.handleUnaryCall<services_price_v1_price_service_pb.GetCentsFromSatsForImmediateBuyRequest, services_price_v1_price_service_pb.GetCentsFromSatsForImmediateBuyResponse>;
    getCentsFromSatsForImmediateSell: grpc.handleUnaryCall<services_price_v1_price_service_pb.GetCentsFromSatsForImmediateSellRequest, services_price_v1_price_service_pb.GetCentsFromSatsForImmediateSellResponse>;
    getCentsFromSatsForFutureBuy: grpc.handleUnaryCall<services_price_v1_price_service_pb.GetCentsFromSatsForFutureBuyRequest, services_price_v1_price_service_pb.GetCentsFromSatsForFutureBuyResponse>;
    getCentsFromSatsForFutureSell: grpc.handleUnaryCall<services_price_v1_price_service_pb.GetCentsFromSatsForFutureSellRequest, services_price_v1_price_service_pb.GetCentsFromSatsForFutureSellResponse>;
    getSatsFromCentsForImmediateBuy: grpc.handleUnaryCall<services_price_v1_price_service_pb.GetSatsFromCentsForImmediateBuyRequest, services_price_v1_price_service_pb.GetSatsFromCentsForImmediateBuyResponse>;
    getSatsFromCentsForImmediateSell: grpc.handleUnaryCall<services_price_v1_price_service_pb.GetSatsFromCentsForImmediateSellRequest, services_price_v1_price_service_pb.GetSatsFromCentsForImmediateSellResponse>;
    getSatsFromCentsForFutureBuy: grpc.handleUnaryCall<services_price_v1_price_service_pb.GetSatsFromCentsForFutureBuyRequest, services_price_v1_price_service_pb.GetSatsFromCentsForFutureBuyResponse>;
    getSatsFromCentsForFutureSell: grpc.handleUnaryCall<services_price_v1_price_service_pb.GetSatsFromCentsForFutureSellRequest, services_price_v1_price_service_pb.GetSatsFromCentsForFutureSellResponse>;
    getCentsPerSatsExchangeMidRate: grpc.handleUnaryCall<services_price_v1_price_service_pb.GetCentsPerSatsExchangeMidRateRequest, services_price_v1_price_service_pb.GetCentsPerSatsExchangeMidRateResponse>;
}

export interface IPriceServiceClient {
    getCentsFromSatsForImmediateBuy(request: services_price_v1_price_service_pb.GetCentsFromSatsForImmediateBuyRequest, callback: (error: grpc.ServiceError | null, response: services_price_v1_price_service_pb.GetCentsFromSatsForImmediateBuyResponse) => void): grpc.ClientUnaryCall;
    getCentsFromSatsForImmediateBuy(request: services_price_v1_price_service_pb.GetCentsFromSatsForImmediateBuyRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: services_price_v1_price_service_pb.GetCentsFromSatsForImmediateBuyResponse) => void): grpc.ClientUnaryCall;
    getCentsFromSatsForImmediateBuy(request: services_price_v1_price_service_pb.GetCentsFromSatsForImmediateBuyRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: services_price_v1_price_service_pb.GetCentsFromSatsForImmediateBuyResponse) => void): grpc.ClientUnaryCall;
    getCentsFromSatsForImmediateSell(request: services_price_v1_price_service_pb.GetCentsFromSatsForImmediateSellRequest, callback: (error: grpc.ServiceError | null, response: services_price_v1_price_service_pb.GetCentsFromSatsForImmediateSellResponse) => void): grpc.ClientUnaryCall;
    getCentsFromSatsForImmediateSell(request: services_price_v1_price_service_pb.GetCentsFromSatsForImmediateSellRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: services_price_v1_price_service_pb.GetCentsFromSatsForImmediateSellResponse) => void): grpc.ClientUnaryCall;
    getCentsFromSatsForImmediateSell(request: services_price_v1_price_service_pb.GetCentsFromSatsForImmediateSellRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: services_price_v1_price_service_pb.GetCentsFromSatsForImmediateSellResponse) => void): grpc.ClientUnaryCall;
    getCentsFromSatsForFutureBuy(request: services_price_v1_price_service_pb.GetCentsFromSatsForFutureBuyRequest, callback: (error: grpc.ServiceError | null, response: services_price_v1_price_service_pb.GetCentsFromSatsForFutureBuyResponse) => void): grpc.ClientUnaryCall;
    getCentsFromSatsForFutureBuy(request: services_price_v1_price_service_pb.GetCentsFromSatsForFutureBuyRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: services_price_v1_price_service_pb.GetCentsFromSatsForFutureBuyResponse) => void): grpc.ClientUnaryCall;
    getCentsFromSatsForFutureBuy(request: services_price_v1_price_service_pb.GetCentsFromSatsForFutureBuyRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: services_price_v1_price_service_pb.GetCentsFromSatsForFutureBuyResponse) => void): grpc.ClientUnaryCall;
    getCentsFromSatsForFutureSell(request: services_price_v1_price_service_pb.GetCentsFromSatsForFutureSellRequest, callback: (error: grpc.ServiceError | null, response: services_price_v1_price_service_pb.GetCentsFromSatsForFutureSellResponse) => void): grpc.ClientUnaryCall;
    getCentsFromSatsForFutureSell(request: services_price_v1_price_service_pb.GetCentsFromSatsForFutureSellRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: services_price_v1_price_service_pb.GetCentsFromSatsForFutureSellResponse) => void): grpc.ClientUnaryCall;
    getCentsFromSatsForFutureSell(request: services_price_v1_price_service_pb.GetCentsFromSatsForFutureSellRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: services_price_v1_price_service_pb.GetCentsFromSatsForFutureSellResponse) => void): grpc.ClientUnaryCall;
    getSatsFromCentsForImmediateBuy(request: services_price_v1_price_service_pb.GetSatsFromCentsForImmediateBuyRequest, callback: (error: grpc.ServiceError | null, response: services_price_v1_price_service_pb.GetSatsFromCentsForImmediateBuyResponse) => void): grpc.ClientUnaryCall;
    getSatsFromCentsForImmediateBuy(request: services_price_v1_price_service_pb.GetSatsFromCentsForImmediateBuyRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: services_price_v1_price_service_pb.GetSatsFromCentsForImmediateBuyResponse) => void): grpc.ClientUnaryCall;
    getSatsFromCentsForImmediateBuy(request: services_price_v1_price_service_pb.GetSatsFromCentsForImmediateBuyRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: services_price_v1_price_service_pb.GetSatsFromCentsForImmediateBuyResponse) => void): grpc.ClientUnaryCall;
    getSatsFromCentsForImmediateSell(request: services_price_v1_price_service_pb.GetSatsFromCentsForImmediateSellRequest, callback: (error: grpc.ServiceError | null, response: services_price_v1_price_service_pb.GetSatsFromCentsForImmediateSellResponse) => void): grpc.ClientUnaryCall;
    getSatsFromCentsForImmediateSell(request: services_price_v1_price_service_pb.GetSatsFromCentsForImmediateSellRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: services_price_v1_price_service_pb.GetSatsFromCentsForImmediateSellResponse) => void): grpc.ClientUnaryCall;
    getSatsFromCentsForImmediateSell(request: services_price_v1_price_service_pb.GetSatsFromCentsForImmediateSellRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: services_price_v1_price_service_pb.GetSatsFromCentsForImmediateSellResponse) => void): grpc.ClientUnaryCall;
    getSatsFromCentsForFutureBuy(request: services_price_v1_price_service_pb.GetSatsFromCentsForFutureBuyRequest, callback: (error: grpc.ServiceError | null, response: services_price_v1_price_service_pb.GetSatsFromCentsForFutureBuyResponse) => void): grpc.ClientUnaryCall;
    getSatsFromCentsForFutureBuy(request: services_price_v1_price_service_pb.GetSatsFromCentsForFutureBuyRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: services_price_v1_price_service_pb.GetSatsFromCentsForFutureBuyResponse) => void): grpc.ClientUnaryCall;
    getSatsFromCentsForFutureBuy(request: services_price_v1_price_service_pb.GetSatsFromCentsForFutureBuyRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: services_price_v1_price_service_pb.GetSatsFromCentsForFutureBuyResponse) => void): grpc.ClientUnaryCall;
    getSatsFromCentsForFutureSell(request: services_price_v1_price_service_pb.GetSatsFromCentsForFutureSellRequest, callback: (error: grpc.ServiceError | null, response: services_price_v1_price_service_pb.GetSatsFromCentsForFutureSellResponse) => void): grpc.ClientUnaryCall;
    getSatsFromCentsForFutureSell(request: services_price_v1_price_service_pb.GetSatsFromCentsForFutureSellRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: services_price_v1_price_service_pb.GetSatsFromCentsForFutureSellResponse) => void): grpc.ClientUnaryCall;
    getSatsFromCentsForFutureSell(request: services_price_v1_price_service_pb.GetSatsFromCentsForFutureSellRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: services_price_v1_price_service_pb.GetSatsFromCentsForFutureSellResponse) => void): grpc.ClientUnaryCall;
    getCentsPerSatsExchangeMidRate(request: services_price_v1_price_service_pb.GetCentsPerSatsExchangeMidRateRequest, callback: (error: grpc.ServiceError | null, response: services_price_v1_price_service_pb.GetCentsPerSatsExchangeMidRateResponse) => void): grpc.ClientUnaryCall;
    getCentsPerSatsExchangeMidRate(request: services_price_v1_price_service_pb.GetCentsPerSatsExchangeMidRateRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: services_price_v1_price_service_pb.GetCentsPerSatsExchangeMidRateResponse) => void): grpc.ClientUnaryCall;
    getCentsPerSatsExchangeMidRate(request: services_price_v1_price_service_pb.GetCentsPerSatsExchangeMidRateRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: services_price_v1_price_service_pb.GetCentsPerSatsExchangeMidRateResponse) => void): grpc.ClientUnaryCall;
}

export class PriceServiceClient extends grpc.Client implements IPriceServiceClient {
    constructor(address: string, credentials: grpc.ChannelCredentials, options?: Partial<grpc.ClientOptions>);
    public getCentsFromSatsForImmediateBuy(request: services_price_v1_price_service_pb.GetCentsFromSatsForImmediateBuyRequest, callback: (error: grpc.ServiceError | null, response: services_price_v1_price_service_pb.GetCentsFromSatsForImmediateBuyResponse) => void): grpc.ClientUnaryCall;
    public getCentsFromSatsForImmediateBuy(request: services_price_v1_price_service_pb.GetCentsFromSatsForImmediateBuyRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: services_price_v1_price_service_pb.GetCentsFromSatsForImmediateBuyResponse) => void): grpc.ClientUnaryCall;
    public getCentsFromSatsForImmediateBuy(request: services_price_v1_price_service_pb.GetCentsFromSatsForImmediateBuyRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: services_price_v1_price_service_pb.GetCentsFromSatsForImmediateBuyResponse) => void): grpc.ClientUnaryCall;
    public getCentsFromSatsForImmediateSell(request: services_price_v1_price_service_pb.GetCentsFromSatsForImmediateSellRequest, callback: (error: grpc.ServiceError | null, response: services_price_v1_price_service_pb.GetCentsFromSatsForImmediateSellResponse) => void): grpc.ClientUnaryCall;
    public getCentsFromSatsForImmediateSell(request: services_price_v1_price_service_pb.GetCentsFromSatsForImmediateSellRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: services_price_v1_price_service_pb.GetCentsFromSatsForImmediateSellResponse) => void): grpc.ClientUnaryCall;
    public getCentsFromSatsForImmediateSell(request: services_price_v1_price_service_pb.GetCentsFromSatsForImmediateSellRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: services_price_v1_price_service_pb.GetCentsFromSatsForImmediateSellResponse) => void): grpc.ClientUnaryCall;
    public getCentsFromSatsForFutureBuy(request: services_price_v1_price_service_pb.GetCentsFromSatsForFutureBuyRequest, callback: (error: grpc.ServiceError | null, response: services_price_v1_price_service_pb.GetCentsFromSatsForFutureBuyResponse) => void): grpc.ClientUnaryCall;
    public getCentsFromSatsForFutureBuy(request: services_price_v1_price_service_pb.GetCentsFromSatsForFutureBuyRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: services_price_v1_price_service_pb.GetCentsFromSatsForFutureBuyResponse) => void): grpc.ClientUnaryCall;
    public getCentsFromSatsForFutureBuy(request: services_price_v1_price_service_pb.GetCentsFromSatsForFutureBuyRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: services_price_v1_price_service_pb.GetCentsFromSatsForFutureBuyResponse) => void): grpc.ClientUnaryCall;
    public getCentsFromSatsForFutureSell(request: services_price_v1_price_service_pb.GetCentsFromSatsForFutureSellRequest, callback: (error: grpc.ServiceError | null, response: services_price_v1_price_service_pb.GetCentsFromSatsForFutureSellResponse) => void): grpc.ClientUnaryCall;
    public getCentsFromSatsForFutureSell(request: services_price_v1_price_service_pb.GetCentsFromSatsForFutureSellRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: services_price_v1_price_service_pb.GetCentsFromSatsForFutureSellResponse) => void): grpc.ClientUnaryCall;
    public getCentsFromSatsForFutureSell(request: services_price_v1_price_service_pb.GetCentsFromSatsForFutureSellRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: services_price_v1_price_service_pb.GetCentsFromSatsForFutureSellResponse) => void): grpc.ClientUnaryCall;
    public getSatsFromCentsForImmediateBuy(request: services_price_v1_price_service_pb.GetSatsFromCentsForImmediateBuyRequest, callback: (error: grpc.ServiceError | null, response: services_price_v1_price_service_pb.GetSatsFromCentsForImmediateBuyResponse) => void): grpc.ClientUnaryCall;
    public getSatsFromCentsForImmediateBuy(request: services_price_v1_price_service_pb.GetSatsFromCentsForImmediateBuyRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: services_price_v1_price_service_pb.GetSatsFromCentsForImmediateBuyResponse) => void): grpc.ClientUnaryCall;
    public getSatsFromCentsForImmediateBuy(request: services_price_v1_price_service_pb.GetSatsFromCentsForImmediateBuyRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: services_price_v1_price_service_pb.GetSatsFromCentsForImmediateBuyResponse) => void): grpc.ClientUnaryCall;
    public getSatsFromCentsForImmediateSell(request: services_price_v1_price_service_pb.GetSatsFromCentsForImmediateSellRequest, callback: (error: grpc.ServiceError | null, response: services_price_v1_price_service_pb.GetSatsFromCentsForImmediateSellResponse) => void): grpc.ClientUnaryCall;
    public getSatsFromCentsForImmediateSell(request: services_price_v1_price_service_pb.GetSatsFromCentsForImmediateSellRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: services_price_v1_price_service_pb.GetSatsFromCentsForImmediateSellResponse) => void): grpc.ClientUnaryCall;
    public getSatsFromCentsForImmediateSell(request: services_price_v1_price_service_pb.GetSatsFromCentsForImmediateSellRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: services_price_v1_price_service_pb.GetSatsFromCentsForImmediateSellResponse) => void): grpc.ClientUnaryCall;
    public getSatsFromCentsForFutureBuy(request: services_price_v1_price_service_pb.GetSatsFromCentsForFutureBuyRequest, callback: (error: grpc.ServiceError | null, response: services_price_v1_price_service_pb.GetSatsFromCentsForFutureBuyResponse) => void): grpc.ClientUnaryCall;
    public getSatsFromCentsForFutureBuy(request: services_price_v1_price_service_pb.GetSatsFromCentsForFutureBuyRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: services_price_v1_price_service_pb.GetSatsFromCentsForFutureBuyResponse) => void): grpc.ClientUnaryCall;
    public getSatsFromCentsForFutureBuy(request: services_price_v1_price_service_pb.GetSatsFromCentsForFutureBuyRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: services_price_v1_price_service_pb.GetSatsFromCentsForFutureBuyResponse) => void): grpc.ClientUnaryCall;
    public getSatsFromCentsForFutureSell(request: services_price_v1_price_service_pb.GetSatsFromCentsForFutureSellRequest, callback: (error: grpc.ServiceError | null, response: services_price_v1_price_service_pb.GetSatsFromCentsForFutureSellResponse) => void): grpc.ClientUnaryCall;
    public getSatsFromCentsForFutureSell(request: services_price_v1_price_service_pb.GetSatsFromCentsForFutureSellRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: services_price_v1_price_service_pb.GetSatsFromCentsForFutureSellResponse) => void): grpc.ClientUnaryCall;
    public getSatsFromCentsForFutureSell(request: services_price_v1_price_service_pb.GetSatsFromCentsForFutureSellRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: services_price_v1_price_service_pb.GetSatsFromCentsForFutureSellResponse) => void): grpc.ClientUnaryCall;
    public getCentsPerSatsExchangeMidRate(request: services_price_v1_price_service_pb.GetCentsPerSatsExchangeMidRateRequest, callback: (error: grpc.ServiceError | null, response: services_price_v1_price_service_pb.GetCentsPerSatsExchangeMidRateResponse) => void): grpc.ClientUnaryCall;
    public getCentsPerSatsExchangeMidRate(request: services_price_v1_price_service_pb.GetCentsPerSatsExchangeMidRateRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: services_price_v1_price_service_pb.GetCentsPerSatsExchangeMidRateResponse) => void): grpc.ClientUnaryCall;
    public getCentsPerSatsExchangeMidRate(request: services_price_v1_price_service_pb.GetCentsPerSatsExchangeMidRateRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: services_price_v1_price_service_pb.GetCentsPerSatsExchangeMidRateResponse) => void): grpc.ClientUnaryCall;
}
