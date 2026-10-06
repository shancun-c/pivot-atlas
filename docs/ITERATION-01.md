# Iteration 01: cross-market performance

## Scope and acceptance
- Preserve pivot calculations, provider contracts and nine-turn logic.
- New independent #performance page; responsive table with own market/search controls, sorting and chart drilldown.
- Price returns use (latest/base - 1)*100, not total returns. Yield changes use (latest-base)*100 bp and a separate ranking universe.
- Use only bars dated before asset asOf (conservative: excludes today's bar even after local close). Latest observation date is visible; calendars differ, not synchronous executable quotes.
- 1D means previous available daily observation, WTD/MTD/YTD compare with last observation before the period starts. 1M/3M compare with last available observation on/before a calendar-month offset from latest date (day clamped).
- No baseline more than 10 calendar days before its target; missing history, invalid/zero/negative price denominators yield unavailable, never zero.
- Daily volatility is sample standard deviation of last 20 available daily price returns (not annualized); yield volatility uses daily bp changes. Gaps are not reconstructed.
- Missing/stale sources remain labeled but excluded from ranking calculations. Dates and source revision differences remain material limits.
- Tests cover arithmetic, calendar boundaries, leap dates, missing history, yields, stale sources, sorting nulls.

## Delivery
Migrate local project with compatibility symlink. Private GitHub repository; ignore caches, credentials, venv, server inventory and screenshot artifacts. CI runs Python and Node tests. Release only app files to a new server directory, retain previous release and persistent cache. No changes to other services.

## Verification
31 Node tests and 39 Python tests passed locally. GitHub Actions passed after matching CI to Python3.12. Browser checked US equities / 1M sorting, sovereign yield bp, chart drilldown and focus return, and 390px no whole-page overflow. Sidebar market selection now targets the matrix when that page is active. Existing pivots and nine-turn calculation modules unchanged.

Context7 was not callable in this session; GitHub Actions configuration was checked against official setup-node/setup-python documentation and the workflow was actually executed. No third-party chart or calculation dependency introduced.
