# Recommended next task

## RELEASE-01 — Owner-run real-library release check

All product implementation tasks, performance measurement, documentation, and deterministic release checks are complete. The remaining task is the owner-only portion of the Personal V1 daily-use gate against the real browser library.

### Objective

Complete the real-library release signoff without exposing personal browser data in the repository or test artifacts.

### Acceptance criteria

- All implementation and fixture-based items in [`V1_GATE.md`](./V1_GATE.md) have recorded evidence.
- The owner has confirmed a current real-library backup, a fresh-profile restore, and search responsiveness at the real library size.
- No critical/high data-loss, corruption, migration, restore, or runtime defect remains open.
- The documented verification commands pass from a clean lockfile install.

### Current blocker

The remaining checks require access to the owner’s real browser profile and personal library, which are intentionally out of scope for automated tests and were not accessed by this implementation run.

### Privacy-preserving owner runbook

1. In the normal browser profile, open **Settings → Backup → Export** and retain the downloaded JSON outside this repository. Record only the date, browser/version, and filename; never commit, attach, or paste the backup contents.
2. In a fresh isolated browser profile, open the app, import that file, review the verified summary, acknowledge the pre-restore backup, and complete **Restore library**. Record only whether restore succeeded, the date, browser/version, and the displayed record counts.
3. In the normal profile or the restored isolated profile, search at the real library size using a representative common and rare query. Check that typing remains responsive and record only the approximate settle time, library count, browser/version, and date. Do not record prompt titles, content, tags, or screenshots containing library data.

### Verification

Run the exact gate commands if the environment changes, then complete the three unchecked owner-action items in [`V1_GATE.md`](./V1_GATE.md). Do not record personal backup contents in the repository or test artifacts.
