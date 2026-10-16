/* Pure display transformations of reported model means from paper tables or evaluation CSVs. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PROWLeaderboard = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const groups = {
    entity: 'Entity control', logic: 'Logic / state', camera: 'Camera control',
    quality: 'Visual quality', temporal: 'Temporal quality', text: 'Text alignment',
    memory: 'Memory', appearance: 'Multi-view consistency'
  };
  const families = { camera: 'Camera-conditioned', renderer: 'Task-specific renderer', general: 'Video foundation model' };
  const definitions = {
    iou: ['BBox IoU', '100 × x', 'Overlap with engine-projected boxes. Missing detections contribute zero.'],
    cerr: ['Center', '100 / (1 + x)', 'Image-diagonal-normalized center displacement, conditional on detection.'],
    isr: ['ISR', '100 × x', 'Fraction of registered events with both the prescribed action and end state.'],
    lra: ['LRA', '100 × x', 'Fraction of timeline segments depicting their prescribed action.'],
    gisr: ['gISR', '100 × x', 'ISR multiplied by BBox IoU per sample, then averaged.'],
    glra: ['gLRA', '100 × x', 'LRA multiplied by BBox IoU per sample, then averaged.'],
    rot: ['Rotation', '100 / (1 + πx / 180)', 'Camera rotation error in degrees; converted to radians before the reciprocal mapping.'],
    trans: ['Translation', '100 / (1 + x)', 'Translation error after each trajectory is normalized by its maximum displacement.'],
    cammc: ['Camera', '100 / (1 + x)', 'Distance between reference and estimated pose matrices, with normalized translation.'],
    img: ['Imaging', 'x', 'MUSIQ imaging quality, already on the 0–100 scale used by WBENCH.'],
    aes: ['Aesthetic', '100 × x', 'The reported LAION score is divided by 10; rescale it as in WBENCH.'],
    warp: ['Warp', '100 × (1 − √(x / 1000))', 'Masked mean RGB squared error after pixel differences are divided by 255, reported ×1000. Convert to normalized RMSE, then subtract from 1.'],
    smooth: ['Smooth', '100 × x', 'VBench interpolation smoothness: 1 − MAE / 255, rescaled as in WBENCH.'],
    clip: ['CLIP', 'clip(x, 0, 100)', 'Image–text CLIP cosine similarity, already multiplied by 100. Negative values are clamped to zero.'],
    re_iou: ['Re-IoU', '100 × x', 'Box overlap after an entity re-enters the view; missing detections contribute zero.'],
    re_state: ['Re-State', '100 × x', 'Correct walking/standing state on judgeable return events with unchanged reference state.'],
    miss: ['Detection', '100 × (1 − x)', 'Complement of the BBox miss rate. Read conditional appearance scores together with this metric.'],
    comp: ['Compliance', 'x', 'Percentage of judgeable observations matching the authored appearance description.'],
    cons: ['Consistency', 'x', 'Percentage of judgeable observations with matching appearance across synchronized views.'],
    met3r: ['MEt3R', '100 × (1 − x / 2)', 'Reverse the standard MEt3R cosine-distance range [0, 2]. Measures mutual view consistency.']
  };
  const percentage = new Set(['iou', 'isr', 'lra', 'gisr', 'glra', 'aes', 'smooth', 're_iou', 're_state']);
  const reciprocal = new Set(['cerr', 'trans', 'cammc']);
  const nonlinear = new Set(['cerr', 'rot', 'trans', 'cammc', 'warp']);
  // All evaluated submetrics are required; missing scores never change weights.
  const aggregationExclusions = new Set();
  const aggregationRule = 'Category = mean of its normalized submetrics; Overall = equal-weight mean of categories in this setting. Temporal quality = mean of normalized Warp and Smoothness where evaluated; no rounding before averaging.';
  const coreMetrics = {
    verified: ['iou', 'gisr', 'glra', 'cammc', 'img', 'aes', 'smooth', 'clip'],
    unverified: ['iou', 'gisr', 'glra', 'cammc', 'img', 'aes', 'smooth', 'clip'],
    'long-horizon': ['iou', 'gisr', 'glra', 're_iou', 're_state', 'rot', 'trans', 'cammc'],
    'multi-view': ['iou', 'miss', 'gisr', 'glra', 'comp', 'cons', 'met3r', 'cammc'],
    gunfight: ['iou', 'gisr', 'glra', 'cammc', 'img', 'aes', 'smooth', 'clip']
  };
  const clip = (x, min, max) => Math.min(max, Math.max(min, x));

  function normalize(id, value) {
    if (!Number.isFinite(value) || !definitions[id]) return null;
    if (id !== 'clip' && value < 0) return null;
    let score;
    if (percentage.has(id)) score = 100 * value;
    else if (reciprocal.has(id)) score = 100 / (1 + value);
    else if (id === 'rot') score = 100 / (1 + Math.PI * value / 180);
    else if (id === 'miss') score = 100 * (1 - value);
    else if (id === 'met3r') score = 100 * (1 - value / 2);
    else if (id === 'warp') {
      // Local evaluator: mean RGB squared error in [0,1], reported ×1000.
      score = 100 * (1 - Math.sqrt(value / 1000));
    } else score = value;
    return clip(score, 0, 100);
  }

  function categoryIds(split) {
    return [...new Set(split.metric_ids.map(metricGroup))];
  }
  function categoryMetricIds(split, group) {
    return split.metric_ids.filter(id => metricGroup(id) === group && !aggregationExclusions.has(id));
  }
  function mean(values) {
    if (!values.length || values.some(value => !Number.isFinite(value))) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }
  function categoryScore(row, group, split) {
    if (!split) return null;
    return mean(categoryMetricIds(split, group).map(id => normalize(id, row.metrics[id])));
  }
  function overallScore(row, split) {
    if (!split) return null;
    return mean(categoryIds(split).map(group => categoryScore(row, group, split)));
  }
  function isAggregate(id) {
    return id === 'overall' || (id.startsWith('group_') && Object.hasOwn(groups, id.slice(6)));
  }
  function valueFor(row, id, mode, split) {
    if (id === 'overall') return overallScore(row, split);
    if (isAggregate(id)) return categoryScore(row, id.slice(6), split);
    const raw = row.metrics[id];
    return mode === 'raw' ? (Number.isFinite(raw) ? raw : null) : normalize(id, raw);
  }
  function directionFor(id, mode, metrics) {
    return mode === 'raw' && !isAggregate(id) ? metrics[id].direction : 'higher';
  }
  function metricLabel(id, mode, metrics) {
    if (id === 'overall') return 'Overall';
    if (isAggregate(id)) return groups[id.slice(6)];
    return mode === 'raw' ? metrics[id].short_name : definitions[id][0];
  }
  function formatValue(row, id, mode, metrics, split) {
    const value = valueFor(row, id, mode, split);
    if (value === null) return '—';
    if (isAggregate(id)) return value.toFixed(2);
    if (mode === 'raw' && row.paper_values && row.paper_values[id] !== undefined) return row.paper_values[id];
    return value.toFixed(mode === 'raw' ? metrics[id].paper_decimal_places : 1);
  }
  function reportedValue(row, id) {
    return row.raw_values?.[id] ?? row.paper_values?.[id] ?? '';
  }
  function visibleMetrics(split, view) {
    if (view === 'groups') return categoryIds(split).map(group => 'group_' + group);
    if (view === 'core') return coreMetrics[split.id];
    if (view === 'all') return split.metric_ids;
    return split.metric_ids.filter(id => view === 'visual'
      ? ['quality', 'temporal', 'text'].includes(metricGroup(id)) : metricGroup(id) === view);
  }
  function metricGroup(id) {
    if (['iou', 'cerr', 'miss'].includes(id)) return 'entity';
    if (['isr', 'lra', 'gisr', 'glra'].includes(id)) return 'logic';
    if (['rot', 'trans', 'cammc'].includes(id)) return 'camera';
    if (['img', 'aes'].includes(id)) return 'quality';
    if (['warp', 'smooth'].includes(id)) return 'temporal';
    if (['re_iou', 're_state'].includes(id)) return 'memory';
    if (['comp', 'cons', 'met3r'].includes(id)) return 'appearance';
    return 'text';
  }
  function filterRows(rows, family, query, selected) {
    const term = query.trim().toLowerCase();
    return rows.filter(row => (family === 'all' || row.family === family)
      && (!term || [row.model_name, row.paper_model_name, row.source?.method, row.source?.representation].filter(Boolean).join(' ').toLowerCase().includes(term))
      && (!selected || selected.has(row.model_id)));
  }
  function sortRows(rows, id, mode, order, metrics, split) {
    return rows.slice().sort((a, b) => {
      if (id === 'model') return a.model_name.localeCompare(b.model_name) * (order === 'asc' ? 1 : -1);
      const av = valueFor(a, id, mode, split), bv = valueFor(b, id, mode, split);
      if (av === null && bv === null) return a.model_name.localeCompare(b.model_name);
      if (av === null) return 1;
      if (bv === null) return -1;
      return (av - bv) * (order === 'asc' ? 1 : -1) || a.model_name.localeCompare(b.model_name);
    });
  }
  function rankFor(row, rows, id, mode, metrics, split) {
    if (id === 'model') return null;
    const value = valueFor(row, id, mode, split);
    if (value === null) return null;
    const higher = directionFor(id, mode, metrics) === 'higher';
    return 1 + rows.filter(other => {
      const v = valueFor(other, id, mode, split);
      return v !== null && (higher ? v - value : value - v) > 1e-9;
    }).length;
  }
  function highlightFor(row, rows, id, mode, metrics, split) {
    const value = valueFor(row, id, mode, split);
    if (value === null) return '';
    const values = [...new Set(rows.map(other => valueFor(other, id, mode, split)).filter(v => v !== null))];
    values.sort((a, b) => (a - b) * (directionFor(id, mode, metrics) === 'higher' ? -1 : 1));
    if (Math.abs(value - values[0]) < 1e-9) return 'lb-best';
    if (values.length > 1 && Math.abs(value - values[1]) < 1e-9) return 'lb-second';
    return '';
  }
  function csvCell(value) {
    let text = value === null || value === undefined ? '' : String(value);
    if (/^[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }
  function exportCsv(rows, ids, split, mode, sortId, metrics) {
    const headers = ['Setting', 'Model', 'Family', 'Inputs', 'Rank metric', 'Rank in setting', 'Score basis', 'Aggregation rule'];
    ids.forEach(id => {
      if (isAggregate(id)) {
        headers.push(metricLabel(id, mode, metrics) + (id === 'overall' ? ' [0–100 mean of categories]' : ' [0–100 category mean]'));
        return;
      }
      const name = mode !== 'raw' && id === 'miss' ? 'Detection (1 − BBox Miss Rate)' : metrics[id].name;
      headers.push(name + (mode === 'raw' ? ' [' + metrics[id].paper_unit + ']' : ' [0–100 display]'));
      if (mode !== 'raw') headers.push(metrics[id].name + ' [reported raw]');
    });
    headers.push('Source file', 'Source line');
    const records = rows.map(row => {
      const values = [split.name, row.model_name, families[row.family], row.inputs.join(' + ') + ' + text',
        sortId === 'model' ? '' : metricLabel(sortId, mode, metrics), rankFor(row, split.rows, sortId, mode, metrics, split),
        mode === 'raw' && !ids.some(isAggregate) ? 'Reported model mean' : 'Display transformation of reported model mean; not a per-sample recomputation', aggregationRule];
      ids.forEach(id => {
        values.push(valueFor(row, id, mode, split) === null ? ''
          : mode === 'raw' && !isAggregate(id) ? reportedValue(row, id) : formatValue(row, id, mode, metrics, split));
        if (mode !== 'raw' && !isAggregate(id)) values.push(reportedValue(row, id));
      });
      values.push(row.source.file, row.source.line);
      return values;
    });
    return '\uFEFF' + [headers, ...records].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
  }
  return { groups, families, definitions, nonlinear, aggregationExclusions, aggregationRule,
    categoryIds, categoryMetricIds, categoryScore, overallScore, isAggregate, normalize, valueFor, directionFor, metricLabel,
    formatValue, reportedValue, visibleMetrics, filterRows, sortRows, rankFor, highlightFor, exportCsv };
});
