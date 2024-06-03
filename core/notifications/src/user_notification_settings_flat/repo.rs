use std::collections::HashSet;

use serde::Deserialize;
use sqlx::{FromRow, PgPool};

use super::{entity::*, error::*};
use crate::primitives::*;

#[derive(Debug, Clone)]
pub struct UserNotificationSettingsRepo {
    pool: PgPool,
}

#[derive(Debug, Deserialize, FromRow)]
pub struct UserNotificationSettingsData {
    pub id: String,
    pub galoy_user_id: String,
    pub push_enabled: bool,
    pub disabled_push_categories: HashSet<UserNotificationCategory>,
    pub email: Option<String>,
    pub locale: Option<String>,
    pub push_device_tokens: HashSet<String>,
}

impl UserNotificationSettingsRepo {
    pub fn new(pool: &PgPool) -> Self {
        Self { pool: pool.clone() }
    }

    pub async fn find_for_user_id(
        &self,
        user_id: &GaloyUserId,
    ) -> Result<UserNotificationSettings, UserNotificationSettingsError> {
        let rows = sqlx::query_as!(
            GenericEvent,
            r#"SELECT *
            FROM non_es_user_notification_settings a
            WHERE a.galoy_user_id = $1"#,
            user_id.as_ref(),
        )
        .fetch_all(&self.pool)
        .await?;

        let res = EntityEvents::load_first::<UserNotificationSettings>(rows);
        if matches!(res, Err(EntityError::NoEntityEventsPresent)) {
            return Ok(UserNotificationSettings::new(user_id.clone()));
        }
        Ok(res?)
    }

    pub async fn persist(
        &self,
        settings: &mut UserNotificationSettings,
    ) -> Result<(), UserNotificationSettingsError> {
        let mut tx = self.pool.begin().await?;
        sqlx::query!(
            r#"INSERT INTO user_notification_settings (id, galoy_user_id)
            VALUES ($1, $2) ON CONFLICT DO NOTHING"#,
            settings.id as UserNotificationSettingsId,
            settings.galoy_user_id.as_ref(),
        )
        .execute(&mut *tx)
        .await?;
        settings.events.persist(&mut tx).await?;
        tx.commit().await?;
        Ok(())
    }

    pub async fn list_ids_after(
        &self,
        id: &GaloyUserId,
    ) -> Result<(Vec<GaloyUserId>, bool), UserNotificationSettingsError> {
        let batch_limit = 1000;
        let rows = sqlx::query!(
            r#"SELECT galoy_user_id
               FROM user_notification_settings
               WHERE galoy_user_id > $1
               ORDER BY galoy_user_id
               LIMIT $2"#,
            id.as_ref(),
            batch_limit as i64 + 1,
        )
        .fetch_all(&self.pool)
        .await?;
        let more = rows.len() > batch_limit;
        Ok((
            rows.into_iter()
                .take(batch_limit)
                .map(|r| GaloyUserId::from(r.galoy_user_id))
                .collect(),
            more,
        ))
    }
}
