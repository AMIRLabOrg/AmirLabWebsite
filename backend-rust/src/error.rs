use axum::{http::StatusCode, response::{IntoResponse, Response}, Json};
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ErrorBody {
    status_code: u16,
    code: &'static str,
    message: &'static str,
}

// Mirror the NestJS public exception envelope; never expose internal errors.
pub fn internal_error() -> Response {
    (StatusCode::INTERNAL_SERVER_ERROR, Json(ErrorBody {
        status_code: 500,
        code: "SERVER_ERROR",
        message: "The server could not complete the request. Try again.",
    })).into_response()
}

pub async fn not_found() -> Response {
    (StatusCode::NOT_FOUND, Json(ErrorBody {
        status_code: 404,
        code: "HTTP_404",
        message: "The requested record could not be found.",
    })).into_response()
}
