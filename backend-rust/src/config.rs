use std::{env, error::Error, fmt};

pub struct Config {
    pub database_url: String,
    pub frontend_origins: Vec<String>,
    pub port: u16,
}

#[derive(Debug)]
struct ConfigError(String);
impl fmt::Display for ConfigError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result { f.write_str(&self.0) }
}
impl Error for ConfigError {}

impl Config {
    pub fn from_env() -> Result<Self, Box<dyn Error>> {
        let database_url = required("DATABASE_URL")?;
        let frontend_origins: Vec<String> = required("FRONTEND_ORIGINS")?
            .split(',').map(str::trim).filter(|s| !s.is_empty())
            .map(str::to_owned).collect();
        if frontend_origins.is_empty() {
            return Err(Box::new(ConfigError("FRONTEND_ORIGINS must not be empty".into())));
        }
        // Reject wildcard origins: credentialed CORS must use explicit origins.
        for origin in &frontend_origins {
            if origin == "*" || !(origin.starts_with("https://") || origin.starts_with("http://")) {
                return Err(Box::new(ConfigError(format!("Invalid FRONTEND_ORIGINS entry: {origin}"))));
            }
        }
        let port = env::var("PORT").unwrap_or_else(|_| "3001".into()).parse::<u16>()?;
        Ok(Self { database_url, frontend_origins, port })
    }
}
fn required(key: &str) -> Result<String, Box<dyn Error>> {
    let value = env::var(key)?;
    if value.trim().is_empty() {
        return Err(Box::new(ConfigError(format!("{key} must not be empty"))));
    }
    Ok(value)
}
