use api_keys::graphql::{MutationRoot, QueryRoot};
use async_graphql::{EmptySubscription, Schema};
use async_graphql_axum::{GraphQLRequest, GraphQLResponse};
use axum::{routing::get, Extension, Router};

#[tokio::main]
async fn main() {
    // Create a GraphQL schema with a simple query
    let schema = Schema::build(QueryRoot, MutationRoot, EmptySubscription).finish();

    // Create an axum router
    let app = Router::new()
        .route(
            "/graphql",
            get(playground).post(axum::routing::post(graphql_handler)),
        )
        .layer(Extension(schema));

    // Run the server
    axum::Server::bind(&"0.0.0.0:8000".parse().unwrap())
        .serve(app.into_make_service())
        .await
        .unwrap();
}

// GraphQL handler
async fn graphql_handler(
    schema: Extension<Schema<QueryRoot, MutationRoot, EmptySubscription>>,
    req: GraphQLRequest,
) -> GraphQLResponse {
    schema.execute(req.into_inner()).await.into()
}

// Playground handler
async fn playground() -> impl axum::response::IntoResponse {
    axum::response::Html(async_graphql::http::playground_source(
        async_graphql::http::GraphQLPlaygroundConfig::new("/graphql"),
    ))
}
