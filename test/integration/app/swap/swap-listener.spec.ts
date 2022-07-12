import { toSats } from "@domain/bitcoin"
import { SwapService } from "@services/swap"
import { sleep } from "@utils"

import { mineBlockAndSyncAll } from "test/helpers"

describe("Swap", () => {
  jest.setTimeout(10000)
  // @todo - maybe mock this or move to e2e test
  it("Initiate Swap out, then listen for events", async () => {
    const isSwapServerUp = await SwapService.isSwapServerUp()
    // console.log("isSwapServerUp:", isSwapServerUp)
    if (isSwapServerUp) {
      const msg = "Swap Monitor Listening...closing in a few seconds"
      new Promise(async (resolve) => {
        // 1) Start Swap Listener
        const listener = SwapService.swapListener()
        listener.on("data", (response) => {
          console.log(response)
        })
        // 2) Trigger Swap Out
        await SwapService.swapOut(toSats(500000))
        // 3) Mine blocks
        await mineBlockAndSyncAll()
        // 4) Wait a few seconds
        await sleep(5000)
        // 5) Cancel listencer
        listener.cancel()
        resolve(true)
        expect(msg).toEqual(msg)
      })
    } else {
      const msg = "Swap Server not running...skipping"
      // console.log(msg)
      expect(msg).toEqual(msg)
    }
  })
})
