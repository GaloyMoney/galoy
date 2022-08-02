import { rule } from "graphql-shield"

export const isAuthenticated = rule({ cache: "contextual" })(
  (parent, args, ctx: GraphQLContextForUser) => {
    return ctx.uid !== null ? true : "NOT_AUTHENTICATED"
  },
)

export const isEditor = rule({ cache: "contextual" })(
  (parent, args, ctx: GraphQLContextForUser) => {
    return ctx.domainUser.isEditor ? true : "NOT_AUTHORIZED"
  },
)

const shouldGetNewServer = () => {
  return process.env.NEW_SERVER?.toLowerCase() === "true"
}

export const serverPath = shouldGetNewServer()
  ? "./graphql-server"
  : "./graphql-server-legacy"
