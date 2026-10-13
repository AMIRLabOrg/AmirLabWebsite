use axum::{routing::get, Router};

use crate::{error, state::AppState};

mod health;

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/api/health", get(health::health))
        // Feature routes are added here only after their compatibility tests pass.
        .fallback(error::not_found)
        .with_state(state)
}
