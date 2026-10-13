use axum::{extract::{Query, State}, Json};
use crate::{error::ApiError, state::AppState};
use super::{dto::{PublicationQuery, PublicationsResponse}, service};

pub async fn publications(
    State(state): State<AppState>,
    Query(query): Query<PublicationQuery>,
) -> Result<Json<PublicationsResponse>, ApiError> {
    let query = query.validate()?;
    Ok(Json(service::publications(&state.db, query).await?))
}
