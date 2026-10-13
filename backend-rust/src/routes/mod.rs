use axum::{routing::get, Router};

use crate::{error, modules::research, state::AppState};

mod health;

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/api/health", get(health::health))
        .route("/api/publications", get(research::controller::publications))
        .route("/api/stats", get(research::stats::public_stats))
        // Feature routes are added here only after their compatibility tests pass.
        .fallback(error::not_found)
        .with_state(state)
}
