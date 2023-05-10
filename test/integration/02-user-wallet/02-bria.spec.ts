import { Wallets } from "@app"

import { sat2btc, toSats } from "@domain/bitcoin"

import { BriaSubscriber } from "@services/bria"
import { sleep } from "@utils"

import {
  bitcoindClient,
  bitcoindOutside,
  createMandatoryUsers,
  getDefaultWalletIdByTestUserRef,
  sendToAddressAndConfirm,
} from "test/helpers"

let walletIdA: WalletId

beforeAll(async () => {
  await createMandatoryUsers()

  await bitcoindClient.loadWallet({ filename: "outside" })

  walletIdA = await getDefaultWalletIdByTestUserRef("A")
})

afterAll(async () => {
  jest.restoreAllMocks()
  await bitcoindClient.unloadWallet({ walletName: "outside" })
})

describe("BriaSubscriber", () => {
  const bria = BriaSubscriber()

  it("subscribeToAll", async () => {
    const amountSats = toSats(5_000)

    let count = 0
    let expectedTxId: string | Error = ""
    const listener = bria.subscribeToAll()
    if (listener instanceof Error) throw Error

    listener.on("data", (response) => {
      const { txId } = response
      expect(expectedTxId).toBe(txId)

      count++
      return true
    })

    // Receive onchain
    const address = await Wallets.createOnChainAddressForBtcWallet(walletIdA)
    if (address instanceof Error) throw address
    expect(address.substring(0, 4)).toBe("bcrt")

    expectedTxId = await sendToAddressAndConfirm({
      walletClient: bitcoindOutside,
      address,
      amount: sat2btc(amountSats),
    })
    if (expectedTxId instanceof Error) throw expectedTxId

    let tries = 0
    while (count < 2 && tries < 30) {
      console.log({ count, tries })
      await sleep(500)
      tries++
    }
    expect(count).toEqual(2)

    listener.cancel()
  })
})
