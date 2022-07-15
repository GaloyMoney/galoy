import util from "util"

import * as grpc from "@grpc/grpc-js"
import { getSwapConfig } from "@config"
import { SwapClientNotResponding, SwapServiceError } from "@domain/swap/errors"

import { SwapOutResult } from "@domain/swap/index.types"

import { SwapClientClient } from "./protos/loop_grpc_pb"
import {
  QuoteRequest,
  OutQuoteResponse,
  LoopOutRequest,
  SwapResponse,
  MonitorRequest,
  SwapStatus,
} from "./protos/loop_pb"

const loopMacaroon = process.env.LOOP_MACAROON
  ? convertMacaroonToHexString(Buffer.from(process.env.LOOP_MACAROON, "base64"))
  : ""

const loopTls = Buffer.from(process.env.LOOP_TLS ? process.env.LOOP_TLS : "", "base64")

function createClient(macaroon, tls): SwapClientClient {
  const loopUrl = getSwapConfig().loopRpcEndpoint
  const grpcOptions = {
    "grpc.max_receive_message_length": -1,
    "grpc.max_send_message_length": -1,
  }
  const sslCreds = grpc.credentials.createSsl(tls)
  const metadata = new grpc.Metadata()
  metadata.add("macaroon", macaroon)
  const macaroonCreds = grpc.credentials.createFromMetadataGenerator(
    (_args, callback) => {
      callback(null, metadata)
    },
  )
  const credentials = grpc.credentials.combineChannelCredentials(sslCreds, macaroonCreds)
  try {
    const client = new SwapClientClient(loopUrl, credentials, grpcOptions)
    return client
  } catch (e) {
    throw SwapClientNotResponding
  }
}

const swapClient = createClient(loopMacaroon, loopTls)

function convertMacaroonToHexString(macaroon) {
  const macaroonHexStr = macaroon.toString("hex")
  return macaroonHexStr
}

const clientHealthCheck = util.promisify<QuoteRequest, OutQuoteResponse>(
  swapClient.loopOutQuote.bind(swapClient),
)

const clientSwapOut = util.promisify<LoopOutRequest, SwapResponse>(
  swapClient.loopOut.bind(swapClient),
)

export const LoopService = () => {
  const healthCheck = async (): Promise<boolean> => {
    try {
      const request = new QuoteRequest()
      request.setAmt(500000)
      const resp = await clientHealthCheck(request)
      const fee = resp.getSwapFeeSat()
      if (fee) return true
    } catch (error) {
      console.log(error)
    }
    return false
  }

  const swapOut = async function (
    amount,
    maxSwapFee?,
  ): Promise<SwapOutResult | SwapServiceError> {
    const fee = maxSwapFee ? maxSwapFee : 20000
    try {
      const request = new LoopOutRequest()
      request.setAmt(amount)
      request.setMaxSwapFee(fee)
      request.setMaxPrepayRoutingFee(fee)
      request.setMaxSwapFee(fee)
      request.setMaxPrepayAmt(fee)
      request.setMaxMinerFee(fee)
      request.setSweepConfTarget(2)
      request.setHtlcConfirmations(1)
      request.setSwapPublicationDeadline(600) // TODO - play with these params --fast
      const resp = await clientSwapOut(request)
      const swapOutResult: SwapOutResult = {
        htlcAddress: resp.getHtlcAddress(),
        serverMessage: resp.getServerMessage(),
        swapId: resp.getId(),
        swapIdBytes: resp.getIdBytes().toString(),
      }
      return swapOutResult
    } catch (error) {
      return new SwapServiceError(error)
    }
  }

  const swapListener = function (): grpc.ClientReadableStream<SwapStatus> {
    try {
      const request = new MonitorRequest()
      const listener = swapClient.monitor(request)
      return listener
    } catch (error) {
      throw new SwapServiceError(error)
    }
  }

  return {
    healthCheck,
    swapOut,
    swapListener,
  }
}
