import * as grpc from "@grpc/grpc-js"
import * as protoLoader from "@grpc/proto-loader"

import { getSwapConfig } from "@config"

import { SwapClientNotResponding } from "@domain/swap/errors"

import { ProtoGrpcType } from "./protos/generated/loop"
import { SwapStatus__Output } from "./protos/generated/looprpc/SwapStatus"
import { SwapClientClient } from "./protos/generated/looprpc/SwapClient"
import { LoopOutRequest } from "./protos/generated/looprpc/LoopOutRequest"

export class LoopRpcClient {
  swapClient: SwapClientClient

  constructor(swapClient?: SwapClientClient) {
    if (swapClient) {
      this.swapClient = swapClient // pass in your own implementation or mock
    } else {
      this.swapClient = this.createRpcClient()
    }
  }

  createRpcClient() {
    const loopMacaroon = process.env.LOOP_MACAROON
      ? this.convertMacaroonToHexString(Buffer.from(process.env.LOOP_MACAROON, "base64"))
      : ""
    const loopTls = Buffer.from(
      process.env.LOOP_TLS ? process.env.LOOP_TLS : "",
      "base64",
    )

    const loaderOptions = {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    }
    const loopUrl = getSwapConfig().loopRpcEndpoint
    const grpcOptions = {
      "grpc.max_receive_message_length": -1,
      "grpc.max_send_message_length": -1,
    }

    const packageDefinition = protoLoader.loadSync(
      `${__dirname}/protos/loop.proto`,
      loaderOptions,
    )
    const proto = grpc.loadPackageDefinition(
      packageDefinition,
    ) as unknown as ProtoGrpcType

    const sslCreds = grpc.credentials.createSsl(loopTls)
    const metadata = new grpc.Metadata()
    metadata.add("macaroon", loopMacaroon)
    const macaroonCreds = grpc.credentials.createFromMetadataGenerator(
      (_args, callback) => {
        callback(null, metadata)
      },
    )
    const credentials = grpc.credentials.combineChannelCredentials(
      sslCreds,
      macaroonCreds,
    )

    try {
      const swapClient = new proto.looprpc.SwapClient(loopUrl, credentials, grpcOptions)
      return swapClient
    } catch (e) {
      throw SwapClientNotResponding
    }
  }

  async isSwapServerUp(): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      this.swapClient.LoopOutQuote({ amt: 500000 }, (err, resp) => {
        // console.log(err)
        // console.log(resp)
        if (err) resolve(false)
        if (resp) reject(true)
      })
    })
  }

  listenForEvents(): grpc.ClientReadableStream<SwapStatus__Output> {
    const request = {}
    const listener = this.swapClient.monitor(request)
    // listener.on("data", (response) => {
    //   // A response was received from the server.
    //   console.log(response)
    // })
    // listener.on("status", (status) => {
    //   // The current status of the stream.
    //   console.log(status)
    // })
    // listener.on("end", () => {
    //   // The server has closed the stream.
    // })
    return listener
  }

  swapOut(amt, callback?, fee?): grpc.ClientUnaryCall {
    const request: LoopOutRequest = {
      amt,
      maxSwapRoutingFee: fee,
      maxPrepayRoutingFee: fee,
      maxSwapFee: fee,
      maxPrepayAmt: fee,
      maxMinerFee: fee,
      sweepConfTarget: 2,
      htlcConfirmations: 1,
      swapPublicationDeadline: 600, // @todo - play with these params --fast
    }
    const loopOutRequest = this.swapClient.LoopOut(request, callback)
    return loopOutRequest
  }

  convertMacaroonToHexString(macaroon) {
    const macaroonHexStr = macaroon.toString("hex")
    return macaroonHexStr
  }
}
