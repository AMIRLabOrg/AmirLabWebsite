use sea_orm::DatabaseConnection;
use crate::error::ApiError;
use super::{dto::{PublicationsResponse, ValidatedQuery}, repository};

pub async fn publications(db: &DatabaseConnection, query: ValidatedQuery) -> Result<PublicationsResponse, ApiError> {
    let (items, total, facets) = repository::search_publications(db, &query).await?;
    Ok(PublicationsResponse {
        items,
        page: query.page,
        page_size: query.page_size,
        total,
        total_pages: (total + query.page_size - 1) / query.page_size,
        facets,
    })
}
