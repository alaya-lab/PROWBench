/* Shared markup for the home-page section and standalone leaderboard. */
(function () {
  'use strict';
  const host = document.querySelector('[data-leaderboard]');
  if (!host) return;
  const headingTag = host.dataset.embedded === 'true' ? 'h2' : 'h1';
  host.innerHTML = `
      <div class="lb-title-row">
        <${headingTag} id="leaderboard-title">Leaderboard</${headingTag}>
        <div class="lb-actions">
          <button type="button" id="export-csv" class="lb-action lb-bracket" title="Export the visible models and metrics, including source values"><span class="lb-action-icon" aria-hidden="true">↓</span> Export CSV</button>
          <button type="button" id="compact-toggle" class="lb-action lb-bracket" aria-pressed="false" title="Use compact table rows"><span aria-hidden="true">↕</span> Compact</button>
          <button type="button" id="selection-toggle" class="lb-action lb-bracket" aria-pressed="false" aria-controls="selection-bar" title="Select models to compare"><span class="lb-select-icon" aria-hidden="true">✓</span> Select Models</button>
        </div>
      </div>
      <p class="lb-description" id="display-description">Click column headers to sort. Scores 0–100, higher is better. # = per-metric rank.</p>
      <div id="dimension-legend" class="lb-dimension-legend" role="group" aria-label="Metric dimensions"></div>
      <details id="dimension-details" class="lb-dimension-details">
        <summary>Metrics in each dimension</summary>
        <p id="dimension-setting"></p>
        <dl id="dimension-guide" class="lb-dimension-guide"></dl>
      </details>
      <div class="lb-filter-row">
        <div class="lb-filter-group lb-splits" role="group" aria-label="Evaluation setting">
          <span class="lb-filter-label">Split:</span>
          <button type="button" data-split="verified" aria-pressed="true">Verified-FF <small>(40)</small></button>
          <button type="button" data-split="unverified" aria-pressed="false">Unverified-FF <small>(90)</small></button>
          <button type="button" data-split="long-horizon" aria-pressed="false" title="Ten 30-second recordings">Long-horizon <small>(10)</small></button>
          <button type="button" data-split="multi-view" aria-pressed="false" title="Ten scenes, four synchronized views each">Multi-view <small>(10)</small></button>
          <button type="button" data-split="gunfight" aria-pressed="false">Gunfight <small>(20)</small></button>
        </div>
        <div class="lb-filter-group" role="group" aria-label="Metric view">
          <span class="lb-filter-label">Metric:</span>
          <button type="button" data-view="groups" id="dimensions-view" aria-pressed="true">6 Dimensions</button>
          <button type="button" data-view="all" aria-pressed="false">All Metrics <small id="metrics-count">(14)</small></button>
        </div>
      </div>
      <div class="lb-filter-row">
        <div class="lb-filter-group" role="group" aria-label="Model family">
          <span class="lb-filter-label">Type:</span>
          <button type="button" data-family="all" aria-pressed="true">All <small></small></button>
          <button type="button" data-family="camera" aria-pressed="false">Camera <small></small></button>
          <button type="button" data-family="renderer" aria-pressed="false">Renderer <small></small></button>
          <button type="button" data-family="general" aria-pressed="false">Foundation <small></small></button>
        </div>
        <div class="lb-filter-group" id="scale-control" role="group" aria-label="Score scale" hidden>
          <span class="lb-filter-label">Scale:</span>
          <button type="button" data-scale="normalized" aria-pressed="true">0–100</button>
          <button type="button" data-scale="raw" aria-pressed="false">Raw</button>
        </div>
        <label class="lb-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>
          <span class="sr-only">Search models</span>
          <input id="model-search" type="search" placeholder="Search models…" autocomplete="off">
        </label>
      </div>
      <div class="lb-selection-bar" id="selection-bar" hidden>
        <span><strong id="selected-count">0</strong> selected</span>
        <button type="button" id="selected-only" class="lb-action" aria-pressed="false" disabled>Compare selected</button>
        <button type="button" id="clear-selection" class="lb-action" hidden>Clear</button>
        <span class="lb-selection-hint">Select at least two models.</span>
      </div>
      <p id="ranking-description" class="sr-only" role="status"></p>
      <div class="lb-table-scroll" role="region" aria-label="Scrollable model leaderboard" tabindex="0">
        <table id="results-table" class="lb-table">
          <caption class="sr-only">PROWBench model results, ranked by the mean of category scores by default. Each category averages its normalized submetrics. Activate a header to sort; select models to compare.</caption>
          <thead id="results-head"></thead>
          <tbody id="results-body"></tbody>
        </table>
        <div id="empty-results" class="lb-empty" hidden><strong>No matching models</strong><p>Try another name or model family.</p><button type="button" id="reset-filters" class="lb-action">Reset filters ↗</button></div>
      </div>
      <p id="input-explanation" class="lb-context-note" role="status" hidden></p>
      <div class="lb-table-footer">
        <p id="score-note"></p>
        <span id="visible-count" role="status" aria-live="polite"></span>
      </div>
      <div id="live-message" class="sr-only" role="status" aria-live="polite"></div>

    <section class="lb-reading" aria-label="Leaderboard details">
      <details id="methodology" class="lb-details">
        <summary>Metrics &amp; normalization</summary>
        <div class="lb-details-content">
          <p><strong>Dimension score = mean of its normalized submetrics. Average (Overall) = equal-weight mean of the dimension scores in the current setting.</strong> Every dimension has the same weight in Overall, regardless of its number of submetrics. All submetrics in the setting are included in their category; changing the visible columns or filtering models does not change the scores. Calculations use full precision before rounding for display.</p>
          <p>The 0–100 view applies fixed display transformations to the <strong>reported model-level means</strong>. All available display scores are higher-is-better. Nonlinear transforms, including reciprocals and Warp’s square root, are not equivalent to averaging transformed per-video scores; these columns are marked †. Overall and category scores always use normalized values, including when individual metrics are displayed in their reported units. Settings are ranked separately, using the categories evaluated in each setting.</p>
          <p>Aesthetic, Imaging and Motion Smoothness use WBENCH’s scaling. Geometry and camera errors borrow its reciprocal error-to-score form; rotation is converted from degrees to radians. These camera mappings are display conventions, not WBENCH’s NavScore. One radian of rotation error corresponds to 50 display points.</p>
          <p><strong>Temporal quality = (normalized Warp + normalized Smoothness) / 2.</strong> Warp uses 100 × (1 − √(x / 1000)), clipped to [0, 100]. Here x is the reported Warp value. This leaderboard adopts the local evaluator’s convention: pixel differences are divided by 255, squared and averaged across RGB channels and unoccluded pixels, then averaged over frame pairs and reported ×1000. This is a custom display mapping of reported means. If any required submetric, including Warp, is missing, its category score and Overall are unavailable rather than averaged over a smaller subset.</p>
          <p><a href="NORMALIZATION.md" download>↓ Download the full normalization guide (.md)</a></p>
          <div class="lb-guide-scroll"><table class="lb-guide-table lb-metric-guide-table"><thead><tr><th scope="col">Metric</th><th scope="col">What it measures</th></tr></thead><tbody id="metric-guide"></tbody></table></div>
          <p class="lb-source-links">References: <a href="https://arxiv.org/abs/2605.25874" target="_blank" rel="noopener">WBENCH, Appendix C ↗</a> · <a href="https://lightning.ai/docs/torchmetrics/stable/multimodal/clip_score" target="_blank" rel="noopener">CLIPScore ↗</a> · <a href="https://github.com/mohammadasim98/met3r" target="_blank" rel="noopener">MEt3R ↗</a></p>
        </div>
      </details>
      <details class="lb-details">
        <summary>Settings &amp; conditioning</summary>
        <div class="lb-details-content">
          <p><strong id="setting-count"></strong> · <span id="setting-description"></span></p>
          <p id="context-note"></p>
          <p>Verified-FF and Unverified-FF contain different scenes. Rankings are computed independently for each setting. Methods receive their native control inputs; all also receive the text prompt. Select a model’s input badges to read their meaning.</p>
          <dl id="input-guide" class="lb-input-guide"></dl>
          <p>Long-horizon State Persistence uses only judgeable return events. Multi-view appearance percentages exclude absent or unjudgeable targets and should be read together with detection coverage. Gunfight comprises 20 cases derived from 10 source recordings.</p>
        </div>
      </details>
      <details class="lb-details" id="evaluation-source" hidden>
        <summary><span>Added evaluation results</span><span class="lb-details-subtitle" id="evaluation-count"></span></summary>
        <div class="lb-details-content" id="evaluation-runs"></div>
      </details>
      <details class="lb-details" id="data-source">
        <summary>Data &amp; provenance</summary>
        <div class="lb-details-content">
          <p id="source-count">35 model-setting results · 470 reported values</p>
          <p>This snapshot uses the active results tables in the supplied <strong>PROWBench.zip manuscript revision</strong>. Some Verified-FF values differ from the PDF currently bundled with the project site. The download retains the exact printed values, table locations and source-file hashes.</p>
          <p>gISR and gLRA are imported directly: each is calculated as a product per sample before averaging. Multiplying the reported mean IoU by the reported mean ISR or LRA would give a different result.</p>
          <div class="lb-data-actions"><button type="button" id="download-data" class="lb-action">↓ Download all source data (JSON)</button><a href="assets/PROWBench.pdf" target="_blank" rel="noopener">Project PDF ↗</a></div>
        </div>
      </details>
    </section>

  `;
})();
