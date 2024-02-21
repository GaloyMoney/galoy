use serde::{Deserialize, Serialize};

use super::{DeepLink, NotificationEvent, NotificationEventError};
use crate::{messages::*, primitives::*};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CircleThresholdReached {
    pub user_id: GaloyUserId,
    pub circle_type: CircleType,
    pub time_frame: CircleTimeFrame,
    pub threshold: u32,
}

impl NotificationEvent for CircleThresholdReached {
    fn category(&self) -> UserNotificationCategory {
        UserNotificationCategory::Circles
    }

    fn user_id(&self) -> &GaloyUserId {
        &self.user_id
    }

    fn deep_link(&self) -> DeepLink {
        DeepLink::Circles
    }

    fn to_localized_push_msg(&self, locale: GaloyLocale) -> LocalizedPushMessage {
        PushMessages::circle_threshold_reached(locale.as_ref(), self)
    }

    fn to_localized_email(
        &self,
        locale: GaloyLocale,
    ) -> Result<Option<LocalizedEmail>, NotificationEventError> {
        Ok(EmailMessages::circle_threshold_reached(
            locale.as_ref(),
            self,
        )?)
    }

    fn should_send_email(&self) -> bool {
        false
    }
}
