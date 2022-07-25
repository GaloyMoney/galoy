import { GT } from "@graphql/index"
import { parseCustomFieldsSchema } from "@graphql/helpers"

import { customFieldsInfo } from "./custom-fields-info"

jest.mock("@services/redis", () => ({}))

jest.mock("@config", () => {
  const config = jest.requireActual("@config")
  const getLndParams = (): LndParams[] => []
  return { ...config, getLndParams }
})

describe("parseCustomFieldsSchema", () => {
  it("returns empty fields with an empty schema", () => {
    const result = parseCustomFieldsSchema([])
    expect(result).toEqual({})
  })

  it("returns default type as string", () => {
    const info = { name: "fieldName" }
    const result = parseCustomFieldsSchema([info])
    expect(result).toEqual(expect.objectContaining({ fieldName: { type: GT.String } }))
  })

  test.each(customFieldsInfo.filter((s) => s.schema.required))(
    "returns non-null $schema.type schema field",
    ({ schema, field }) => {
      const result = parseCustomFieldsSchema([schema])
      expect(result).toEqual(expect.objectContaining(field))
    },
  )

  test.each(customFieldsInfo.filter((s) => !s.schema.required))(
    "returns null $schema.type schema field",
    ({ schema, field }) => {
      const result = parseCustomFieldsSchema([schema])
      expect(result).toEqual(expect.objectContaining(field))
    },
  )

  it("returns multiple fields", () => {
    const schema = customFieldsInfo.map((s) => s.schema)
    const fields = Object.assign({}, ...customFieldsInfo.map((s) => s.field))
    const result = parseCustomFieldsSchema(schema)
    expect(Object.keys(result as object).length).toEqual(schema.length)
    expect(result).toEqual(expect.objectContaining(fields))
  })

  it("removes duplicated fields", () => {
    const schema = customFieldsInfo.map((s) => s.schema)
    const fields = Object.assign({}, ...customFieldsInfo.map((s) => s.field))
    const result = parseCustomFieldsSchema([...schema, ...schema.slice()])
    expect(Object.keys(result as object).length).toEqual(schema.length)
    expect(result).toEqual(expect.objectContaining(fields))
  })
})
