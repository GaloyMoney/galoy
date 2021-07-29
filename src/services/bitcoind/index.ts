import Client from "bitcoin-core"
import _ from "lodash"

import { btc2sat } from "@core/utils"

const connection_obj = {
  network: process.env.NETWORK,
  username: "rpcuser",
  password: process.env.BITCOINDRPCPASS,
  host: process.env.BITCOINDADDR,
  port: process.env.BITCOINDPORT,
  version: "0.21.0",
}

type ScriptPubKey = {
  asm: string
  hex: string
  reqSigs: number
  type: string
  addresses: [string]
}

type VOut = {
  value: number
  n: number
  scriptPubKey: ScriptPubKey
}

type DecodeRawTransactionResult = {
  txid: string
  vout: [VOut]
}

type GetAddressInfoResult = {
  address: string
  scriptPubKey: string
  ismine: boolean
  iswatchonly: boolean
  solvable: boolean
  isscript: boolean
  ischange: boolean
  iswitness: boolean
  // TODO? all avaialable: https://developer.bitcoin.org/reference/rpc/getaddressinfo.html#result
}

type InWalletTransaction = {
  "amount": number
  "fee": number
  "confirmations": number
  "generated": boolean
  "trusted": boolean
  "blockhash": string
  "blockheight": number
  "blockindex": number
  "blocktime": number
  "txid": string
  "time": number
  "timereceived": number
  "comment": string
  "bip125-replaceable": string
  "hex": string
  // TODO? all avaialable: https://developer.bitcoin.org/reference/rpc/gettransaction.html#result
}

export class BitcoindClient {
  readonly client

  constructor() {
    this.client = new Client({ ...connection_obj })
  }

  async getBlockCount(): Promise<number> {
    return await this.client.getBlockCount()
  }

  async getBlockchainInfo(): Promise<{ chain: string }> {
    return await this.client.getBlockchainInfo()
  }

  async createWallet({
    wallet_name,
  }: {
    wallet_name: string
  }): Promise<{ name: string; warning: string }> {
    return await this.client.createWallet({ wallet_name })
  }

  async listWallets(): Promise<[string]> {
    return await this.client.listWallets()
  }

  async decodeRawTransaction({
    hexstring,
  }: {
    hexstring: string
  }): Promise<DecodeRawTransactionResult> {
    return await this.client.decodeRawTransaction({ hexstring })
  }

  // default client knows about all transactions of its wallets

  async getTransaction({
    txid,
    include_watchonly = true,
  }: {
    txid: string
    include_watchonly: boolean
  }): Promise<InWalletTransaction> {
    return await this.client.getTransaction({ txid, include_watchonly })
  }

  // load/unload only used in tests, for now

  async loadWallet({
    filename,
  }: {
    filename: string
  }): Promise<{ name: string; warning: string }> {
    return await this.client.loadWallet({ filename })
  }

  async unloadWallet({
    wallet_name,
  }: {
    wallet_name: string
  }): Promise<{ warning: string }> {
    return await this.client.unloadWallet({ wallet_name })
  }

  // for tests
  async getZmqNotifications(): Promise<[Record<string, unknown>]> {
    return await this.client.getZmqNotifications()
  }
}

export class BitcoindWalletClient {
  readonly client

  constructor({ walletName }: { walletName: string }) {
    this.client = new Client({ ...connection_obj, wallet: walletName })
  }

  async getNewAddress(): Promise<string> {
    return await this.client.getNewAddress()
  }

  async getAddressInfo({ address }: { address: string }): Promise<GetAddressInfoResult> {
    return await this.client.getAddressInfo({ address })
  }

  async sendToAddress({
    address,
    amount,
  }: {
    address: string
    amount: number
  }): Promise<string> {
    return await this.client.sendToAddress({ address, amount })
  }

  async generateToAddress({
    nblocks,
    address,
  }: {
    nblocks: number
    address: string
  }): Promise<[string]> {
    return await this.client.generateToAddress({ nblocks, address })
  }

  async getBalance(): Promise<number> {
    return await this.client.getBalance()
  }

  async walletCreateFundedPsbt({
    inputs,
    outputs,
  }: {
    inputs: []
    outputs: Record<string, number>[]
  }): Promise<{ psbt: string }> {
    return await this.client.walletCreateFundedPsbt({ inputs, outputs })
  }

  async walletProcessPsbt({ psbt }: { psbt: string }): Promise<{ psbt: string }> {
    return await this.client.walletProcessPsbt({ psbt })
  }

  async finalizePsbt({
    psbt,
  }: {
    psbt: string
  }): Promise<{ psbt: string; hex: string; complete: boolean }> {
    return await this.client.finalizePsbt({ psbt })
  }

  async sendRawTransaction({ hexstring }: { hexstring: string }): Promise<string> {
    return await this.client.sendRawTransaction({ hexstring })
  }
}

// The default client should remain without a wallet (not generate or receive bitcoin)
export const bitcoindDefaultClient = new BitcoindClient()

export const getBalancesDetail = async (): Promise<
  { wallet: string; balance: number }[]
> => {
  const wallets = await bitcoindDefaultClient.listWallets()

  const balances: { wallet: string; balance: number }[] = []

  for await (const wallet of wallets) {
    // do not consider the "outside" wallet in tests
    if (wallet === "" || wallet === "outside") {
      continue
    }

    const client = new BitcoindWalletClient({ walletName: wallet })
    const balance = btc2sat(await client.getBalance())
    balances.push({ wallet, balance })
  }

  return balances
}

export const getBalance = async (): Promise<number> => {
  const balanceObj = await getBalancesDetail()
  return _.sumBy(balanceObj, "balance")
}
