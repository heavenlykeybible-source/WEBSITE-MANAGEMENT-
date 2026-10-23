# Heavenly Key source recovery verification — 22 October 2026

Source repository: `heavenlykeybible-source/onlinebible` (`main`).
Destination: `heavenlykeybible-source/WEBSITE-MANAGEMENT-` (`main`).

## Verified repository inventory

GitHub recursive Git tree comparison matched all **737 expected source files** across the mapped account folders. Each destination path exists, and its Git blob SHA equals the original source SHA (0 missing; 0 hash differences).

| Destination | Matched files |
| --- | ---: |
| account-01-main-website/source | 213 |
| account-02-studio-radio-tv-media/source | 21 |
| account-03-global-christian-community/source | 167 |
| account-03-global-christian-community/alternate-global-community | 123 |
| account-04-website-management-control-room/uploaded-reference | 23 |
| account-05-heavenly-key-app/source | 170 |
| account-06-online-bible/source | 17 |
| shared/portal-router | 3 |
| **Total** | **737** |

Historical Account 4 control-room files are **reference only**; the latest root Website Management code remains authoritative. Accounts 7 and 8 do not have identified source applications; do not claim they are complete.

## Integration

Recovery pull request #9 was merged into main on 2026-10-22. Both `.github/workflows/deploy-cloudflare-pages.yml` and `.github/workflows/deploy-global-community.yml` are present on main.

## Deployment validation still pending

The 2026-10-22 GitHub Actions run for Pages failed on the missing `CLOUDFLARE_API_TOKEN` secret (run 39783056686). The Global Community build stopped on a missing shared `scripts/test-account4-ai-preview.mjs` import during its frontend feed tests (run 39783056601). Neither deployment succeeded. Source completeness does not imply application readiness or live deployment.

Do not overwrite the current production control room or change database bindings without verification.
