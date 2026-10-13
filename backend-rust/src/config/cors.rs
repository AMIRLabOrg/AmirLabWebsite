/// Exact-origin and restricted Vercel preview policy ported from backend/src/config/cors.ts.
/// This does not accept arbitrary *.vercel.app origins.
pub fn is_allowed_origin(origin: &str, configured: &[String]) -> bool {
    if configured.iter().any(|allowed| allowed == origin) {
        return true;
    }
    const SUFFIX: &str = "-itsfuads-projects.vercel.app";
    let Some(host) = origin.strip_prefix("https://") else {
        return false;
    };
    if host.is_empty()
        || host.contains(['/', '?', '#', '@', ':'])
        || !host.ends_with(SUFFIX)
        || host == SUFFIX.trim_start_matches('-')
    {
        return false;
    }
    let prefix = &host[..host.len() - SUFFIX.len()];
    !prefix.is_empty() && prefix.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-')
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn explicit_origin() {
        assert!(is_allowed_origin("http://localhost:3000", &["http://localhost:3000".into()]));
    }
    #[test]
    fn preview_origin() {
        assert!(is_allowed_origin("amirlab-git-feature-itsfuads-projects.vercel.app".strip_prefix("https://").map(|v| format!("https://{v}")).unwrap().as_str(), &[]));
        for bad in [
            "https://evil.vercel.app",
            "http://test-itsfuads-projects.vercel.app",
            "https://test-itsfuads-projects.vercel.app.evil.com",
            "https://test-itsfuads-projects.vercel.app:443",
            "https://test-itsfuads-projects.vercel.app/path",
            "https://-itsfuads-projects.vercel.app",
        ] {
            assert!(!is_allowed_origin(bad, &[]), "{bad}");
        }
    }
}
