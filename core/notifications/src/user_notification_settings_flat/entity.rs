use std::collections::HashSet;

use crate::{primitives::*, user_notification_settings};

pub struct UserNotificationSettings {
    pub id: UserNotificationSettingsId,
    pub galoy_user_id: GaloyUserId,
    locale: Option<GaloyLocale>,
    push_enabled: bool,
    disabled_push_categories: HashSet<UserNotificationCategory>,
    push_device_tokens: HashSet<PushDeviceToken>,
    email_address: Option<GaloyEmailAddress>,
}

impl UserNotificationSettings {
    pub(super) fn new(galoy_user_id: GaloyUserId) -> Self {
        let id = UserNotificationSettingsId::new();
        Self {
            id,
            galoy_user_id,
            locale: None,
            push_enabled: true,
            disabled_push_categories: HashSet::new(),
            push_device_tokens: HashSet::new(),
            email_address: None,
        }
    }

    pub fn update_locale(&mut self, locale: GaloyLocale) {
        self.locale = Some(locale);
    }

    pub fn set_locale_to_default(&mut self) {
        self.locale = None;
    }

    pub fn locale(&self) -> Option<GaloyLocale> {
        self.locale.clone()
    }

    pub fn disable_channel(&mut self, channel: UserNotificationChannel) {
        match channel {
            UserNotificationChannel::Push => {
                self.push_enabled = false;
            }
        }
    }

    pub fn enable_channel(&mut self, channel: UserNotificationChannel) {
        match channel {
            UserNotificationChannel::Push => {
                self.push_enabled = true;
            }
        }
    }

    pub fn is_channel_enabled(&self, channel: UserNotificationChannel) -> bool {
        match channel {
            UserNotificationChannel::Push => self.push_enabled,
        }
    }

    pub fn disable_category(
        &mut self,
        channel: UserNotificationChannel,
        category: UserNotificationCategory,
    ) {
        match channel {
            UserNotificationChannel::Push => {
                self.disabled_push_categories.insert(category);
            }
        }
    }

    pub fn enable_category(
        &mut self,
        channel: UserNotificationChannel,
        category: UserNotificationCategory,
    ) {
        match channel {
            UserNotificationChannel::Push => {
                self.disabled_push_categories.remove(&category);
            }
        }
    }

    pub fn disabled_categories_for(
        &self,
        channel: UserNotificationChannel,
    ) -> HashSet<UserNotificationCategory> {
        match channel {
            UserNotificationChannel::Push => self.disabled_push_categories.clone(),
        }
    }

    pub fn should_send_notification(
        &self,
        channel: UserNotificationChannel,
        category: UserNotificationCategory,
    ) -> bool {
        self.is_channel_enabled(channel)
            && !self.disabled_categories_for(channel).contains(&category)
    }

    pub fn push_device_tokens(&self) -> HashSet<PushDeviceToken> {
        self.push_device_tokens.clone()
    }

    pub fn add_push_device_token(&mut self, token: PushDeviceToken) {
        self.push_device_tokens.insert(token);
    }

    pub fn remove_push_device_token(&mut self, token: PushDeviceToken) {
        self.push_device_tokens.remove(&token);
    }

    pub fn email_address(&self) -> Option<GaloyEmailAddress> {
        self.email_address.clone()
    }

    pub fn update_email_address(&mut self, addr: GaloyEmailAddress) {
        self.email_address = Some(addr);
    }

    pub fn remove_email_address(&mut self) {
        self.email_address = None;
    }
}

impl From<user_notification_settings::UserNotificationSettings> for UserNotificationSettings {
    fn from(settings: user_notification_settings::UserNotificationSettings) -> Self {
        Self {
            id: settings.id,
            galoy_user_id: settings.galoy_user_id,
            locale: settings.locale(),
            push_enabled: settings.is_channel_enabled(UserNotificationChannel::Push),
            disabled_push_categories: settings
                .disabled_categories_for(UserNotificationChannel::Push),
            push_device_tokens: settings.push_device_tokens(),
            email_address: settings.email_address(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn channel_is_initially_enabled() {
        let events = initial_events();
        let settings = UserNotificationSettings::try_from(events).expect("Could not hydrate");
        assert!(settings.is_channel_enabled(UserNotificationChannel::Push));
    }

    #[test]
    fn can_disable_channel() {
        let events = initial_events();
        let mut settings = UserNotificationSettings::try_from(events).expect("Could not hydrate");
        settings.disable_channel(UserNotificationChannel::Push);
        assert!(!settings.is_channel_enabled(UserNotificationChannel::Push));
    }

    #[test]
    fn can_reenable_channel() {
        let events = initial_events();
        let mut settings = UserNotificationSettings::try_from(events).expect("Could not hydrate");
        settings.disable_channel(UserNotificationChannel::Push);
        settings.enable_channel(UserNotificationChannel::Push);
        assert!(settings.is_channel_enabled(UserNotificationChannel::Push));
    }

    #[test]
    fn no_categories_initially_disabled() {
        let events = initial_events();
        let settings = UserNotificationSettings::try_from(events).expect("Could not hydrate");
        assert_eq!(
            settings.disabled_categories_for(UserNotificationChannel::Push),
            HashSet::new(),
        );
    }

    #[test]
    fn can_disable_categories() {
        let events = initial_events();
        let mut settings = UserNotificationSettings::try_from(events).expect("Could not hydrate");
        settings.disable_category(
            UserNotificationChannel::Push,
            UserNotificationCategory::Circles,
        );
        assert_eq!(
            settings.disabled_categories_for(UserNotificationChannel::Push),
            HashSet::from([UserNotificationCategory::Circles])
        );
    }

    #[test]
    fn can_enable_categories() {
        let events = initial_events();
        let mut settings = UserNotificationSettings::try_from(events).expect("Could not hydrate");
        settings.disable_category(
            UserNotificationChannel::Push,
            UserNotificationCategory::Circles,
        );
        settings.disable_category(
            UserNotificationChannel::Push,
            UserNotificationCategory::Payments,
        );
        settings.enable_category(
            UserNotificationChannel::Push,
            UserNotificationCategory::Circles,
        );
        assert_eq!(
            settings.disabled_categories_for(UserNotificationChannel::Push),
            HashSet::from([UserNotificationCategory::Payments])
        );
    }

    #[test]
    fn should_send_notification() {
        let events = initial_events();
        let settings = UserNotificationSettings::try_from(events).expect("Could not hydrate");
        assert!(settings.should_send_notification(
            UserNotificationChannel::Push,
            UserNotificationCategory::Circles
        ));
    }

    #[test]
    fn should_not_send_notification_if_category_is_disabled() {
        let events = initial_events();
        let mut settings = UserNotificationSettings::try_from(events).expect("Could not hydrate");
        settings.disable_category(
            UserNotificationChannel::Push,
            UserNotificationCategory::Payments,
        );
        assert!(!settings.should_send_notification(
            UserNotificationChannel::Push,
            UserNotificationCategory::Payments,
        ));
    }

    #[test]
    fn should_not_send_notification_if_channel_is_disabled() {
        let events = initial_events();
        let mut settings = UserNotificationSettings::try_from(events).expect("Could not hydrate");
        settings.disable_channel(UserNotificationChannel::Push);
        assert!(!settings.should_send_notification(
            UserNotificationChannel::Push,
            UserNotificationCategory::Payments,
        ));
    }

    #[test]
    fn can_update_and_reset_locale() {
        let events = initial_events();
        let mut settings = UserNotificationSettings::try_from(events).expect("Could not hydrate");
        assert_eq!(settings.locale(), None);
        settings.update_locale(GaloyLocale::from("en_US".to_string()));
        assert_eq!(
            settings.locale(),
            Some(GaloyLocale::from("en_US".to_string()))
        );
        settings.set_locale_to_default();
        assert_eq!(settings.locale(), None);
    }

    #[test]
    fn can_add_and_remove_push_device_tokens() {
        let events = initial_events();
        let mut settings = UserNotificationSettings::try_from(events).expect("Could not hydrate");
        assert_eq!(settings.push_device_tokens(), HashSet::new());
        settings.add_push_device_token(PushDeviceToken::from("token1".to_string()));
        assert_eq!(
            settings.push_device_tokens(),
            HashSet::from([PushDeviceToken::from("token1".to_string())])
        );
        settings.add_push_device_token(PushDeviceToken::from("token2".to_string()));
        assert_eq!(
            settings.push_device_tokens(),
            HashSet::from([
                PushDeviceToken::from("token1".to_string()),
                PushDeviceToken::from("token2".to_string())
            ])
        );
        settings.remove_push_device_token(PushDeviceToken::from("token1".to_string()));
        assert_eq!(
            settings.push_device_tokens(),
            HashSet::from([PushDeviceToken::from("token2".to_string())])
        );
    }

    #[test]
    fn can_update_and_remove_emails() {
        let events = initial_events();
        let mut settings = UserNotificationSettings::try_from(events).expect("Could not hydrate");
        assert_eq!(settings.email_address(), None);

        let addr = GaloyEmailAddress::from("email@test.com".to_string());
        settings.update_email_address(addr.clone());
        assert_eq!(settings.email_address(), Some(addr));

        let addr = GaloyEmailAddress::from("email-2@test.com".to_string());
        settings.update_email_address(addr.clone());
        assert_eq!(settings.email_address(), Some(addr));

        settings.remove_email_address();
        assert_eq!(settings.email_address(), None);
    }
}
