export const parseIps = (
  ips: undefined | string | string[] | unknown,
): IpAddress | undefined => {
  if (!ips) return undefined

  if (Array.isArray(ips) && ips.length) {
    if (typeof ips[0] === "string") return toIpAddress(ips[0])
    return undefined
  }

  if (typeof ips === "string") {
    if (ips.includes(",")) return toIpAddress(ips.split(",")[0])
    return toIpAddress(ips)
  }

  return undefined
}

const toIpAddress = (ip: string): IpAddress | undefined => {
  if (!ip) return undefined

  const trimmedIp = ip.trim()
  if (!trimmedIp) return undefined

  return trimmedIp as IpAddress
}
