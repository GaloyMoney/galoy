mod convert;
mod schema;

use async_graphql::{extensions::Tracing, *};

pub use schema::*;

use crate::app::ApiKeysApp;

pub fn schema(app: Option<ApiKeysApp>) -> Schema<Query, Mutation, EmptySubscription> {
    let schema = Schema::build(Query, Mutation, EmptySubscription);
    let schema = schema.extension(Tracing);
    if let Some(app) = app {
        schema.data(app).finish()
    } else {
        schema.finish()
    }
}
