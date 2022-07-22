import { GT } from "@graphql/index"
import { parseDynamicFieldSchema } from "@graphql/helpers"

import { dynamicFieldsInfo } from "./dynamic-fields-info"

jest.mock("@services/redis", () => ({}))

jest.mock("@config", () => {
  const config = jest.requireActual("@config")
  const getLndParams = (): LndParams[] => []
  return { ...config, getLndParams }
})

describe("parseDynamicFieldSchema", () => {
  it("returns empty fields with an empty schema", () => {
    const result = parseDynamicFieldSchema([])
    expect(result).toEqual({})
  })

  it("returns default type as string", () => {
    const info = { name: "fieldName" }
    const result = parseDynamicFieldSchema([info])
    expect(result).toEqual(expect.objectContaining({ fieldName: { type: GT.String } }))
  })

  test.each(dynamicFieldsInfo.filter((s) => s.schema.required))(
    "returns non-null $schema.type schema field",
    ({ schema, field }) => {
      const result = parseDynamicFieldSchema([schema])
      expect(result).toEqual(expect.objectContaining(field))
    },
  )

  test.each(dynamicFieldsInfo.filter((s) => !s.schema.required))(
    "returns null $schema.type schema field",
    ({ schema, field }) => {
      const result = parseDynamicFieldSchema([schema])
      expect(result).toEqual(expect.objectContaining(field))
    },
  )

  it("returns multiple fields", () => {
    const schema = dynamicFieldsInfo.map((s) => s.schema)
    const fields = Object.assign({}, ...dynamicFieldsInfo.map((s) => s.field))
    const result = parseDynamicFieldSchema(schema)
    expect(Object.keys(result as object).length).toEqual(schema.length)
    expect(result).toEqual(expect.objectContaining(fields))
  })

  it("removes duplicated fields", () => {
    const schema = dynamicFieldsInfo.map((s) => s.schema)
    const fields = Object.assign({}, ...dynamicFieldsInfo.map((s) => s.field))
    const result = parseDynamicFieldSchema([...schema, ...schema.slice()])
    expect(Object.keys(result as object).length).toEqual(schema.length)
    expect(result).toEqual(expect.objectContaining(fields))
  })
})
