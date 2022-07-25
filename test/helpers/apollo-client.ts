import {
  ApolloClient,
  InMemoryCache,
  ApolloLink,
  from,
  HttpLink,
  split,
  NormalizedCacheObject,
} from "@apollo/client/core"
import { WebSocketLink } from "@apollo/client/link/ws"
import { getMainDefinition } from "@apollo/client/utilities"
import fetch from "cross-fetch"
import { SubscriptionClient } from "subscriptions-transport-ws"
import ws from "ws"
import { GALOY_API_PORT } from "@config"

import { onError } from "@apollo/client/link/error"
import { baseLogger } from "@services/logger"

export const localIpAddress = "127.0.0.1" as IpAddress

export type ApolloTestClientConfig = {
  authToken?: string
  port: string | number
  graphqlPath: string
  graphqlSubscriptionPath: string
}

export const defaultTestClientConfig = (authToken?: string): ApolloTestClientConfig => {
  return {
    authToken,
    port: GALOY_API_PORT,
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
        "authorization": authToken ? `Bearer ${authToken}` : "",
        "x-real-ip": localIpAddress,
        ...headers,
      },
    }))
    return forward(operation)
  })

  const httpLink = new HttpLink({ uri: `http://localhost:${port}${graphqlPath}`, fetch })

  const subscriptionClient = new SubscriptionClient(
    `ws://localhost:${port}${graphqlSubscriptionPath}`,
    {
      connectionParams: {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      },
    },
    ws,
  )

  const wsLink = new WebSocketLink(subscriptionClient)

  const errorLink = onError(({ graphQLErrors, networkError }) => {
    if (graphQLErrors)
      graphQLErrors.forEach(({ message, locations, path }) =>
        baseLogger.error(
          `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`,
        ),
      )
    if (networkError) baseLogger.error(`[Network error]: ${networkError}`)
  })

  const splitLink = split(
    ({ query }) => {
      const definition = getMainDefinition(query)
      return (
        definition.kind === "OperationDefinition" &&
        definition.operation === "subscription"
      )
    },
    wsLink,
    from([errorLink, authLink, httpLink]),
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
    subscriptionClient.close()
  }

  return {
    apolloClient,
    disposeClient,
  }
}

export const getSubscriptionNext = (subscription) => {
  return new Promise((resolve, reject) => {
    subscription.subscribe({ next: resolve, error: reject })
  })
}
