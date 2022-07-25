import { GT } from "@graphql/index"

export const customFieldsInfo = [
  {
    schema: {
      name: "fieldNameNonNullString",
      type: "string",
      required: true,
    } as CustomField,
    field: { fieldNameNonNullString: { type: GT.NonNull(GT.String) } },
  },
  {
    schema: { name: "fieldNameString", type: "string", required: false } as CustomField,
    field: { fieldNameString: { type: GT.String } },
  },
  {
    schema: {
      name: "fieldNameNonNullInt",
      type: "integer",
      required: true,
    } as CustomField,
    field: { fieldNameNonNullInt: { type: GT.NonNull(GT.Int) } },
  },
  {
    schema: { name: "fieldNameInt", type: "integer", required: false } as CustomField,
    field: { fieldNameInt: { type: GT.Int } },
  },
  {
    schema: {
      name: "fieldNameNonNullFloat",
      type: "float",
      required: true,
    } as CustomField,
    field: { fieldNameNonNullFloat: { type: GT.NonNull(GT.Float) } },
  },
  {
    schema: { name: "fieldNameFloat", type: "float", required: false } as CustomField,
    field: { fieldNameFloat: { type: GT.Float } },
  },
  {
    schema: {
      name: "fieldNameNonNullBoolean",
      type: "boolean",
      required: true,
    } as CustomField,
    field: { fieldNameNonNullBoolean: { type: GT.NonNull(GT.Boolean) } },
  },
  {
    schema: { name: "fieldNameBoolean", type: "boolean", required: false } as CustomField,
    field: { fieldNameBoolean: { type: GT.Boolean } },
  },
]
