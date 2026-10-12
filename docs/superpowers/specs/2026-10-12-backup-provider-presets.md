# Backup provider presets

Implement the user-requested dropdown and working adapters for three storage destinations in the existing backup subsystem. No push, commit, deployment, hosted database writes, or live S3 claim is authorized.

## Presets

- Same server / local directory: absolute directory.
- S3-compatible storage: bucket, region (default `us-east-1`), optional HTTPS endpoint, prefix, access key ID, secret access key, path-style toggle. HTTP endpoints are allowed only for loopback testing.
- SFTP server: host, port (default 22), username, remote directory, trusted SSH host public key, and authentication choice (private key or password). Use pinned host verification; do not implement unencrypted FTP.

The selected preset changes the visible fields. Switching a preset starts its schedule disabled. The interval, manual capture, backup selection, and typed restore confirmation remain shared. Saved secrets are never returned in status responses; blank secret fields preserve previously saved credentials only for the same provider/authentication choice.

## Ownership and persistence

Keep one active configuration in the existing `backups.local` SiteSetting key for compatibility. The legacy shape without a provider means local storage. Encrypt remote credentials using AES-256-GCM with a random 32-byte key in a mode-0600 file beside the upload directory, outside the uploads and backup trees. Generate it when credentials are first saved; do not include it in snapshots. Its loss requires re-entering credentials. No environment redeploy is needed to change provider settings.

A shared storage interface lists manifests, saves a completed snapshot, and loads one snapshot into an isolated directory. Local storage retains the current folder layout. Remote destinations use `<prefix>/<uuid>/database.dump`, declared upload paths, and `manifest.json`. Write the manifest last so partial uploads are not listed as complete backups. Stream database/upload files. Validate UUIDs, manifest hashes, and relative paths before downloads; never allow traversal, symbolic-link extraction, or arbitrary local destination paths.

## Behavior retained

Database and upload sources remain restricted to loopback PostgreSQL, local uploads, development/test environments. Production/source support is not silently expanded in this change. The provider is the destination; S3 or SFTP can receive a backup from the local test source once actual credentials are provided.

Keep checksums, PostgreSQL archive checks, same-database matching, normal/scheduled/safety purposes, safety snapshots before restore, transactional database restore, upload rollback, interruption markers, and recovery with an empty schema. Prior interruption markers may be malformed; preserve them as raw text on failed recovery and clear them only after success.

Local listing continues to check integrity. Remote listing must not download complete archives: report integrity as unchecked until a selected archive is loaded and verified. `verified` becomes `boolean | null` (null means unchecked), not a false success. Remote candidates may be selected, but restore always verifies all files before touching local data. Scheduling uses the latest complete non-safety manifest; it does not repeatedly capture because a remote listing is unchecked.

The existing local recovery command continues working. Add a storage-configuration-file option for remote recovery when database settings/authentication tables are gone. Explicit credentials in an operator-owned mode-0600 file supply the remote connection; the command still requires an explicit local database URL and replacement flag and never loads `.env`.

## Verification

Preserve the verified profile/session/push changes. Run backend and frontend suites, type checks, lint, architecture checks, and local browser checks. Test credential round trips/redaction, secret preservation/provider changes, remote path validation, manifest-last writes, S3 listing pagination/stream handling, SFTP quoting/host verification/authentication/error behavior, unchecked listing/schedule behavior, and existing local clear/restore checks.

No S3 account is available. SDK contract tests are permitted; live S3 delivery and restore remain explicitly unverified. Live SFTP also requires a supplied endpoint or a safely scoped local server; do not claim a mock is protocol proof.
