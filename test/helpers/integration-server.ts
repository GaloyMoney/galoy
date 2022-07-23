import childProcess from "child_process"
import { promisify } from "util"

import kill from "tree-kill"

export type PID = number & { readonly brand: unique symbol }

export const startServer = async (command: string): Promise<PID> => {
  const serverStartMessage = "server ready"
  return new Promise<PID>((resolve) => {
    const serverProcess = childProcess.spawn("make", [command], {
      killSignal: "SIGKILL",
      env: { ...process.env, NEW_SERVER: "true" }, // TODO: remove NEW_SERVER after WS migration
    })
    const serverPid = serverProcess.pid as PID
    serverProcess.stdout.on("data", (data) => {
      console.log(data.toString())
      if (data.includes(serverStartMessage)) {
        resolve(serverPid)
      }
      serverProcess.removeAllListeners()
    })
  })
}

const killAsync = promisify<number, string>(kill)

export const killServer = async (serverPid: PID): Promise<void> =>
  killAsync(serverPid, "SIGKILL")
