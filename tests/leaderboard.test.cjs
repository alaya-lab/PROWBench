const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../leaderboard-core.js');
const data = require('../assets/leaderboard-data.js');
const split = id => data.splits.find(s => s.id === id);
const row = (s, m) => split(s).rows.find(r => r.model_id === m);
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, actual + ' != ' + expected);

test('source snapshot contains the active tables, with original printed precision', () => {
  assert.equal(data.splits.length, 5);
  assert.equal(Object.keys(data.models).length, 11);
  assert.equal(Object.keys(data.metrics).length, 20);
  assert.deepEqual(data.splits.map(s => s.rows.length), [10, 10, 5, 5, 5]);
  assert.equal(data.splits.flatMap(s => s.rows).reduce((n, r) => n + Object.keys(r.metrics).length, 0), 470);
  // These cells distinguish the supplied active table from older commented/PDF revisions.
  assert.equal(row('verified', 'echowm').metrics.iou, 0.354);
  assert.equal(row('verified', 'minimax-h3').metrics.gisr, 0.330);
  assert.equal(row('verified', 'seedance-2.5').metrics.lra, 0.832);
  assert.equal(row('verified', 'echowm').paper_values.lra, '0.680');
  assert.equal(row('gunfight', 'pwm').metrics.gisr, 0.523);
  for (const s of data.splits) for (const r of s.rows) {
    assert.ok(data.models[r.model_id]);
    assert.deepEqual(Object.keys(r.metrics), s.metric_ids);
    assert.ok(r.source.line > 0);
    for (const id of s.metric_ids) {
      assert.equal(Number(core.reportedValue(r, id)), r.metrics[id]);
      assert.ok(core.definitions[id]);
    }
  }
});

test('WBENCH overlaps preserve the existing units exactly', () => {
  close(core.normalize('aes', 0.609), 60.9);
  close(core.normalize('img', 68.1), 68.1);
  close(core.normalize('smooth', 0.987), 98.7);
  close(core.normalize('clip', 25.2), 25.2);
  assert.equal(core.normalize('clip', -2), 0);
});

test('non-overlap transforms are fixed, bounded and explicit about radians', () => {
  close(core.normalize('rot', 180 / Math.PI), 50);
  close(core.normalize('trans', 1), 50);
  close(core.normalize('cammc', 0.25), 80);
  close(core.normalize('cerr', 0.25), 80);
  close(core.normalize('met3r', 0.397), 80.15);
  close(core.normalize('miss', 0.192), 80.8);
  for (const id of ['cerr', 'rot', 'trans', 'cammc']) {
    assert.equal(core.normalize(id, 0), 100);
    assert.ok(core.normalize(id, 0.1) > core.normalize(id, 1));
  }
  for (const s of data.splits) for (const r of s.rows) for (const id of s.metric_ids) {
    const value = core.normalize(id, r.metrics[id]);
    assert.ok(Number.isFinite(value) && value >= 0 && value <= 100);
  }
});

test('Warp uses the reported x1000 MSE units and missing data cannot become perfect scores', () => {
  for (const id of ['iou', 'warp']) {
    for (const x of [null, undefined, NaN, Infinity, -1, true, false, '0.647'])
      assert.equal(core.normalize(id, x), null);
  }
  // Reported 2.5 means MSE 0.0025, hence normalized RMSE 0.05 and score 95.
  close(core.normalize('warp', 2.5), 95);
  close(core.normalize('warp', 250), 50);
  close(core.normalize('warp', 0.647), 97.45638053160461);
  assert.equal(core.normalize('warp', 0), 100);
  assert.equal(core.normalize('warp', 1000), 0);
  assert.equal(core.normalize('warp', 1001), 0);
  assert.ok(core.nonlinear.has('warp'));
});

test('gISR uses its published per-sample-product mean, not a product of means', () => {
  const r = row('verified', 'echowm');
  close(core.valueFor(r, 'gisr', 'normalized'), 17);
  assert.notEqual(core.valueFor(r, 'gisr', 'normalized'), r.metrics.iou * r.metrics.isr * 100);
});

test('each setting ranks independently and lower raw errors sort correctly', () => {
  const s = split('verified');
  const rawOrder = core.sortRows(s.rows, 'cammc', 'raw', 'asc', data.metrics);
  const displayOrder = core.sortRows(s.rows, 'cammc', 'normalized', 'desc', data.metrics);
  assert.deepEqual(rawOrder.map(r => r.model_id), displayOrder.map(r => r.model_id));
  assert.equal(rawOrder[0].model_id, 'lynnreal-omni');
  const rawWarp = core.sortRows(s.rows, 'warp', 'raw', 'asc', data.metrics);
  const normalizedWarp = core.sortRows(s.rows, 'warp', 'normalized', 'desc', data.metrics);
  assert.deepEqual(rawWarp.map(r => r.model_id), normalizedWarp.map(r => r.model_id));
  assert.equal(normalizedWarp[0].model_id, 'seedance-2.5');
  assert.equal(core.rankFor(row('gunfight', 'pwm'), split('gunfight').rows, 'iou', 'raw', data.metrics), 1);
  const a = row('verified', 'lynnreal-omni'), b = row('verified', 'seedance-2.5'), c = row('verified', 'lingbot-2.0');
  assert.equal(core.rankFor(a, s.rows, 'lra', 'raw', data.metrics), 1);
  assert.equal(core.rankFor(b, s.rows, 'lra', 'raw', data.metrics), 1);
  assert.equal(core.rankFor(c, s.rows, 'lra', 'raw', data.metrics), 3);
  assert.equal(core.highlightFor(c, s.rows, 'lra', 'raw', data.metrics), 'lb-second');
});

test('filters preserve aliases and absent families; core views fit the chosen setting', () => {
  assert.equal(core.filterRows(split('verified').rows, 'camera', '', null).length, 4);
  assert.equal(core.filterRows(split('multi-view').rows, 'camera', '', null).length, 0);
  assert.equal(core.filterRows(split('verified').rows, 'all', 'COSMOS 2.5', null)[0].model_id, 'cosmos-transfer2.5');
  assert.equal(core.filterRows(split('verified').rows, 'all', 'not-a-model', null).length, 0);
  assert.equal(core.filterRows(split('verified').rows, 'all', '', new Set(['cwm', 'c2r'])).length, 2);
  for (const s of data.splits) for (const id of core.visibleMetrics(s, 'core')) assert.ok(s.metric_ids.includes(id));
});

test('CSV retains raw precision, normalized Warp, the source, and score-basis disclosure', () => {
  const s = split('verified'), r = row('verified', 'echowm');
  const csv = core.exportCsv([r], ['iou', 'warp'], s, 'normalized', 'iou', data.metrics);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"35.4","0.354","97.5","0.647"'));
  const missingWarp = { ...r, metrics: { ...r.metrics, warp: null } };
  assert.ok(core.exportCsv([missingWarp], ['warp'], s, 'normalized', 'warp', data.metrics).includes('"","0.647"'));
  assert.ok(csv.includes('not a per-sample recomputation'));
  assert.ok(csv.includes('"sec/04.experiments.tex","518"'));
  const special = { ...r, model_name: '=SUM(1,2)"test' };
  assert.ok(core.exportCsv([special], ['iou'], s, 'raw', 'iou', data.metrics).includes("'=SUM(1,2)"));
  const multi = split('multi-view');
  const detection = core.exportCsv(multi.rows, ['miss'], multi, 'normalized', 'miss', data.metrics);
  assert.ok(detection.includes('"Detection (1 − BBox Miss Rate) [0–100 display]"'));
  assert.ok(detection.includes('"BBox Miss Rate [reported raw]"'));
  assert.ok(detection.includes('"Detection"'));
});

test('Overall gives equal weight to categories after normalizing and averaging their submetrics', () => {
  const s = { metric_ids: ['iou', 'cerr', 'isr', 'lra', 'gisr', 'glra'] };
  const r = { metrics: { iou: 0.2, cerr: 1, isr: 0.8, lra: 0.6, gisr: 0.4, glra: 0.2 } };
  // Entity: (20 + 50) / 2 = 35; Logic: (80 + 60 + 40 + 20) / 4 = 50.
  close(core.categoryScore(r, 'entity', s), 35);
  close(core.categoryScore(r, 'logic', s), 50);
  close(core.overallScore(r, s), 42.5);
  assert.notEqual(core.overallScore(r, s), (20 + 50 + 80 + 60 + 40 + 20) / 6);
  close(core.valueFor(r, 'overall', 'raw', s), 42.5);
  close(core.valueFor(r, 'group_entity', 'raw', s), 35);
  assert.equal(core.directionFor('overall', 'raw', data.metrics), 'higher');
  assert.equal(core.formatValue(r, 'overall', 'raw', data.metrics, s), '42.50');
});

test('Warp and Smoothness share Temporal quality equally and missing scores do not change weights', () => {
  const s = { metric_ids: ['warp', 'smooth', 'iou', 'cerr'] };
  const r = { metrics: { warp: 250, smooth: 0.8, iou: 0.2, cerr: 1 } };
  // Warp = 50; Smoothness = 80; Temporal = 65; Entity = 35; Overall = 50.
  assert.deepEqual(core.categoryMetricIds(s, 'temporal'), ['warp', 'smooth']);
  close(core.categoryScore(r, 'temporal', s), 65);
  close(core.overallScore(r, s), 50);
  const perfectWarp = { metrics: { ...r.metrics, warp: 0 } };
  close(core.categoryScore(perfectWarp, 'temporal', s), 90);
  close(core.overallScore(perfectWarp, s), 62.5);
  for (const warp of [undefined, null, NaN, -1]) {
    const missing = { metrics: { ...r.metrics, warp } };
    assert.equal(core.categoryScore(missing, 'temporal', s), null);
    assert.equal(core.overallScore(missing, s), null);
  }
  assert.equal(core.overallScore({ metrics: { ...r.metrics, smooth: null } }, s), null);
  const missing = { metrics: { ...r.metrics, cerr: null } };
  assert.equal(core.categoryScore(missing, 'entity', s), null);
  assert.equal(core.overallScore(missing, s), null);
  assert.equal(core.overallScore({ metrics: {} }, { metric_ids: [] }), null);
});

test('category composition uses all metrics in each setting independently of the visible subset', () => {
  assert.deepEqual(data.splits.map(s => core.categoryIds(s).length), [6, 6, 4, 4, 6]);
  const s = split('verified'), r = row('verified', 'echowm');
  assert.deepEqual(core.categoryMetricIds(s, 'entity'), ['iou', 'cerr']);
  assert.deepEqual(core.categoryMetricIds(s, 'logic'), ['isr', 'lra', 'gisr', 'glra']);
  assert.ok(!core.visibleMetrics(s, 'core').includes('cerr'));
  close(core.categoryScore(r, 'entity', s), (35.4 + 100 / (1 + r.metrics.cerr)) / 2);
  for (const setting of data.splits) {
    assert.deepEqual(core.visibleMetrics(setting, 'groups'), core.categoryIds(setting).map(id => 'group_' + id));
    for (const model of setting.rows) {
      const score = core.overallScore(model, setting);
      assert.ok(Number.isFinite(score) && score >= 0 && score <= 100);
      close(core.valueFor(model, 'overall', 'normalized', setting), core.valueFor(model, 'overall', 'raw', setting));
    }
  }
  const sorted = core.sortRows(s.rows, 'overall', 'normalized', 'desc', data.metrics, s);
  assert.deepEqual(sorted.map(r => r.model_id), core.sortRows(s.rows, 'overall', 'raw', 'desc', data.metrics, s).map(r => r.model_id));
  assert.equal(core.formatValue(sorted[0], 'overall', 'normalized', data.metrics, s), '68.91');
  const selected = core.filterRows(s.rows, 'camera', 'echo', null);
  assert.equal(core.rankFor(selected[0], s.rows, 'overall', 'normalized', data.metrics, s), 6);
});

test('aggregate averages and ranks use full precision before display rounding', () => {
  const s = { metric_ids: ['iou', 'cerr'] };
  const a = { model_name: 'A', metrics: { iou: 0.12344, cerr: 1 } };
  const b = { model_name: 'B', metrics: { iou: 0.12345, cerr: 1 } };
  const rows = [a, b];
  close(core.overallScore(a, s), 31.172);
  close(core.overallScore(b, s), 31.1725);
  assert.equal(core.formatValue(a, 'overall', 'normalized', data.metrics, s), core.formatValue(b, 'overall', 'normalized', data.metrics, s));
  assert.equal(core.rankFor(b, rows, 'overall', 'normalized', data.metrics, s), 1);
  assert.equal(core.rankFor(a, rows, 'overall', 'normalized', data.metrics, s), 2);
  assert.equal(core.highlightFor(b, rows, 'overall', 'normalized', data.metrics, s), 'lb-best');
  assert.equal(core.highlightFor(a, rows, 'overall', 'normalized', data.metrics, s), 'lb-second');
  assert.equal(core.sortRows(rows, 'overall', 'normalized', 'desc', data.metrics, s)[0], b);
});

test('CSV identifies derived aggregates and preserves their units in raw mode', () => {
  const s = split('verified'), r = row('verified', 'lynnreal-omni');
  const ids = ['overall', ...core.visibleMetrics(s, 'groups')];
  const csv = core.exportCsv([r], ids, s, 'raw', 'overall', data.metrics);
  assert.ok(csv.includes('"Overall [0–100 mean of categories]"'));
  assert.ok(csv.includes('"Entity control [0–100 category mean]"'));
  assert.ok(csv.includes('"Overall","1"'));
  assert.ok(csv.includes('"68.91"'));
  assert.ok(csv.includes('Temporal quality = mean of normalized Warp and Smoothness'));
  assert.ok(csv.includes('not a per-sample recomputation'));
  assert.ok(!csv.includes('undefined'));
});

