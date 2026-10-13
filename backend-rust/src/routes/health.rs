use axum::{extract::State, Json};
use sea_orm::{ConnectionTrait, DbBackend, Statement};
use serde::Serialize;

use crate::{error, state::AppState};

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
    timestamp: String,
}

pub async fn health(State(state): State<AppState>) -> Result<Json<HealthResponse>, axum::response::Response> {
    state.db.query_one(Statement::from_string(DbBackend::Postgres, "SELECT 1"))
        .await
        .map_err(|err| {
            tracing::error!(error = %err, "health database probe failed");
            error::internal_error()
        })?;
    Ok(Json(HealthResponse {
        status: "ok",
        timestamp: chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
    }))
}
