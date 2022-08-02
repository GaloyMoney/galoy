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
    const result = parseCustomFieldsSchema({ fields: [] })
    expect(result).toEqual({})
  })

  it("returns empty with onlyEditable for non editable schema", () => {
    const customEditableFields = customFieldsInfo.filter((s) => !s.schema.editable)
    const schema = customEditableFields.map((s) => s.schema)
    const result = parseCustomFieldsSchema({ fields: schema, onlyEditable: true })
    expect(result).toEqual({})
  })

  it("returns default type as string", () => {
    const info = { name: "fieldName" }
    const result = parseCustomFieldsSchema({ fields: [info] })
    expect(result).toEqual(expect.objectContaining({ fieldName: { type: GT.String } }))
  })

  test.each(customFieldsInfo.filter((s) => s.schema.required))(
    "returns non-null $schema.type schema field",
    ({ schema, field }) => {
      const result = parseCustomFieldsSchema({ fields: [schema] })
      expect(result).toEqual(expect.objectContaining(field))
    },
  )

  test.each(customFieldsInfo.filter((s) => !s.schema.required))(
    "returns null $schema.type schema field",
    ({ schema, field }) => {
      const result = parseCustomFieldsSchema({ fields: [schema] })
      expect(result).toEqual(expect.objectContaining(field))
    },
  )

  it("returns multiple fields", () => {
    const schema = customFieldsInfo.map((s) => s.schema)
    const fields = Object.assign({}, ...customFieldsInfo.map((s) => s.field))
    const result = parseCustomFieldsSchema({ fields: schema })
    expect(Object.keys(result as object).length).toEqual(Object.keys(fields).length)
    expect(result).toEqual(expect.objectContaining(fields))
  })

  it("returns multiple editable fields", () => {
    const customEditableFields = customFieldsInfo.filter((s) => !!s.schema.editable)
    const schema = customFieldsInfo.map((s) => s.schema)
    const fields = Object.assign({}, ...customEditableFields.map((s) => s.field))
    const result = parseCustomFieldsSchema({ fields: schema, onlyEditable: true })
    expect(Object.keys(result as object).length).toEqual(Object.keys(fields).length)
    expect(result).toEqual(expect.objectContaining(fields))
  })

  it("removes duplicated fields", () => {
    const schema = customFieldsInfo.map((s) => s.schema)
    const fields = Object.assign({}, ...customFieldsInfo.map((s) => s.field))
    const result = parseCustomFieldsSchema({ fields: [...schema, ...schema.slice()] })
    expect(Object.keys(result as object).length).toEqual(Object.keys(fields).length)
    expect(result).toEqual(expect.objectContaining(fields))
  })
})
