import {
  ApolloClient,
  InMemoryCache,
  ApolloLink,
  from,
  HttpLink,
  split,
  NormalizedCacheObject,
} from "@apollo/client/core"
import { getMainDefinition } from "@apollo/client/utilities"
import fetch from "cross-fetch"
import { createClient } from "graphql-ws"
import { GraphQLWsLink } from "@apollo/client/link/subscriptions"
import WebSocket from "ws"

export const localIpAddress = "127.0.0.1" as IpAddress

export type ApolloTestClientConfig = {
  authToken?: string
  port: string | number
  graphqlPath: string
  graphqlSubscriptionPath: string
}

const OATHKEEPER_PORT = 4002

export const defaultTestClientConfig = (authToken?: string): ApolloTestClientConfig => {
  return {
    authToken,
    port: OATHKEEPER_PORT,
    graphqlPath: "/graphql",
    graphqlSubscriptionPath: "/graphql",
  }
}

export const createApolloClient = (
  testClientConfg: ApolloTestClientConfig,
): { apolloClient: ApolloClient<NormalizedCacheObject>; disposeClient: () => void } => {
  const { authToken, port, graphqlPath, graphqlSubscriptionPath } = testClientConfg
  const cache = new InMemoryCache()

  const authLink = new ApolloLink((operation, forward) => {
    operation.setContext(({ headers }: { headers: Record<string, string> }) => ({
      headers: {
        "Authorization": authToken ? `Bearer ${authToken}` : "",
        "x-real-ip": localIpAddress,
        ...headers,
      },
    }))
    return forward(operation)
  })

  const httpLink = new HttpLink({ uri: `http://localhost:${port}${graphqlPath}`, fetch })

  console.log({
    uri: `ws://localhost:${port}${graphqlSubscriptionPath}`,
    connectionParams: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
  })

  const subscriptionClient = createClient({
    url: `ws://localhost:${port}${graphqlSubscriptionPath}`,
    connectionParams: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
    webSocketImpl: WebSocket,
  })

  const wsLink = new GraphQLWsLink(subscriptionClient)

  const splitLink = split(
    ({ query }) => {
      const definition = getMainDefinition(query)
      return (
        definition.kind === "OperationDefinition" &&
        definition.operation === "subscription"
      )
    },
    wsLink,
    from([authLink, httpLink]),
  )

  const apolloClient = new ApolloClient({
    cache,
    link: splitLink,
    defaultOptions: {
      watchQuery: {
        errorPolicy: "all",
      },
      query: {
        errorPolicy: "all",
      },
      mutate: {
        errorPolicy: "all",
      },
    },
  })

  const disposeClient = () => {
    apolloClient.clearStore()
    apolloClient.stop()
    subscriptionClient.terminate()
  }

  return {
    apolloClient,
    disposeClient,
  }
}

export const promisifiedSubscription = (subscription) => {
  return new Promise((resolve, reject) => {
    subscription.subscribe({ next: resolve, error: reject })
  })
}
