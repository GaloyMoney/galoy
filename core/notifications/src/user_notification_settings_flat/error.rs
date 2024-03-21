use thiserror::Error;

#[derive(Error, Debug)]
pub enum UserNotificationSettingsError {
    #[error("UserNotificationSettingsError - Sqlx: {0}")]
    Sqlx(sqlx::Error),
    #[error("UserNotificationSettingsError - EntityError: {0}")]
    EntityError(#[from] es_entity::EntityError),
    #[error("UserNotificationSettingsError - ConcurrentModification")]
    ConcurrentModification,
}

impl From<sqlx::Error> for UserNotificationSettingsError {
    fn from(error: sqlx::Error) -> Self {
        if let Some(err) = error.as_database_error() {
            if err.is_unique_violation()
                && err
                    .constraint()
                    .map_or(false, |c| c.contains("events_id_sequence_key"))
            {
                return Self::ConcurrentModification;
            }
        }
        Self::Sqlx(error)
    }
}
