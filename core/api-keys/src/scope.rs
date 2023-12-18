const READ_SCOPE: &str = "read";
const WRITE_SCOPE: &str = "write";
const RECEIVE_SCOPE: &str = "receive";

#[derive(async_graphql::Enum, Copy, Clone, Eq, PartialEq, Debug)]
pub enum Scope {
    Read,
    Write,
    Receive,
}

impl std::fmt::Display for Scope {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Scope::Read => write!(f, "{}", READ_SCOPE),
            Scope::Write => write!(f, "{}", WRITE_SCOPE),
            Scope::Receive => write!(f, "{}", RECEIVE_SCOPE),
        }
    }
}

impl std::str::FromStr for Scope {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            READ_SCOPE => Ok(Scope::Read),
            WRITE_SCOPE => Ok(Scope::Write),
            RECEIVE_SCOPE => Ok(Scope::Receive),
            _ => Err(format!("Invalid scope: {}", s)),
        }
    }
}

pub fn read_only_scope() -> String {
    format!("{READ_SCOPE}")
}

pub fn read_write_scope() -> String {
    format!("{READ_SCOPE} {WRITE_SCOPE}")
}

pub fn can_write(scope: &String) -> bool {
    scope.as_str().split(" ").any(|s| s == WRITE_SCOPE) || scope.is_empty()
}
