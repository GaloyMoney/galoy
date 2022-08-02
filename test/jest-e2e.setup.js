const { disconnectAll } = require("@services/redis")
const { setupMongoConnection } = require("@services/mongodb")

jest.mock("@services/lnd/auth", () => {
  const module = jest.requireActual("@services/lnd/auth")
  module.params = module.params.map((p) => ({ ...p, active: true }))
  return module
})

jest.mock("@services/lnd/unauth", () => {
  const module = jest.requireActual("@services/lnd/unauth")
  module.params = module.params.map((p) => ({ ...p, active: true }))
  return module
})

jest.mock("@services/dealer-price", () => require("test/mocks/dealer-price"))

let mongoose

beforeAll(async () => {
  mongoose = await setupMongoConnection(true)
})

afterAll(async () => {
  // avoids to use --forceExit
  disconnectAll()
  if (mongoose) {
    await mongoose.connection.close()
  }
})

jest.setTimeout(process.env.JEST_TIMEOUT || 90000)
