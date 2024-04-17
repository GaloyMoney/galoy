use thiserror::Error;

use crate::{
    email_executor::error::EmailExecutorError,
    email_reminder_projection::error::EmailReminderProjectionError,
    in_app_notification::error::InAppNotificationError, push_executor::error::PushExecutorError,
    user_notification_settings::error::UserNotificationSettingsError,
};

#[derive(Error, Debug)]
pub enum JobError {
    #[error("JobError - Sqlx: {0}")]
    Sqlx(#[from] sqlx::Error),
    #[error("JobError - UserNotificationSettings: {0}")]
    UserNotificationSettings(#[from] UserNotificationSettingsError),
    #[error("JobError - PushExecutorError: {0}")]
    PushExecutor(#[from] PushExecutorError),
    #[error("JobError - EmailExecutorError: {0}")]
    EmailExecutor(#[from] EmailExecutorError),
    #[error("JobError - EmailReminderProjection: {0}")]
    EmailReminderProjection(#[from] EmailReminderProjectionError),
    #[error("JobError - InAppNotificationError: {0}")]
    InAppNotificationError(#[from] InAppNotificationError),
}

impl job_executor::JobExecutionError for JobError {}
