# Performance envelope

Recorded 2026-09-11 on Windows x64 with Node v22.19.0. The benchmark uses the committed deterministic fixture builder, the production repository/services, and `fake-indexeddb` in Vitest. Each operation runs three warmups followed by fifteen samples; p50 and p95 use nearest-rank percentiles. Import/setup time is excluded from operation timings.

Run the repeatable benchmark with:

```bash
npm run perf
```

The benchmark covers a full repository load (prompts, folders, tags, and bundles), search-index construction, ranked search, canonical export/checksum generation, a non-versioned favorite save, and a versioned notes save. The fixtures include long Markdown, Unicode, duplicate titles, folders, tags, favorites, and usage metadata. Export is measured before benchmark mutations; save/version timings are single-record writes against the loaded library.

## Results

Times are milliseconds.

| Assets | Operation | p50 | p95 |
| ---: | --- | ---: | ---: |
| 100 | load | 0.667 | 0.870 |
| 100 | search-index | 0.151 | 0.356 |
| 100 | search | 0.451 | 1.635 |
| 100 | export | 2.307 | 3.480 |
| 100 | save | 0.595 | 1.588 |
| 100 | versioned-save | 0.713 | 1.058 |
| 1,000 | load | 4.919 | 6.641 |
| 1,000 | search-index | 1.370 | 3.739 |
| 1,000 | search | 2.314 | 3.351 |
| 1,000 | export | 15.831 | 20.873 |
| 1,000 | save | 1.422 | 5.450 |
| 1,000 | versioned-save | 1.507 | 1.970 |
| 5,000 | load | 24.386 | 25.357 |
| 5,000 | search-index | 8.167 | 14.819 |
| 5,000 | search | 10.334 | 15.768 |
| 5,000 | export | 89.808 | 126.504 |
| 5,000 | save | 9.322 | 12.890 |
| 5,000 | versioned-save | 8.915 | 15.153 |

## Interpretation and follow-up

The 5,000-asset search p95 is 15.768 ms, below the Personal V1 target of 100 ms. No performance target failed in this run, so no optimization follow-up is opened. The export p95 is the largest measured operation at 126.504 ms but has no stricter product target; it remains a bounded, user-initiated operation.

These figures are a repeatable service-level baseline, not a browser/device certification. A browser-profile measurement should be repeated during the release gate on the supported baseline device, especially if the real library materially exceeds 5,000 assets or contains substantially longer content.
