#![cfg_attr(feature = "fail-on-warnings", deny(warnings))]
#![cfg_attr(feature = "fail-on-warnings", deny(clippy::all))]

rust_i18n::i18n!("locales", fallback = "en");

mod app;
mod data_import;
mod job;
mod messages;

pub mod cli;
pub mod email_executor;
pub mod graphql;
pub mod grpc;
pub mod notification_cool_off_tracker;
pub mod notification_event;
pub mod primitives;
pub mod push_executor;
pub mod user_notification_settings;
pub mod user_notification_settings_flat;
