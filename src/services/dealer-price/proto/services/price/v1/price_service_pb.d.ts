// package: services.price.v1
// file: services/price/v1/price_service.proto

/* tslint:disable */
/* eslint-disable */

import * as jspb from "google-protobuf";

export class GetCentsFromSatsForImmediateBuyRequest extends jspb.Message { 
    getAmountInSatoshis(): number;
    setAmountInSatoshis(value: number): GetCentsFromSatsForImmediateBuyRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): GetCentsFromSatsForImmediateBuyRequest.AsObject;
    static toObject(includeInstance: boolean, msg: GetCentsFromSatsForImmediateBuyRequest): GetCentsFromSatsForImmediateBuyRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: GetCentsFromSatsForImmediateBuyRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): GetCentsFromSatsForImmediateBuyRequest;
    static deserializeBinaryFromReader(message: GetCentsFromSatsForImmediateBuyRequest, reader: jspb.BinaryReader): GetCentsFromSatsForImmediateBuyRequest;
}

export namespace GetCentsFromSatsForImmediateBuyRequest {
    export type AsObject = {
        amountInSatoshis: number,
    }
}

export class GetCentsFromSatsForImmediateBuyResponse extends jspb.Message { 
    getAmountInCents(): number;
    setAmountInCents(value: number): GetCentsFromSatsForImmediateBuyResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): GetCentsFromSatsForImmediateBuyResponse.AsObject;
    static toObject(includeInstance: boolean, msg: GetCentsFromSatsForImmediateBuyResponse): GetCentsFromSatsForImmediateBuyResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: GetCentsFromSatsForImmediateBuyResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): GetCentsFromSatsForImmediateBuyResponse;
    static deserializeBinaryFromReader(message: GetCentsFromSatsForImmediateBuyResponse, reader: jspb.BinaryReader): GetCentsFromSatsForImmediateBuyResponse;
}

export namespace GetCentsFromSatsForImmediateBuyResponse {
    export type AsObject = {
        amountInCents: number,
    }
}

export class GetCentsFromSatsForImmediateSellRequest extends jspb.Message { 
    getAmountInSatoshis(): number;
    setAmountInSatoshis(value: number): GetCentsFromSatsForImmediateSellRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): GetCentsFromSatsForImmediateSellRequest.AsObject;
    static toObject(includeInstance: boolean, msg: GetCentsFromSatsForImmediateSellRequest): GetCentsFromSatsForImmediateSellRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: GetCentsFromSatsForImmediateSellRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): GetCentsFromSatsForImmediateSellRequest;
    static deserializeBinaryFromReader(message: GetCentsFromSatsForImmediateSellRequest, reader: jspb.BinaryReader): GetCentsFromSatsForImmediateSellRequest;
}

export namespace GetCentsFromSatsForImmediateSellRequest {
    export type AsObject = {
        amountInSatoshis: number,
    }
}

export class GetCentsFromSatsForImmediateSellResponse extends jspb.Message { 
    getAmountInCents(): number;
    setAmountInCents(value: number): GetCentsFromSatsForImmediateSellResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): GetCentsFromSatsForImmediateSellResponse.AsObject;
    static toObject(includeInstance: boolean, msg: GetCentsFromSatsForImmediateSellResponse): GetCentsFromSatsForImmediateSellResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: GetCentsFromSatsForImmediateSellResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): GetCentsFromSatsForImmediateSellResponse;
    static deserializeBinaryFromReader(message: GetCentsFromSatsForImmediateSellResponse, reader: jspb.BinaryReader): GetCentsFromSatsForImmediateSellResponse;
}

export namespace GetCentsFromSatsForImmediateSellResponse {
    export type AsObject = {
        amountInCents: number,
    }
}

export class GetCentsFromSatsForFutureBuyRequest extends jspb.Message { 
    getAmountInSatoshis(): number;
    setAmountInSatoshis(value: number): GetCentsFromSatsForFutureBuyRequest;
    getTimeInSeconds(): number;
    setTimeInSeconds(value: number): GetCentsFromSatsForFutureBuyRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): GetCentsFromSatsForFutureBuyRequest.AsObject;
    static toObject(includeInstance: boolean, msg: GetCentsFromSatsForFutureBuyRequest): GetCentsFromSatsForFutureBuyRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: GetCentsFromSatsForFutureBuyRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): GetCentsFromSatsForFutureBuyRequest;
    static deserializeBinaryFromReader(message: GetCentsFromSatsForFutureBuyRequest, reader: jspb.BinaryReader): GetCentsFromSatsForFutureBuyRequest;
}

export namespace GetCentsFromSatsForFutureBuyRequest {
    export type AsObject = {
        amountInSatoshis: number,
        timeInSeconds: number,
    }
}

export class GetCentsFromSatsForFutureBuyResponse extends jspb.Message { 
    getAmountInCents(): number;
    setAmountInCents(value: number): GetCentsFromSatsForFutureBuyResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): GetCentsFromSatsForFutureBuyResponse.AsObject;
    static toObject(includeInstance: boolean, msg: GetCentsFromSatsForFutureBuyResponse): GetCentsFromSatsForFutureBuyResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: GetCentsFromSatsForFutureBuyResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): GetCentsFromSatsForFutureBuyResponse;
    static deserializeBinaryFromReader(message: GetCentsFromSatsForFutureBuyResponse, reader: jspb.BinaryReader): GetCentsFromSatsForFutureBuyResponse;
}

export namespace GetCentsFromSatsForFutureBuyResponse {
    export type AsObject = {
        amountInCents: number,
    }
}

export class GetCentsFromSatsForFutureSellRequest extends jspb.Message { 
    getAmountInSatoshis(): number;
    setAmountInSatoshis(value: number): GetCentsFromSatsForFutureSellRequest;
    getTimeInSeconds(): number;
    setTimeInSeconds(value: number): GetCentsFromSatsForFutureSellRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): GetCentsFromSatsForFutureSellRequest.AsObject;
    static toObject(includeInstance: boolean, msg: GetCentsFromSatsForFutureSellRequest): GetCentsFromSatsForFutureSellRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: GetCentsFromSatsForFutureSellRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): GetCentsFromSatsForFutureSellRequest;
    static deserializeBinaryFromReader(message: GetCentsFromSatsForFutureSellRequest, reader: jspb.BinaryReader): GetCentsFromSatsForFutureSellRequest;
}

export namespace GetCentsFromSatsForFutureSellRequest {
    export type AsObject = {
        amountInSatoshis: number,
        timeInSeconds: number,
    }
}

export class GetCentsFromSatsForFutureSellResponse extends jspb.Message { 
    getAmountInCents(): number;
    setAmountInCents(value: number): GetCentsFromSatsForFutureSellResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): GetCentsFromSatsForFutureSellResponse.AsObject;
    static toObject(includeInstance: boolean, msg: GetCentsFromSatsForFutureSellResponse): GetCentsFromSatsForFutureSellResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: GetCentsFromSatsForFutureSellResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): GetCentsFromSatsForFutureSellResponse;
    static deserializeBinaryFromReader(message: GetCentsFromSatsForFutureSellResponse, reader: jspb.BinaryReader): GetCentsFromSatsForFutureSellResponse;
}

export namespace GetCentsFromSatsForFutureSellResponse {
    export type AsObject = {
        amountInCents: number,
    }
}

export class GetSatsFromCentsForImmediateBuyRequest extends jspb.Message { 
    getAmountInCents(): number;
    setAmountInCents(value: number): GetSatsFromCentsForImmediateBuyRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): GetSatsFromCentsForImmediateBuyRequest.AsObject;
    static toObject(includeInstance: boolean, msg: GetSatsFromCentsForImmediateBuyRequest): GetSatsFromCentsForImmediateBuyRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: GetSatsFromCentsForImmediateBuyRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): GetSatsFromCentsForImmediateBuyRequest;
    static deserializeBinaryFromReader(message: GetSatsFromCentsForImmediateBuyRequest, reader: jspb.BinaryReader): GetSatsFromCentsForImmediateBuyRequest;
}

export namespace GetSatsFromCentsForImmediateBuyRequest {
    export type AsObject = {
        amountInCents: number,
    }
}

export class GetSatsFromCentsForImmediateBuyResponse extends jspb.Message { 
    getAmountInSatoshis(): number;
    setAmountInSatoshis(value: number): GetSatsFromCentsForImmediateBuyResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): GetSatsFromCentsForImmediateBuyResponse.AsObject;
    static toObject(includeInstance: boolean, msg: GetSatsFromCentsForImmediateBuyResponse): GetSatsFromCentsForImmediateBuyResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: GetSatsFromCentsForImmediateBuyResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): GetSatsFromCentsForImmediateBuyResponse;
    static deserializeBinaryFromReader(message: GetSatsFromCentsForImmediateBuyResponse, reader: jspb.BinaryReader): GetSatsFromCentsForImmediateBuyResponse;
}

export namespace GetSatsFromCentsForImmediateBuyResponse {
    export type AsObject = {
        amountInSatoshis: number,
    }
}

export class GetSatsFromCentsForImmediateSellRequest extends jspb.Message { 
    getAmountInCents(): number;
    setAmountInCents(value: number): GetSatsFromCentsForImmediateSellRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): GetSatsFromCentsForImmediateSellRequest.AsObject;
    static toObject(includeInstance: boolean, msg: GetSatsFromCentsForImmediateSellRequest): GetSatsFromCentsForImmediateSellRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: GetSatsFromCentsForImmediateSellRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): GetSatsFromCentsForImmediateSellRequest;
    static deserializeBinaryFromReader(message: GetSatsFromCentsForImmediateSellRequest, reader: jspb.BinaryReader): GetSatsFromCentsForImmediateSellRequest;
}

export namespace GetSatsFromCentsForImmediateSellRequest {
    export type AsObject = {
        amountInCents: number,
    }
}

export class GetSatsFromCentsForImmediateSellResponse extends jspb.Message { 
    getAmountInSatoshis(): number;
    setAmountInSatoshis(value: number): GetSatsFromCentsForImmediateSellResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): GetSatsFromCentsForImmediateSellResponse.AsObject;
    static toObject(includeInstance: boolean, msg: GetSatsFromCentsForImmediateSellResponse): GetSatsFromCentsForImmediateSellResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: GetSatsFromCentsForImmediateSellResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): GetSatsFromCentsForImmediateSellResponse;
    static deserializeBinaryFromReader(message: GetSatsFromCentsForImmediateSellResponse, reader: jspb.BinaryReader): GetSatsFromCentsForImmediateSellResponse;
}

export namespace GetSatsFromCentsForImmediateSellResponse {
    export type AsObject = {
        amountInSatoshis: number,
    }
}

export class GetSatsFromCentsForFutureBuyRequest extends jspb.Message { 
    getAmountInCents(): number;
    setAmountInCents(value: number): GetSatsFromCentsForFutureBuyRequest;
    getTimeInSeconds(): number;
    setTimeInSeconds(value: number): GetSatsFromCentsForFutureBuyRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): GetSatsFromCentsForFutureBuyRequest.AsObject;
    static toObject(includeInstance: boolean, msg: GetSatsFromCentsForFutureBuyRequest): GetSatsFromCentsForFutureBuyRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: GetSatsFromCentsForFutureBuyRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): GetSatsFromCentsForFutureBuyRequest;
    static deserializeBinaryFromReader(message: GetSatsFromCentsForFutureBuyRequest, reader: jspb.BinaryReader): GetSatsFromCentsForFutureBuyRequest;
}

export namespace GetSatsFromCentsForFutureBuyRequest {
    export type AsObject = {
        amountInCents: number,
        timeInSeconds: number,
    }
}

export class GetSatsFromCentsForFutureBuyResponse extends jspb.Message { 
    getAmountInSatoshis(): number;
    setAmountInSatoshis(value: number): GetSatsFromCentsForFutureBuyResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): GetSatsFromCentsForFutureBuyResponse.AsObject;
    static toObject(includeInstance: boolean, msg: GetSatsFromCentsForFutureBuyResponse): GetSatsFromCentsForFutureBuyResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: GetSatsFromCentsForFutureBuyResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): GetSatsFromCentsForFutureBuyResponse;
    static deserializeBinaryFromReader(message: GetSatsFromCentsForFutureBuyResponse, reader: jspb.BinaryReader): GetSatsFromCentsForFutureBuyResponse;
}

export namespace GetSatsFromCentsForFutureBuyResponse {
    export type AsObject = {
        amountInSatoshis: number,
    }
}

export class GetSatsFromCentsForFutureSellRequest extends jspb.Message { 
    getAmountInCents(): number;
    setAmountInCents(value: number): GetSatsFromCentsForFutureSellRequest;
    getTimeInSeconds(): number;
    setTimeInSeconds(value: number): GetSatsFromCentsForFutureSellRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): GetSatsFromCentsForFutureSellRequest.AsObject;
    static toObject(includeInstance: boolean, msg: GetSatsFromCentsForFutureSellRequest): GetSatsFromCentsForFutureSellRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: GetSatsFromCentsForFutureSellRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): GetSatsFromCentsForFutureSellRequest;
    static deserializeBinaryFromReader(message: GetSatsFromCentsForFutureSellRequest, reader: jspb.BinaryReader): GetSatsFromCentsForFutureSellRequest;
}

export namespace GetSatsFromCentsForFutureSellRequest {
    export type AsObject = {
        amountInCents: number,
        timeInSeconds: number,
    }
}

export class GetSatsFromCentsForFutureSellResponse extends jspb.Message { 
    getAmountInSatoshis(): number;
    setAmountInSatoshis(value: number): GetSatsFromCentsForFutureSellResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): GetSatsFromCentsForFutureSellResponse.AsObject;
    static toObject(includeInstance: boolean, msg: GetSatsFromCentsForFutureSellResponse): GetSatsFromCentsForFutureSellResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: GetSatsFromCentsForFutureSellResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): GetSatsFromCentsForFutureSellResponse;
    static deserializeBinaryFromReader(message: GetSatsFromCentsForFutureSellResponse, reader: jspb.BinaryReader): GetSatsFromCentsForFutureSellResponse;
}

export namespace GetSatsFromCentsForFutureSellResponse {
    export type AsObject = {
        amountInSatoshis: number,
    }
}

export class GetCentsPerSatsExchangeMidRateRequest extends jspb.Message { 

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): GetCentsPerSatsExchangeMidRateRequest.AsObject;
    static toObject(includeInstance: boolean, msg: GetCentsPerSatsExchangeMidRateRequest): GetCentsPerSatsExchangeMidRateRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: GetCentsPerSatsExchangeMidRateRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): GetCentsPerSatsExchangeMidRateRequest;
    static deserializeBinaryFromReader(message: GetCentsPerSatsExchangeMidRateRequest, reader: jspb.BinaryReader): GetCentsPerSatsExchangeMidRateRequest;
}

export namespace GetCentsPerSatsExchangeMidRateRequest {
    export type AsObject = {
    }
}

export class GetCentsPerSatsExchangeMidRateResponse extends jspb.Message { 
    getRatioInCentsPerSatoshis(): number;
    setRatioInCentsPerSatoshis(value: number): GetCentsPerSatsExchangeMidRateResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): GetCentsPerSatsExchangeMidRateResponse.AsObject;
    static toObject(includeInstance: boolean, msg: GetCentsPerSatsExchangeMidRateResponse): GetCentsPerSatsExchangeMidRateResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: GetCentsPerSatsExchangeMidRateResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): GetCentsPerSatsExchangeMidRateResponse;
    static deserializeBinaryFromReader(message: GetCentsPerSatsExchangeMidRateResponse, reader: jspb.BinaryReader): GetCentsPerSatsExchangeMidRateResponse;
}

export namespace GetCentsPerSatsExchangeMidRateResponse {
    export type AsObject = {
        ratioInCentsPerSatoshis: number,
    }
}
