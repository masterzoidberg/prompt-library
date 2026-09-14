# Backup and recovery

## Export a backup

1. Open **Settings**.
2. In **Backup**, choose **Export**.
3. Keep the downloaded `prompt-library-backup-YYYY-MM-DD.json` file somewhere outside the browser profile.

The app validates the canonical payload before starting the download and reports **download initiated**. Browser APIs do not let the app prove that the file was durably saved, so that message is intentionally not a filesystem-save guarantee.

Settings records when a structurally verified backup was prepared and shows a reminder after 30 days. This timestamp tracks preparation/download initiation only; retain the file yourself to establish an actual recovery point.

The canonical v2 backup contains prompts, folders, tags, settings, prompt versions, bundles, manifest counts, and a deterministic SHA-256 checksum. Existing v1 backups remain importable through the supported migration path.

## Replace the current library from a backup

1. Open **Settings** and choose **Import**.
2. Select a JSON backup file.
3. Review the verified record summary.
4. Download the displayed pre-restore backup if you want an additional copy.
5. Check the acknowledgement that the pre-restore backup is ready and that the current library will be replaced.
6. Choose **Restore library** and wait for the success message.

Restore is replace-only in Personal V1. The app parses, migrates in memory, validates references and invariants, verifies the checksum, prepares a current-library backup, commits replacement in one transaction, re-reads the database, and compares the restored data before reporting success. Invalid or unsupported files are rejected before mutation. Merge import is not supported.

## If startup or restore fails

- A startup/storage error shows a blocking **Retry** state; it must not be mistaken for an empty library. Retry after checking that the browser still permits site storage.
- If restore preparation rejects a file, keep the current library untouched and use a known-good export. Future format versions, bad checksums, invalid dates/counters, duplicate IDs/names, missing `Unfiled`, and dangling references are expected validation failures.
- If a restore is blocked after commit verification, stop using the active library and recover using the verified pre-restore backup. Do not clear browser site data while troubleshooting.

Backups are local JSON files, not encrypted archives. Do not put secrets in remembered variable values unless the browser profile’s local-data risk is acceptable.
