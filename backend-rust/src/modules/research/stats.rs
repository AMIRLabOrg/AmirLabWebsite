use axum::{extract::State, Json};
use sea_orm::{ConnectionTrait, DbBackend, Statement};
use serde::Serialize;

use crate::{error::ApiError, state::AppState};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicStats {
    papers: i64,
    people: i64,
    datasets: i64,
    projects: i64,
    open_positions: i64,
}

/// Matches the five publicStats() counts in NestJS ResearchService.
/// Position availability semantics must be compared with publicPositionWhere().
pub async fn public_stats(State(state): State<AppState>) -> Result<Json<PublicStats>, ApiError> {
    let sql = r#"
        SELECT
          (SELECT COUNT(*) FROM "ResearchItem"
           WHERE "reviewStatus" = 'PUBLISHED' AND type = 'PAPER') AS papers,
          (SELECT COUNT(*) FROM "Person" WHERE "isPublished" = true) AS people,
          (SELECT COUNT(*) FROM "ResearchItem"
           WHERE "reviewStatus" = 'PUBLISHED' AND type = 'DATASET') AS datasets,
          (SELECT COUNT(*) FROM "ResearchItem" r
           JOIN "Project" p ON p."researchItemId" = r.id
           WHERE r."reviewStatus" = 'PUBLISHED' AND r.type = 'PROJECT'
             AND p."publicPageEnabled" = true) AS projects,
          (SELECT COUNT(*) FROM "Position"
           WHERE status = 'OPEN' AND ("opensAt" IS NULL OR "opensAt" <= NOW())
             AND ("closesAt" IS NULL OR "closesAt" > NOW())) AS open_positions
    "#;
    let row = state.db.query_one(Statement::from_string(DbBackend::Postgres, sql))
        .await.map_err(|err| {
            tracing::error!(error = %err, "public stats query failed");
            ApiError::internal()
        })?
        .ok_or_else(ApiError::internal)?;
    let read = |name: &str| row.try_get::<i64>("", name).map_err(|err| {
        tracing::error!(error = %err, column = name, "public stats decoding failed");
        ApiError::internal()
    });
    Ok(Json(PublicStats {
        papers: read("papers")?,
        people: read("people")?,
        datasets: read("datasets")?,
        projects: read("projects")?,
        open_positions: read("open_positions")?,
    }))
}
