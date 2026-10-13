use axum::http::StatusCode;
use sea_orm::{ConnectionTrait, DatabaseConnection, DbBackend, Statement, Value};
use serde_json::{json, Value as JsonValue};
use crate::error::ApiError;
use super::dto::{Facet, Facets, Sort, ValidatedQuery};

// SQL identifiers are static. All user-provided values are bound parameters.
// Prisma's default PostgreSQL mapping uses quoted model and field names.
pub async fn search_publications(
    db: &DatabaseConnection,
    query: &ValidatedQuery,
) -> Result<(Vec<JsonValue>, i64, Facets), ApiError> {
    let mut predicates = vec!["r.\"reviewStatus\" = 'PUBLISHED'".to_owned(), "r.\"type\" = 'PAPER'".to_owned()];
    let mut values: Vec<Value> = Vec::new();
    if let Some(category) = &query.category {
        values.push(category.clone().into());
        predicates.push(format!("p.\"publicationType\" = ${}", values.len()));
    }
    if let Some(year) = query.year {
        values.push(year.into());
        predicates.push(format!("p.\"year\" = ${}", values.len()));
    }
    if let Some(search) = &query.search {
        // Prisma contains-insensitive maps to ILIKE; escape LIKE metacharacters so the
        // input is treated as a literal substring, not a user-controlled pattern.
        let escaped = search.replace('\\', "\\\\").replace('%', "\\%").replace('_', "\\_");
        values.push(format!("%{escaped}%").into());
        let idx = values.len();
        predicates.push(format!(r#"(r."title" ILIKE ${idx} ESCAPE '\'
            OR r."summary" ILIKE ${idx} ESCAPE '\'
            OR r."canonicalUrl" ILIKE ${idx} ESCAPE '\'
            OR p."venue" ILIKE ${idx} ESCAPE '\'
            OR p."doi" ILIKE ${idx} ESCAPE '\'
            OR p."citation" ILIKE ${idx} ESCAPE '\'
            OR EXISTS (SELECT 1 FROM "ResearchContributor" rc
                       WHERE rc."researchItemId" = r.id AND rc."displayName" ILIKE ${idx} ESCAPE '\'))"#));
    }
    let where_clause = predicates.join(" AND ");
    let base = format!(r#" FROM "ResearchItem" r LEFT JOIN "Paper" p ON p."researchItemId" = r.id WHERE {where_clause}"#);
    let count_sql = format!("SELECT COUNT(*) AS count {base}");
    let total = fetch_count(db, &count_sql, values.clone()).await?;

    let ordering = match query.sort {
        Sort::Newest => r#"p."year" DESC NULLS FIRST, r."publishedAt" DESC NULLS FIRST, r."title" ASC NULLS LAST"#,
        Sort::Oldest => r#"p."year" ASC NULLS LAST, r."publishedAt" ASC NULLS LAST, r."title" ASC NULLS LAST"#,
        Sort::Title => r#"r."title" ASC NULLS LAST"#,
    };
    let limit_idx = values.len() + 1;
    let offset_idx = values.len() + 2;
    let sql = format!(r#"
        SELECT (to_jsonb(r) || jsonb_build_object(
            'paper', to_jsonb(p),
            'dataset', NULL,
            'project', NULL,
            'contributors', COALESCE((
                SELECT jsonb_agg(to_jsonb(c) || jsonb_build_object(
                    'person', CASE WHEN person.id IS NULL THEN NULL ELSE
                        jsonb_build_object('fullName', person."fullName", 'slug', person.slug) END
                ) ORDER BY c."sortOrder")
                FROM "ResearchContributor" c
                LEFT JOIN "Person" person ON person.id = c."personId"
                WHERE c."researchItemId" = r.id
            ), '[]'::jsonb)
        )) AS item
        {base}
        ORDER BY {ordering}
        LIMIT ${limit_idx} OFFSET ${offset_idx}
    "#);
    let offset = (query.page - 1).checked_mul(query.page_size)
        .ok_or_else(|| ApiError::new(StatusCode::BAD_REQUEST, "page is too large"))?;
    values.push(query.page_size.into());
    values.push(offset.into());
    let rows = db.query_all(Statement::from_sql_and_values(DbBackend::Postgres, sql, values))
        .await.map_err(db_error)?;
    let mut items = Vec::with_capacity(rows.len());
    for row in rows {
        items.push(row.try_get::<JsonValue>("", "item").map_err(db_error)?);
    }

    // Facets are intentionally global over all published papers, not scoped
    // to search/category/year filters, matching ResearchService.publications.
    let facet_sql = r#"SELECT p."publicationType" AS category, p."year" AS year
        FROM "Paper" p JOIN "ResearchItem" r ON r.id = p."researchItemId"
        WHERE r."reviewStatus" = 'PUBLISHED'"#;
    let rows = db.query_all(Statement::from_string(DbBackend::Postgres, facet_sql))
        .await.map_err(db_error)?;
    let mut category_counts = std::collections::BTreeMap::<String, i64>::new();
    let mut year_counts = std::collections::BTreeMap::<i32, i64>::new();
    for row in rows {
        if let Some(category) = row.try_get::<Option<String>>("", "category").map_err(db_error)? {
            *category_counts.entry(category).or_default() += 1;
        }
        if let Some(year) = row.try_get::<Option<i32>>("", "year").map_err(db_error)? {
            *year_counts.entry(year).or_default() += 1;
        }
    }
    let categories = [
        ("JOURNAL", "Journal"), ("CONFERENCE", "Conference"),
        ("BOOK_CHAPTER", "Book chapter"), ("PREPRINT", "Preprint"), ("OTHER", "Other")
    ].into_iter().filter_map(|(value, label)| category_counts.get(value).map(|&count| Facet {
        value: json!(value), count, label: Some(label)
    })).collect();
    let years = year_counts.into_iter().rev().map(|(value, count)| Facet {
        value: json!(value), count, label: None
    }).collect();
    Ok((items, total, Facets { categories, years }))
}

async fn fetch_count(db: &DatabaseConnection, sql: &str, values: Vec<Value>) -> Result<i64, ApiError> {
    let row = db.query_one(Statement::from_sql_and_values(DbBackend::Postgres, sql, values))
        .await.map_err(db_error)?
        .ok_or_else(|| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, "Missing count row"))?;
    row.try_get("", "count").map_err(db_error)
}

fn db_error(err: impl std::fmt::Display) -> ApiError {
    tracing::error!(error = %err, "publication query failed");
    ApiError::internal()
}
