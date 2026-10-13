mod config;
mod error;
mod modules;
mod routes;
mod state;

use std::net::SocketAddr;

use axum::http::{header, HeaderValue, Method};
use sea_orm::{ConnectOptions, Database};
use tokio::net::TcpListener;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing_subscriber::EnvFilter;

use crate::{config::Config, state::AppState};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info,tower_http=info".into()))
        .init();

    let config = Config::from_env()?;
    let mut options = ConnectOptions::new(config.database_url.clone());
    options.max_connections(5).min_connections(0).sqlx_logging(false);
    let db = Database::connect(options).await?;

    let origins: Vec<HeaderValue> = config
        .frontend_origins
        .iter()
        .map(|origin| origin.parse())
        .collect::<Result<_, _>>()?;
    let cors = CorsLayer::new()
        .allow_origin(origins)
        .allow_credentials(true)
        .allow_methods([Method::GET, Method::POST, Method::PATCH, Method::DELETE, Method::OPTIONS])
        .allow_headers([header::CONTENT_TYPE, header::AUTHORIZATION]);

    let app = routes::router(AppState { db })
        .layer(cors)
        .layer(TraceLayer::new_for_http());
    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));
    let listener = TcpListener::bind(addr).await?;
    tracing::info!(%addr, "Rust API listening");
    axum::serve(listener, app).await?;
    Ok(())
}
