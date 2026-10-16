(function () {
  'use strict';
  const data = window.PROWLeaderboardData;
  const core = window.PROWLeaderboard;
  const models = window.PROWLeaderboardModels || {};
  const host = document.querySelector('[data-leaderboard]');
  if (!host || !data || !core) return;
  const embedded = host.dataset.embedded === 'true';
  const $ = id => host.querySelector('#' + CSS.escape(id));
  const escape = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const params = new URLSearchParams(window.location.search);
  const urlKey = key => embedded ? 'lb_' + key : key;
  const getParam = key => params.get(urlKey(key));
  const validSplits = data.splits.map(split => split.id);
  const views = { groups: 'Dimensions', core: 'Core metrics', all: 'All metrics', entity: 'Entity control', logic: 'Logic / state', camera: 'Camera control', quality: 'Visual quality', temporal: 'Temporal quality', text: 'Text alignment', visual: 'Quality & text', memory: 'Memory', appearance: 'Multi-view' };
  const dimensionLabels = { entity: 'Entity', logic: 'Logic / state', camera: 'Camera', quality: 'Quality', temporal: 'Temporal', text: 'Text', memory: 'Memory', appearance: 'Multi-view' };
  const state = {
    split: validSplits.includes(getParam('split')) ? getParam('split') : 'verified',
    mode: getParam('scale') === 'raw' ? 'raw' : 'normalized',
    family: ['camera', 'renderer', 'general'].includes(getParam('family')) ? getParam('family') : 'all',
    view: views[getParam('metrics')] ? getParam('metrics') : 'groups',
    query: getParam('q') || '',
    sort: getParam('sort') || 'overall',
    order: getParam('order') === 'asc' ? 'asc' : 'desc',
    compact: getParam('compact') === '1',
    selected: new Set((getParam('models') || '').split(',').filter(id => data.models[id])),
    selectedOnly: getParam('compare') === '1',
    selectionMode: false
  };
  state.selectionMode = state.selected.size > 0;
  const familyShort = { camera: 'Camera', renderer: 'Renderer', general: 'Foundation' };
  const contexts = {
    verified: 'Verified-FF and Unverified-FF use disjoint scenes. The first frame is shared by methods that accept it.',
    unverified: 'Scenes differ from Verified-FF. Image-conditioned methods use an unchecked MiniMax-H3 frame; other methods receive no RGB first frame.',
    'long-horizon': 'State Persistence is conditional on judgeable return events; the paper reports only 17–21 such events per method.',
    'multi-view': 'Appearance scores exclude unjudgeable observations. Read them together with Detection (or Miss in reported values).',
    gunfight: '20 cases from 10 source recordings. PWM specializes in this domain; these results are ranked separately from the main track.'
  };
  let shownRows = [];
  let shownMetrics = [];
  const getSplit = () => data.splits.find(split => split.id === state.split);
  const defaultOrder = id => core.directionFor(id, state.mode, data.metrics) === 'higher' ? 'desc' : 'asc';
  const availableViews = split => Object.keys(views).filter(view => core.visibleMetrics(split, view).length);

  function sanitizeState() {
    const split = getSplit();
    if (!availableViews(split).includes(state.view)) state.view = 'groups';
    if (!split.rows.some(row => row.family === state.family)) state.family = 'all';
    const allowed = new Set(split.rows.map(row => row.model_id));
    state.selected = new Set([...state.selected].filter(id => allowed.has(id)));
    if (state.selected.size < 2) state.selectedOnly = false;
    shownMetrics = ['overall', ...core.visibleMetrics(split, state.view)];
    if (state.sort !== 'model' && !shownMetrics.includes(state.sort)) {
      state.sort = 'overall';
      state.order = 'desc';
    }
  }
  function updateUrl() {
    const url = new URL(window.location.href);
    const entries = {
      split: state.split === 'verified' ? null : state.split,
      scale: state.mode === 'normalized' ? null : 'raw',
      family: state.family === 'all' ? null : state.family,
      metrics: state.view === 'groups' ? null : state.view,
      q: state.query || null, sort: state.sort === 'overall' ? null : state.sort,
      order: state.order === 'desc' ? null : state.order,
      compact: state.compact ? '1' : null,
      models: state.selected.size ? [...state.selected].join(',') : null,
      compare: state.selectedOnly ? '1' : null
    };
    Object.entries(entries).forEach(([key, value]) => value === null ? url.searchParams.delete(urlKey(key)) : url.searchParams.set(urlKey(key), value));
    try { window.history.replaceState(null, '', url); } catch (_) { /* Local file previews can disallow history updates. */ }
  }
  function sortButton(id, label, title) {
    const arrow = state.sort === id ? (state.order === 'desc' ? '↓' : '↑') : '↕';
    return '<button type="button" class="lb-sort" data-sort="' + id + '" data-focus="sort-' + id +
      '" title="' + escape(title) + '" aria-label="Sort by ' + escape(title) + '">' +
      escape(label) + '<span class="lb-sort-arrow" aria-hidden="true">' + arrow + '</span></button>';
  }
  const ariaSort = id => state.sort === id ? ' aria-sort="' + (state.order === 'desc' ? 'descending' : 'ascending') + '"' : '';

  function rankMarkup(rank, perMetric) {
    if (rank === null) return '—';
    if (rank > 3) return (perMetric ? '#' : '') + rank;
    return '<svg class="lb-medal lb-medal-' + rank + '" viewBox="0 0 24 28" role="img" aria-label="Rank ' + rank + '">' +
      '<path d="M5 1h5l4 10-5 3z" fill="#76a3e5"/><path d="M14 1h5l-4 13-5-3z" fill="#e68780"/>' +
      '<circle cx="12" cy="17" r="9" fill="var(--medal-fill)" stroke="var(--medal-edge)"/>' +
      '<circle cx="12" cy="17" r="6.5" fill="none" stroke="var(--medal-edge)" stroke-opacity=".5"/>' +
      '<text x="12" y="20.5" text-anchor="middle" fill="#514839" font-family="Arial, sans-serif" font-size="10" font-weight="700">' + rank + '</text></svg>';
  }
  function modelIcon(row) {
    const profile = models[row.model_id];
    if (profile && profile.icon) return '<img class="lb-model-icon" src="' + escape(profile.icon) +
      '" width="24" height="24" alt="" title="' + escape(profile.icon_label) + '">';
    return '<span class="lb-model-icon lb-model-monogram" aria-hidden="true">' + escape(row.model_name.slice(0, 2).toUpperCase()) + '</span>';
  }
  function modelResources(row) {
    const profile = models[row.model_id];
    if (!profile || !profile.links.length) return '';
    return '<div class="lb-model-resources">' + profile.links.map(link => {
      const label = row.model_name + ' · ' + link.label;
      return '<a class="lb-resource" href="' + escape(link.url) + '" target="_blank" rel="noopener noreferrer"' +
        ' title="' + escape(label) + '" aria-label="' + escape(label) + '"><img src="assets/resource-icons/' +
        escape(link.kind) + '.svg" width="14" height="14" alt=""></a>';
    }).join('') + '</div>';
  }
  function renderHead() {
    const split = getSplit();
    const headers = shownMetrics.map(id => {
      if (core.isAggregate(id)) {
        const count = id === 'overall' ? core.categoryIds(split).length : core.categoryMetricIds(split, id.slice(6)).length;
        const label = id === 'overall' ? 'Average' : dimensionLabels[id.slice(6)];
        const title = id === 'overall'
          ? 'Overall — equal-weight mean of ' + count + ' category scores, on a 0–100 scale'
          : core.groups[id.slice(6)] + ' — mean of normalized ' + core.categoryMetricIds(split, id.slice(6)).map(key => data.metrics[key].short_name).join(', ');
        return '<th scope="col" class="group-' + (id === 'overall' ? 'overall' : id.slice(6)) + '"' + ariaSort(id) + '>' + sortButton(id, label, title) + '</th>';
      }
      const metric = data.metrics[id], definition = core.definitions[id];
      let label = core.metricLabel(id, state.mode, data.metrics);
      if (state.mode === 'normalized' && core.nonlinear.has(id)) label += ' †';
      if (state.mode === 'raw' && id === 'rot') label += ' °';
      if (state.mode === 'raw' && id === 'warp') label += ' ×10⁻³';
      const title = metric.name + ' — ' + (state.mode === 'raw' ? metric.paper_unit + '; ' + metric.direction + ' is better' : definition[1]) + '. ' + definition[2];
      return '<th scope="col" class="group-' + metric.group + '"' + ariaSort(id) + '>' + sortButton(id, label, title) + '</th>';
    }).join('');
    $('results-head').innerHTML = '<tr><th scope="col" class="lb-rank-head" title="Rank within this setting for the sorted metric">#</th>' +
      '<th scope="col" class="lb-model-head"' + ariaSort('model') + '>' + sortButton('model', 'Model', 'model name') +
      '</th>' + headers + '</tr>';
  }
  function renderRows() {
    const split = getSplit();
    const filtered = core.filterRows(split.rows, state.family, state.query, state.selectedOnly ? state.selected : null);
    shownRows = core.sortRows(filtered, state.sort, state.mode, state.order, data.metrics, split);
    $('results-body').innerHTML = shownRows.map(row => {
      const rank = core.rankFor(row, split.rows, state.sort, state.mode, data.metrics, split);
      const checked = state.selected.has(row.model_id);
      const inputBadges = row.inputs.map(input => '<button type="button" class="lb-input-badge" data-input="' + input +
        '" title="' + escape(data.input_legend[input]) + '" aria-label="' + escape(input + ': ' + data.input_legend[input]) + '">' + input + '</button>').join('');
      const cells = shownMetrics.map(id => {
        const value = core.valueFor(row, id, state.mode, split);
        const aggregate = core.isAggregate(id);
        const className = core.highlightFor(row, split.rows, id, state.mode, data.metrics, split) +
          (id === 'overall' ? ' lb-overall' : aggregate ? ' lb-category' : '');
        const title = aggregate
          ? (id === 'overall' ? 'Overall: equal-weight mean of all category scores in this setting.'
            : core.groups[id.slice(6)] + ': mean of normalized ' + core.categoryMetricIds(split, id.slice(6)).map(key => data.metrics[key].short_name).join(', ') + '.') +
            ' Computed before rounding, on the 0–100 scale.'
          : 'Reported: ' + core.reportedValue(row, id) + ' (' + data.metrics[id].paper_unit + ')' +
            (row.metric_coverage ? '. n = ' + row.metric_coverage[id].n + ' / ' + row.metric_coverage[id].expected +
              ' expected; ' + row.metric_coverage[id].aggregation : '') +
            (state.mode === 'normalized' ? '. Display mapping: ' + core.definitions[id][1] : '');
        if (value === null) return '<td class="lb-pending" data-metric="' + id + '" title="' +
          'A required score is unavailable; the average is not computed from a reduced subset.' +
          '"><a href="#methodology" data-methodology aria-label="Score calculation details">—</a></td>';
        const metricRank = core.rankFor(row, split.rows, id, state.mode, data.metrics, split);
        return '<td class="' + className + '" data-metric="' + id + '" data-rank="' + metricRank + '" title="' + escape(title) + '">' +
          '<span class="lb-score-value">' + core.formatValue(row, id, state.mode, data.metrics, split) + '</span>' +
          '<span class="lb-cell-rank">' + rankMarkup(metricRank, true) + '</span></td>';
      }).join('');
      const rowClasses = [rank !== null && rank <= 3 ? 'lb-place-' + rank : '', state.selectionMode && checked ? 'lb-selected' : ''].filter(Boolean).join(' ');
      const nameTag = state.selectionMode ? 'label' : 'span';
      return '<tr data-model="' + row.model_id + '" data-rank="' + (rank ?? '') + '" class="' + rowClasses + '">' +
        '<td class="lb-rank">' + rankMarkup(rank, false) + '</td><td class="lb-model">' +
        '<div class="lb-model-name"><input type="checkbox" id="select-' + row.model_id + '" data-select="' + row.model_id +
        '" data-focus="select-' + row.model_id + '" aria-label="Select ' + escape(row.model_name) + '" ' + (checked ? 'checked' : '') +
        (state.selectionMode ? '' : ' hidden') + '>' + modelIcon(row) + '<' + nameTag + ' title="' + escape(row.model_name) + '"' + (state.selectionMode ? ' for="select-' + row.model_id + '"' : '') + '>' + escape(row.model_name) + '</' + nameTag + '></div>' +
        '<div class="lb-model-details"><div class="lb-model-meta"><span class="lb-type-tag ' + row.family + '" title="' +
        core.families[row.family] + '">' + familyShort[row.family] + '</span><span class="lb-inputs">' + inputBadges + '</span>' +
        (row.source.kind === 'evaluation' ? '<a class="lb-run-badge" href="#run-' + escape(row.source.run_id) + '" data-run-source title="View evaluation sources and sample coverage">Evaluation ↗</a>' : '') +
        '</div>' + modelResources(row) + '</div></td>' + cells + '</tr>';
    }).join('');
    $('empty-results').hidden = shownRows.length > 0;
    $('export-csv').disabled = shownRows.length === 0;
    $('visible-count').textContent = shownRows.length + ' / ' + split.rows.length + ' models';
  }
  function render() {
    const focusKey = document.activeElement && document.activeElement.dataset.focus;
    sanitizeState();
    const split = getSplit();
    host.querySelectorAll('[data-split]').forEach(button => button.setAttribute('aria-pressed', button.dataset.split === state.split));
    host.querySelectorAll('[data-family]').forEach(button => {
      const family = button.dataset.family;
      const count = split.rows.filter(row => family === 'all' || row.family === family).length;
      button.setAttribute('aria-pressed', family === state.family);
      button.querySelector('small').textContent = '(' + count + ')';
      button.disabled = count === 0;
    });
    host.querySelectorAll('[data-scale]').forEach(button => button.setAttribute('aria-pressed', button.dataset.scale === state.mode));
    $('dimension-legend').innerHTML = core.categoryIds(split).map(group => '<button type="button" class="lb-legend-item group-' + group +
      '" data-view="' + group + '" data-focus="legend-' + group + '" aria-pressed="' + (state.view === group) + '" title="Show ' + escape(core.groups[group]) +
      ' metrics">' + escape(core.groups[group]) + '</button>').join('') + '<span class="lb-legend-note">Hover headers for metric definitions</span>';
    $('dimension-setting').textContent = split.name + ': each dimension averages the normalized metrics listed below.';
    $('dimension-guide').innerHTML = core.categoryIds(split).map(group => {
      const names = core.categoryMetricIds(split, group).map(id => {
        const metric = data.metrics[id];
        const label = metric.name.includes(metric.short_name) ? metric.name : metric.name + ' (' + metric.short_name + ')';
        return escape(label + (id === 'miss' ? ' — shown as Detection in the 0–100 view' : ''));
      });
      return '<div class="group-' + group + '"><dt>' + escape(dimensionLabels[group]) + '</dt><dd>' + names.join(' · ') + '</dd></div>';
    }).join('');
    host.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', button.dataset.view === state.view));
    $('dimensions-view').textContent = core.categoryIds(split).length + ' Dimensions';
    $('metrics-count').textContent = '(' + split.metric_ids.length + ')';
    $('scale-control').hidden = state.view === 'groups';
    $('display-description').textContent = state.mode === 'raw' && state.view !== 'groups'
      ? 'Click column headers to sort. Raw metric values; Average stays on the 0–100 scale. # = per-metric rank.'
      : 'Click column headers to sort. Scores 0–100, higher is better. # = per-metric rank.';
    $('setting-description').textContent = split.description;
    $('setting-count').textContent = split.cases + (state.split === 'multi-view' ? ' scenes · 4 views each' : ' cases · ' + split.duration_seconds + ' s');
    $('context-note').textContent = contexts[state.split];
    $('ranking-description').innerHTML = state.sort === 'model' ? 'Models sorted by name.'
      : 'Ranked by <strong>' + escape(core.metricLabel(state.sort, state.mode, data.metrics)) + '</strong> · ' +
        (state.mode === 'normalized' || core.isAggregate(state.sort) ? '0–100, higher is better' : (core.directionFor(state.sort, state.mode, data.metrics) === 'higher' ? '↑ higher' : '↓ lower') + ' is better');
    $('score-note').innerHTML = 'Average = mean of ' + core.categoryIds(split).length + ' dimension scores; each dimension averages its normalized metrics. ' +
      (state.mode === 'normalized' && state.view !== 'groups' ? '† Nonlinear mapping. ' : '') +
      '<a href="#methodology" data-methodology>Scoring details ↗</a>';
    $('selected-count').textContent = state.selected.size;
    $('selected-only').disabled = state.selected.size < 2;
    $('selected-only').setAttribute('aria-pressed', state.selectedOnly);
    $('selected-only').textContent = state.selectedOnly ? 'Show all models' : 'Compare selected';
    $('selection-bar').hidden = !state.selectionMode;
    $('selection-toggle').setAttribute('aria-pressed', state.selectionMode);
    $('clear-selection').hidden = state.selected.size === 0;
    $('compact-toggle').setAttribute('aria-pressed', state.compact);
    host.classList.toggle('lb-compact', state.compact);
    renderHead();
    renderRows();
    updateUrl();
    if (focusKey) {
      const replacement = host.querySelector('[data-focus="' + CSS.escape(focusKey) + '"]');
      if (replacement) replacement.focus({ preventScroll: true });
    }
  }
  function download(content, type, filename) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement('a');
    link.href = url; link.download = filename;
    document.body.appendChild(link);
    link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  host.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (button && button.dataset.split) {
      state.split = button.dataset.split;
      state.selected.clear(); state.selectedOnly = false;
      render();
    } else if (button && button.dataset.family) {
      state.family = button.dataset.family; render();
    } else if (button && button.dataset.view) {
      state.view = state.view === button.dataset.view && !['groups', 'all'].includes(state.view) ? 'groups' : button.dataset.view;
      render();
    } else if (button && button.dataset.scale) {
      const previousDirection = state.sort === 'model' ? null : core.directionFor(state.sort, state.mode, data.metrics);
      state.mode = button.dataset.scale;
      if (state.sort !== 'model' && previousDirection !== core.directionFor(state.sort, state.mode, data.metrics))
        state.order = state.order === 'asc' ? 'desc' : 'asc';
      render();
    } else if (button && button.dataset.sort) {
      const id = button.dataset.sort;
      state.order = state.sort === id ? (state.order === 'desc' ? 'asc' : 'desc') : id === 'model' ? 'asc' : defaultOrder(id);
      state.sort = id; render();
    } else if (button && button.dataset.input) {
      const note = $('input-explanation');
      note.textContent = button.dataset.input + ' · ' + data.input_legend[button.dataset.input];
      note.hidden = false;
    }
    const methodologyLink = event.target.closest('[data-methodology]');
    if (methodologyLink) $('methodology').open = true;
    if (event.target.closest('[data-run-source]')) $('evaluation-source').open = true;
  });
  $('results-body').addEventListener('change', event => {
    if (!event.target.dataset.select) return;
    const id = event.target.dataset.select;
    event.target.checked ? state.selected.add(id) : state.selected.delete(id);
    render();
  });
  $('model-search').value = state.query;
  $('model-search').addEventListener('input', event => { state.query = event.target.value; render(); });
  $('compact-toggle').addEventListener('click', () => { state.compact = !state.compact; render(); });
  $('selection-toggle').addEventListener('click', () => {
    state.selectionMode = !state.selectionMode;
    if (!state.selectionMode) state.selectedOnly = false;
    render();
  });
  $('selected-only').addEventListener('click', () => { state.selectedOnly = !state.selectedOnly; render(); });
  $('clear-selection').addEventListener('click', () => { state.selected.clear(); state.selectedOnly = false; render(); });
  $('reset-filters').addEventListener('click', () => {
    state.query = ''; state.family = 'all'; state.selectedOnly = false;
    $('model-search').value = ''; render();
  });
  $('export-csv').addEventListener('click', () => {
    download(core.exportCsv(shownRows, shownMetrics, getSplit(), state.mode, state.sort, data.metrics),
      'text/csv;charset=utf-8', 'prowbench-' + state.split + '-' + state.mode + '.csv');
    $('live-message').textContent = 'Exported ' + shownRows.length + ' models to CSV.';
  });
  $('download-data').addEventListener('click', () => {
    download(JSON.stringify(data, null, 2) + '\n', 'application/json', 'prowbench-source-results.json');
    $('live-message').textContent = 'Downloaded all ' + data.counts.model_setting_rows + ' source results.';
  });
  $('metric-guide').innerHTML = Object.entries(data.metrics).map(([id, metric]) => '<tr><td>' + escape(metric.name) +
    '</td><td>' + escape(core.definitions[id][2]) + '</td></tr>').join('');
  $('input-guide').innerHTML = Object.entries(data.input_legend).map(([id, meaning]) =>
    '<dt>' + id + '</dt><dd>' + escape(meaning) + '</dd>').join('');
  const footerCount = document.querySelector('.lb-footer span');
  if (footerCount) footerCount.textContent = data.counts.distinct_models + ' models · ' + data.counts.splits + ' settings · ' + data.counts.distinct_metrics + ' metrics';
  $('source-count').textContent = data.counts.model_setting_rows + ' model-setting results · ' + data.counts.reported_metric_cells + ' reported values';
  const runs = data.evaluation_runs || [];
  $('evaluation-source').hidden = runs.length === 0;
  $('evaluation-count').textContent = runs.map(run => run.model_name + ' · ' + run.sample_count + ' videos').join('; ');
  $('evaluation-runs').innerHTML = runs.map(run => {
    const coverage = Object.entries(run.datasets).map(([id, info]) => {
      const split = data.splits.find(s => s.id === id);
      const counts = Object.entries(info.coverage).map(([metric, item]) =>
        data.metrics[metric].short_name + ' ' + item.n + '/' + item.expected).join('; ');
      return '<tr><td>' + escape(split.name) + '</td><td>' + info.videos + '</td><td>' + info.reference_image_count + '</td><td>' + escape(counts) + '</td></tr>';
    }).join('');
    return '<article class="lb-evaluation-run" id="run-' + escape(run.id) + '"><p><strong>' + escape(run.model_name) + '</strong> · Run <code>' + escape(run.method) + '</code></p>' +
      '<p>' + run.metric_count + ' reported aggregates across five settings. ' + run.validation.matched_aggregates +
      ' were reproduced from the per-sample CSV. Multi-view Compliance, Consistency and MEt3R use the summary values; those three metrics are absent from the per-sample CSV.</p>' +
      '<div class="lb-data-actions">' + Object.entries(run.files).map(([name, file]) => '<a href="' + escape(file.path) + '" download>↓ ' + escape(name) + '</a>').join('') + '</div>' +
      '<div class="lb-guide-scroll"><table class="lb-guide-table lb-coverage-table"><thead><tr><th scope="col">Setting</th><th scope="col">Videos</th><th scope="col">With reference image</th><th scope="col">Metric n / expected</th></tr></thead><tbody>' + coverage + '</tbody></table></div>' +
      '<p>Multi-view control metrics average four views per scene, then ten scenes. MEt3R reports 540 evaluated view pairs. Long-horizon Re-IoU and Re-State average the recordings with defined scores, rather than pooling return events. Unverified-FF has 89 eligible entity scores across 90 videos, as specified by the evaluation summary.</p>' +
      '<p>RI marks a supplied reference image; the CSV does not establish first-frame verification. B denotes colored-OBB input. Scores transform the supplied aggregate means using the same formulas as the paper rows, with full precision until display. Temporal quality averages normalized Warp and Smoothness.</p></article>';
  }).join('');
  if (window.location.hash === '#methodology') $('methodology').open = true;
  if (window.location.hash === '#data-source') $('data-source').open = true;
  if (window.location.hash === '#evaluation-source' || window.location.hash.startsWith('#run-')) $('evaluation-source').open = true;
  render();
  host.dataset.ready = 'true';
})();
