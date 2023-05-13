import { GT } from "@graphql/index"

import { Auth } from "@app"
import { mapAndParseErrorForGqlResponse } from "@graphql/error-map"
import JwtPayload from "@graphql/types/payload/jwt"
import { BTC_NETWORK } from "@config"

const UserLoginDeviceInput = GT.Input({
  name: "UserLoginDeviceInput",
  fields: () => ({
    jwt: {
      type: GT.String,
    },
  }),
})

const UserLoginDeviceMutation = GT.Field<{
  input: {
    jwt: string | InputValidationError
  }
}>({
  extensions: {
    complexity: 120,
  },
  type: GT.NonNull(JwtPayload),
  args: {
    input: { type: GT.NonNull(UserLoginDeviceInput) },
  },
  resolve: async (_, args, { ip }) => {
    const { jwt } = args.input

    if (jwt instanceof Error) {
      return { errors: [{ message: jwt.message }] }
    }

    if (ip === undefined) {
      return { errors: [{ message: "ip is undefined" }] }
    }

    // TODO: remove once ready for production
    if (BTC_NETWORK === "mainnet") {
      return { errors: [{ message: "currently not available on mainnet" }] }
    }

    const authToken = await Auth.loginWithDevice({
      jwt,
      ip,
    })

    if (authToken instanceof Error) {
      return { errors: [mapAndParseErrorForGqlResponse(authToken)] }
    }

    return { errors: [], authToken: jwt }
  },
})

export default UserLoginDeviceMutation
