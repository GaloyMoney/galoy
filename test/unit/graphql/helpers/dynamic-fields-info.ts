import { GT } from "@graphql/index"

export const dynamicFieldsInfo = [
  {
    schema: {
      name: "fieldNameNonNullString",
      type: "string",
      required: true,
    } as DynamicField,
    field: { fieldNameNonNullString: { type: GT.NonNull(GT.String) } },
  },
  {
    schema: { name: "fieldNameString", type: "string", required: false } as DynamicField,
    field: { fieldNameString: { type: GT.String } },
  },
  {
    schema: {
      name: "fieldNameNonNullInt",
      type: "integer",
      required: true,
    } as DynamicField,
    field: { fieldNameNonNullInt: { type: GT.NonNull(GT.Int) } },
  },
  {
    schema: { name: "fieldNameInt", type: "integer", required: false } as DynamicField,
    field: { fieldNameInt: { type: GT.Int } },
  },
  {
    schema: {
      name: "fieldNameNonNullFloat",
      type: "float",
      required: true,
    } as DynamicField,
    field: { fieldNameNonNullFloat: { type: GT.NonNull(GT.Float) } },
  },
  {
    schema: { name: "fieldNameFloat", type: "float", required: false } as DynamicField,
    field: { fieldNameFloat: { type: GT.Float } },
  },
]
