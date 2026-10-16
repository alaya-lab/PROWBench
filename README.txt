Project website for PROWBench: Do Video Models Render What the Program Specifies?


Local leaderboard
-----------------
Start the existing static preview server:
  bash start.command --no-browser --port 8767
Home-page section: http://127.0.0.1:8767/index.html#leaderboard
Legacy leaderboard.html links redirect to this section, preserving filters.
No build or npm dependencies are required.

On Alibaba Cloud DSW, the launcher also prints a Remote browser preview URL
using the workspace's VSCODE_PROXY_URI. Open that URL on your own computer in
the browser signed in to the same DSW account. If redirected to sign-in, open
the DSW web IDE from the console first, then revisit the preview link.
The preview server and DSW instance must remain running. A localhost URL on
the cloud machine is only usable on your computer after SSH port forwarding.

The leaderboard contains 35 model-setting rows / 470 numeric cells (11 models,
5 settings, 20 metrics), from the active tables in the supplied PROWBench.zip
revision. No additional evaluation runs are currently included.
The existing bundled PDF has slightly different
Verified-FF values; source provenance is explicit in the UI and data export.
The supplied ZIP is the source of truth for the current leaderboard.

Data: assets/leaderboard-data.js (generated; includes exact printed precision,
input conditions, source lines and SHA-256 hashes). Reproduce with:
  python3 scripts/import-leaderboard.py /path/to/PROWBench.zip
The importer rejects a changed results-file hash until its table locations
have been re-audited. It ignores obsolete commented LaTeX tables.

Optional: restore the withdrawn evaluation run when requested:
  python3 scripts/import-evaluation.py assets/evaluations/streamrender_h3_20261012_162252/colored-obb --model-id streamrender-h3-colored-obb --model-name 'StreamRender-H3 (colored-OBB)'
The directory may instead point to the original evaluator output. The importer
copies only tables.csv and per-sample-scores.csv to the website, validates the
aggregate means and counts before writing, and replaces only this evaluation's
rows on re-import. It refuses to overwrite a paper model. The input CSVs and
importer are retained locally, but this run is absent from the active snapshot,
rankings and exports. Importing it again adds its source downloads and coverage
details to the page.

Display transformations and CSV/ranking logic: leaderboard-core.js
Metric-by-metric formulas, units, examples and aggregation rules: NORMALIZATION.md
Standalone Python equivalent (standard library only): scripts/normalize_metrics.py
Print every metric's formula, input units and rationale:
  python3 scripts/normalize_metrics.py --explain
Export raw values, normalized submetrics, category means and overall ranks:
  python3 scripts/normalize_metrics.py --output normalized-results.json
The script also accepts --input /path/to/source-results.json (the website's
source-data download). Its default input is assets/leaderboard-data.js.
Import normalize_metric(metric_id, value) to normalize an individual value.
The JSON export preserves full precision and records all normalization rules.
Interactions: leaderboard.js
Shared section markup: leaderboard-view.js
Page/styles: index.html, leaderboard.css
The home-page Leaderboard sits between Takeaways and Structural inputs. It
uses the benchmark's dark palette, gold controls and Fraunces section heading.
The website baseline was synced from the deployed origin/main commit 422244f
on 2026-10-15, retaining its Dataset link, embedded Gallery and scene references.
Scenes and interactions now follows Gallery on the home page, with all 40
reference images preserved. Navigation is ordered Benchmark, Leaderboard,
Gallery, Scenes and interactions; every link scrolls within the same page.
The header uses the official Alaya icon, displayed in white on the dark theme.
The former scenes.html redirects to index.html#examples.
Widget styles and events are scoped to the leaderboard; filter
parameters use the lb_ prefix. The former leaderboard.html is a compatibility
redirect to index.html#leaderboard, with legacy query keys translated.
The home page's Fraunces, Inter and DM Sans fonts are bundled locally.
Method icons and official resource links: assets/leaderboard-models.js.
These are maintained separately from generated scores, so importing results
does not overwrite them. Icons are bundled in assets/model-icons and
assets/resource-icons; their origins are recorded in each directory's
sources.json. CWM, C2R, LynnReal and EchoWM use local monograms; other icons
come from official project or organization profiles. Each model's verified
links appear beneath its name, with descriptive tooltips, and open in a new tab.
Leaderboard fonts are bundled in assets/fonts with their OFL licenses; loading
the leaderboard requires no external font/CDN connection. The preview server
disables caching for HTML, CSS and scripts to keep local revisions consistent.
The table retains WBench-style sorting and comparison controls with the
home page's dark theme. Split, Metric and Type buttons switch the view;
the colored dimension labels open their submetrics.
"Metrics in each dimension" lists the included metrics for the current split,
including the extra detection metric in Multi-view and memory metrics in
Long-horizon. The metric reference table shows names and descriptions.
All Metrics reveals the raw/0-100 scale toggle. Select Models enables selection
and comparison; Compact hides secondary row details. Per-metric ranks always
use all models in the current split. Methodology and sources are collapsed below.

Check data integrity and scoring behavior:
  node --test tests/leaderboard.test.cjs
Check the importer and Python/JavaScript equivalence for all 470 metrics and 35 total scores:
  PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -p 'test_*.py'

The normalized view transforms reported model means; it does not claim to
recompute averages of normalized per-sample scores. Rankings are computed
independently for each evaluation setting, across its reported models.
The default view shows Average (Overall) and dimension scores, sorted by Overall:
  Category score = arithmetic mean of its normalized submetrics.
  Overall score = arithmetic mean of the category scores in that setting.
Categories receive equal weight regardless of their number of submetrics.
All submetrics in the setting are used, including Warp, even if a different
column view is selected. Filtering models does not change the scores.
Overall and categories always use normalized values, including in raw mode.
Averages and ranks use full precision; aggregate display rounds to 2 decimals.
WBENCH's scaling is reused for Aesthetic, Imaging and Smoothness.
Geometry/camera scores use reciprocal mappings; RotErr is converted to radians.
Warp uses 100 * (1 - sqrt(x / 1000)), clipped to [0, 100]. The leaderboard
adopts the local eval/prowbench_eval/metric_temporal.py convention: pixel
differences divided by 255, squared and averaged over RGB channels and
unoccluded pixels, then averaged over frame pairs and reported times 1000.
Temporal quality = (normalized Warp + normalized Smoothness) / 2.
Missing required values, including Warp, make their category and Overall
unavailable, rather than silently changing weights.
Original gISR/gLRA aggregates are preserved exactly.

CSV exports include the visible setting, models and metrics, original raw
values alongside normalized scores, and source location/score-basis columns.
Aggregate exports include the Overall/category scores and aggregation rule.
The JSON download includes the complete snapshot and limitations. Filters,
selected models, sort order and display scale are encoded in the page URL.
