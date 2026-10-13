use axum::http::StatusCode;
use serde::{Deserialize, Serialize};

use crate::error::ApiError;

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicationQuery {
    pub page: Option<String>,
    pub page_size: Option<String>,
    pub search: Option<String>,
    pub category: Option<String>,
    pub year: Option<String>,
    pub sort: Option<String>,
}

#[derive(Debug)]
pub struct ValidatedQuery {
    pub page: i64,
    pub page_size: i64,
    pub search: Option<String>,
    pub category: Option<String>,
    pub year: Option<i32>,
    pub sort: Sort,
}

#[derive(Debug, Clone, Copy)]
pub enum Sort { Newest, Oldest, Title }

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Facet {
    pub value: serde_json::Value,
    pub count: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<&'static str>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Facets { pub categories: Vec<Facet>, pub years: Vec<Facet> }

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicationsResponse {
    pub items: Vec<serde_json::Value>,
    pub page: i64,
    pub page_size: i64,
    pub total: i64,
    pub total_pages: i64,
    pub facets: Facets,
}

impl PublicationQuery {
    pub fn validate(self) -> Result<ValidatedQuery, ApiError> {
        let page = parse_positive(self.page.as_deref(), 1, 1, i64::MAX, "page")?;
        let page_size = parse_positive(self.page_size.as_deref(), 12, 1, 100, "pageSize")?;
        let year = match self.year.as_deref() {
            Some(v) => Some(parse_positive(Some(v), 1900, 1900, 2200, "year")? as i32),
            None => None,
        };
        if self.search.as_ref().is_some_and(|v| v.chars().count() > 200) {
            return Err(ApiError::new(StatusCode::BAD_REQUEST, "search must be shorter than or equal to 200 characters"));
        }
        let category = match self.category.as_deref() {
            None => None,
            Some(v @ ("JOURNAL" | "CONFERENCE" | "BOOK_CHAPTER" | "PREPRINT" | "OTHER")) => Some(v.to_owned()),
            _ => return Err(ApiError::new(StatusCode::BAD_REQUEST, "category must be a valid enum value")),
        };
        let sort = match self.sort.as_deref().unwrap_or("NEWEST") {
            "NEWEST" => Sort::Newest,
            "OLDEST" => Sort::Oldest,
            "TITLE" => Sort::Title,
            _ => return Err(ApiError::new(StatusCode::BAD_REQUEST, "sort must be a valid enum value")),
        };
        Ok(ValidatedQuery {
            page, page_size,
            search: self.search.map(|s| s.trim().to_owned()).filter(|s| !s.is_empty()),
            category, year, sort,
        })
    }
}

fn parse_positive(raw: Option<&str>, default: i64, min: i64, max: i64, name: &str) -> Result<i64, ApiError> {
    let Some(raw) = raw else { return Ok(default); };
    let value = raw.parse::<i64>().map_err(|_| ApiError::new(StatusCode::BAD_REQUEST, format!("{name} must be an integer")))?;
    if value < min || value > max {
        return Err(ApiError::new(StatusCode::BAD_REQUEST, format!("{name} must be between {min} and {max}")));
    }
    Ok(value)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn defaults_match_nestjs() {
        let q = PublicationQuery::default().validate().unwrap();
        assert_eq!((q.page, q.page_size), (1, 12));
        assert!(matches!(q.sort, Sort::Newest));
    }
    #[test]
    fn rejects_bad_filters() {
        assert!(PublicationQuery { sort: Some("RANDOM".into()), ..Default::default() }.validate().is_err());
        assert!(PublicationQuery { year: Some("1800".into()), ..Default::default() }.validate().is_err());
        assert!(PublicationQuery { page_size: Some("101".into()), ..Default::default() }.validate().is_err());
    }
}
