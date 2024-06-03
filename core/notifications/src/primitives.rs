use serde::{Deserialize, Serialize};

#[derive(Hash, PartialEq, Eq, Clone, Debug, Serialize, Deserialize)]
pub struct GaloyUserId(String);
impl GaloyUserId {
    pub fn search_begin() -> Self {
        GaloyUserId(String::new())
    }

    pub fn into_inner(self) -> String {
        self.0
    }
}

impl From<String> for GaloyUserId {
    fn from(s: String) -> Self {
        Self(s)
    }
}

impl AsRef<str> for GaloyUserId {
    fn as_ref(&self) -> &str {
        &self.0
    }
}

impl std::fmt::Display for GaloyUserId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

es_entity::entity_id! { UserNotificationSettingsId }
es_entity::entity_id! { StatefulNotificationId }

#[derive(Clone, PartialEq, Eq, Debug, Serialize, Deserialize, Hash)]
pub struct GaloyLocale(String);

impl Default for GaloyLocale {
    fn default() -> Self {
        Self("en".to_string())
    }
}

impl From<String> for GaloyLocale {
    fn from(s: String) -> Self {
        Self(s)
    }
}

impl AsRef<str> for GaloyLocale {
    fn as_ref(&self) -> &str {
        &self.0
    }
}

impl std::fmt::Display for GaloyLocale {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

#[derive(Clone, PartialEq, Eq, Debug, Serialize, Deserialize, Hash)]
pub struct PushDeviceToken(String);
impl PushDeviceToken {
    pub fn into_inner(self) -> String {
        self.0
    }
}
impl From<String> for PushDeviceToken {
    fn from(s: String) -> Self {
        Self(s)
    }
}

impl AsRef<str> for PushDeviceToken {
    fn as_ref(&self) -> &str {
        &self.0
    }
}

impl std::fmt::Display for PushDeviceToken {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

#[derive(Clone, PartialEq, Eq, Debug, Serialize, Deserialize, Hash)]
pub struct GaloyEmailAddress(String);
impl GaloyEmailAddress {
    pub fn into_inner(self) -> String {
        self.0
    }
}
impl From<String> for GaloyEmailAddress {
    fn from(s: String) -> Self {
        Self(s)
    }
}

impl AsRef<str> for GaloyEmailAddress {
    fn as_ref(&self) -> &str {
        &self.0
    }
}

impl std::fmt::Display for GaloyEmailAddress {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

#[derive(async_graphql::Enum, Debug, Copy, Clone, Eq, PartialEq, Deserialize, Serialize, Hash)]
#[graphql(name = "UserNotificationChannel")]
pub enum UserNotificationChannel {
    Push,
}

#[derive(async_graphql::Enum, Debug, Hash, Copy, Clone, Eq, PartialEq, Deserialize, Serialize)]
#[graphql(name = "UserNotificationCategory")]
pub enum UserNotificationCategory {
    Circles,
    Payments,
    AdminNotification,
    Marketing,
    Price,
    Security,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum CircleType {
    Inner,
    Outer,
}

impl std::fmt::Display for CircleType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CircleType::Inner => write!(f, "inner"),
            CircleType::Outer => write!(f, "outer"),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum CircleTimeFrame {
    Month,
    AllTime,
}

impl std::fmt::Display for CircleTimeFrame {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CircleTimeFrame::Month => write!(f, "month"),
            CircleTimeFrame::AllTime => write!(f, "all_time"),
        }
    }
}

#[derive(Debug, Clone, Copy, Eq, Serialize, Deserialize)]
#[serde(try_from = "String")]
#[serde(into = "&str")]
pub enum Currency {
    Iso(&'static rusty_money::iso::Currency),
    Crypto(&'static rusty_money::crypto::Currency),
}

impl Currency {
    pub fn code(&self) -> &'static str {
        match self {
            Currency::Iso(c) => c.iso_alpha_code,
            Currency::Crypto(c) => c.code,
        }
    }

    pub fn format_minor_units(
        &self,
        f: &mut std::fmt::Formatter<'_>,
        minor_units: u64,
        round_to_major: bool,
    ) -> std::fmt::Result {
        match self {
            Currency::Iso(c) => {
                let money = if round_to_major {
                    rusty_money::Money::from_minor(minor_units as i64, *c)
                        .round(0, rusty_money::Round::HalfUp)
                } else {
                    rusty_money::Money::from_minor(minor_units as i64, *c)
                };

                write!(f, "{money}")
            }
            Currency::Crypto(c) if c == &rusty_money::crypto::BTC => {
                write!(f, "{} sats", minor_units as f64)
            }
            _ => unimplemented!("format_minor_units for currency: {}", self.code()),
        }
    }
}

impl std::fmt::Display for Currency {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.code())
    }
}

impl std::hash::Hash for Currency {
    fn hash<H: std::hash::Hasher>(&self, state: &mut H) {
        self.code().hash(state);
    }
}

impl PartialEq for Currency {
    fn eq(&self, other: &Self) -> bool {
        self.code() == other.code()
    }
}

impl std::str::FromStr for Currency {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match rusty_money::iso::find(s) {
            Some(c) => Ok(Currency::Iso(c)),
            _ => match rusty_money::crypto::find(s) {
                Some(c) => Ok(Currency::Crypto(c)),
                _ => Err(format!("Unknown currency: '{}'", s)),
            },
        }
    }
}

impl TryFrom<String> for Currency {
    type Error = String;

    fn try_from(s: String) -> Result<Self, Self::Error> {
        s.parse()
    }
}

impl From<Currency> for &'static str {
    fn from(c: Currency) -> Self {
        c.code()
    }
}

#[derive(Debug, Clone)]
pub struct ReadPool(sqlx::PgPool);
impl ReadPool {
    pub fn inner(&self) -> &sqlx::PgPool {
        &self.0
    }
}
impl From<sqlx::PgPool> for ReadPool {
    fn from(pool: sqlx::PgPool) -> Self {
        Self(pool)
    }
}
