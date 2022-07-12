import { SwapServiceError, SwapClientNotResponding } from "@domain/swap/errors"
import { ISwapService, SwapOutResult } from "@domain/swap/index.types"

import { LoopRestClient } from "./loop-rest-client"
import { LoopRpcClient } from "./loop-rpc-client"

const LoopSwapProvider: ISwapService = {
  isSwapServerUp: async () => {
    try {
      new LoopRpcClient()
      return true
    } catch (e) {
      return false
    }
  },
  swapOut: async (amount) => {
    try {
      const resp = await LoopRestClient.loopOut(amount)
      if (resp.status == 500) throw new SwapClientNotResponding("500: " + resp.statusText)
      if (resp.status !== 200) throw Error(resp.data.message)
      const swapOutResult: SwapOutResult = {
        swapId: resp.data.id,
        swapIdBytes: resp.data.id_bytes,
        htlcAddress: resp.data.htlc_address,
        serverMessage: resp.data.server_message,
      }
      return swapOutResult
    } catch (e) {
      return e as SwapServiceError
    }
  },
  swapListener: () => {
    const swapClient = new LoopRpcClient()
    const listener = swapClient.listenForEvents()
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
  },
}

export default LoopSwapProvider
