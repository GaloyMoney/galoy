import axios from "axios"
import MockAdapter from "axios-mock-adapter"

import { IpFetcher } from "@/services/ipfetcher"

/* eslint @typescript-eslint/ban-ts-comment: "off" */
// @ts-ignore-next-line no-implicit-any error
let mock

beforeAll(() => {
  mock = new MockAdapter(axios)
})

afterEach(() => {
  // @ts-ignore-next-line no-implicit-any error
  mock.reset()
})

describe("IpFetcher - fetchIPInfo", () => {
  it("returns proxy false when proxy is no", async () => {
    const ip = "152.231.190.229" as IpAddress
    // @ts-ignore-next-line no-implicit-any error
    mock.onGet(new RegExp(`${ip}`)).reply(200, getIpInfo(ip))

    const ipInfo = await IpFetcher().fetchIPInfo(ip)
    expect(ipInfo).toEqual(
      expect.objectContaining({
        proxy: false,
        status: "ok",
      }),
    )
  })

  it("returns proxy true when proxy is yes", async () => {
    const ip = "152.231.190.229" as IpAddress
    const data = getIpInfo(ip)
    // @ts-ignore-next-line no-implicit-any error
    data[ip]["proxy"] = "yes"

    // @ts-ignore-next-line no-implicit-any error
    mock.onGet(new RegExp(`${ip}`)).reply(200, data)

    const ipInfo = await IpFetcher().fetchIPInfo(ip)
    expect(ipInfo).toEqual(
      expect.objectContaining({
        proxy: true,
        status: "ok",
      }),
    )
  })

  it("returns proxy false when proxy is undefined", async () => {
    const ip = "152.231.190.229" as IpAddress
    const data = getIpInfo(ip)

    // @ts-ignore-next-line no-implicit-any error
    delete data[ip]["proxy"]

    // @ts-ignore-next-line no-implicit-any error
    mock.onGet(new RegExp(`${ip}`)).reply(200, data)

    const ipInfo = await IpFetcher().fetchIPInfo(ip)
    expect(ipInfo).toEqual(
      expect.objectContaining({
        proxy: false,
        status: "ok",
      }),
    )
  })
})

const getIpInfo = (ip: string) => ({
  status: "ok",
  [ip]: {
    asn: "AS52228",
    provider: "Cable Tica",
    organisation: "Cable Tica",
    continent: "North America",
    country: "Costa Rica",
    isoCode: "CR",
    region: "Provincia de San Jose",
    regioncode: "SJ",
    city: "Perez Zeledon",
    latitude: 9.3573,
    longitude: -83.6356,
    proxy: "no",
    type: "Residential",
  },
})
