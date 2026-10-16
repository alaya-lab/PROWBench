"""Extract active benchmark tables from the user-supplied PROWBench paper archive.

This intentionally ignores commented LaTeX and preserves printed precision.
"""
from pathlib import Path
from zipfile import ZipFile
import hashlib
import argparse
import json
import re

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('archive', type=Path, help='Supplied PROWBench.zip manuscript revision')
parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1] / 'assets/leaderboard-data.js')
args = parser.parse_args()
ARCHIVE, OUT = args.archive, args.output
EXP = 'sec/04.experiments.tex'
SUPP = 'sec/07.supp.tex'
METHOD = 'sec/03.method.tex'
with ZipFile(ARCHIVE) as archive:
    source_bytes = {name: archive.read('PROWBench/' + name) for name in (EXP, SUPP, METHOD)}
expected_hash = '48c0f2fe7be017e2798fbbaad5247c07299acbbee39011d3d721bb97ad9fc161'
if hashlib.sha256(source_bytes[EXP]).hexdigest() != expected_hash:
    raise SystemExit('Manuscript revision changed. Re-audit the active table row ranges before importing.')
lines = source_bytes[EXP].decode().splitlines()

def source(file, line, end_line=None, label=None):
    result = {'file': file, 'line': line}
    if end_line is not None:
        result['end_line'] = end_line
    if label is not None:
        result['table_label'] = label
    return result

models = {
    'EchoWM': {'id': 'echowm', 'name': 'EchoWM', 'family': 'camera', 'configuration': 'Base checkpoint', 'spec_line': 381},
    'SANA-WM': {'id': 'sana-wm', 'name': 'SANA-WM', 'family': 'camera', 'configuration': 'Bidirectional checkpoint', 'spec_line': 382},
    'LingBot 2.0': {'id': 'lingbot-2.0', 'name': 'LingBot-World 2.0', 'family': 'camera', 'configuration': 'Bidirectional checkpoint', 'spec_line': 383},
    'AlayaWorld v1.1': {'id': 'alayaworld-v1.1', 'name': 'AlayaWorld v1.1', 'family': 'camera', 'configuration': 'Camera-controlled Stage2b AR teacher with Stage3 DMD adapter; 4 denoising steps per rollout round', 'spec_line': 384},
    'Cosmos 2.5': {'id': 'cosmos-transfer2.5', 'name': 'Cosmos-Transfer2.5', 'family': 'renderer', 'spec_line': 387},
    'C2R': {'id': 'c2r', 'name': 'C2R', 'family': 'renderer', 'spec_line': 388},
    'CWM': {'id': 'cwm', 'name': 'CWM', 'full_name': 'Code World Model', 'family': 'renderer', 'spec_line': 389},
    'PWM': {'id': 'pwm', 'name': 'PWM', 'family': 'renderer', 'domain': 'Gunfight only', 'spec_line': 390},
    'LynnReal-Omni': {'id': 'lynnreal-omni', 'name': 'LynnReal-Omni', 'family': 'renderer', 'spec_line': 391},
    'MiniMax-H3': {'id': 'minimax-h3', 'name': 'MiniMax-H3', 'family': 'general', 'spec_line': 394},
    'Seedance 2.5': {'id': 'seedance-2.5', 'name': 'Seedance 2.5', 'family': 'general', 'spec_line': 395},
}
for paper_name, model in models.items():
    model['paper_name'] = paper_name
    model['family_source'] = source(EXP, 846 if paper_name == 'PWM' else 853)
    model['spec_source'] = source(SUPP, model.pop('spec_line'))
    if 'configuration' in model:
        model['configuration_source'] = source(SUPP, 362)

metric_specs = [
    ('iou', 'BBox IoU', 'IoU', 'higher', 'entity', 'ratio', 3, SUPP, 269),
    ('cerr', 'Center Error', 'CErr', 'lower', 'entity', 'image-diagonal-normalized distance', 3, SUPP, 270),
    ('isr', 'Interaction Success Rate', 'ISR', 'higher', 'logic', 'ratio', 3, METHOD, 187),
    ('lra', 'Logic-Render Alignment', 'LRA', 'higher', 'logic', 'ratio', 3, METHOD, 195),
    ('gisr', 'IoU-weighted Interaction Success Rate', 'gISR', 'higher', 'logic', 'ratio', 3, METHOD, 189),
    ('glra', 'IoU-weighted Logic-Render Alignment', 'gLRA', 'higher', 'logic', 'ratio', 3, METHOD, 205),
    ('rot', 'Camera Rotation Error', 'RotErr', 'lower', 'camera', 'degrees', 1, SUPP, 281),
    ('trans', 'Camera Translation Error', 'TransErr', 'lower', 'camera', 'normalized trajectory distance', 3, SUPP, 282),
    ('cammc', 'Camera Motion Control', 'CamMC', 'lower', 'camera', 'normalized pose matrix distance', 3, SUPP, 283),
    ('img', 'Imaging Quality', 'Img', 'higher', 'quality', 'MUSIQ score', 1, SUPP, 295),
    ('aes', 'Aesthetic Quality', 'Aes', 'higher', 'quality', 'VBench-normalized LAION score', 3, SUPP, 295),
    ('warp', 'Warp Error', 'Warp', 'lower', 'temporal', 'paper table units: 10^-3', 3, SUPP, 295),
    ('smooth', 'Motion Smoothness', 'Smooth', 'higher', 'temporal', 'VBench score', 3, SUPP, 295),
    ('clip', 'CLIP-Score', 'CLIP', 'higher', 'text', '100 times cosine similarity', 1, SUPP, 295),
    ('re_iou', 'Reappearance IoU', 'Re-IoU', 'higher', 'memory', 'ratio', 3, METHOD, 219),
    ('re_state', 'State Persistence', 'Re-State', 'higher', 'memory', 'ratio', 3, METHOD, 219),
    ('miss', 'BBox Miss Rate', 'Miss', 'lower', 'entity', 'ratio', 3, EXP, 804),
    ('comp', 'Appearance Compliance', 'Comp.', 'higher', 'appearance', 'percent', 1, SUPP, 329),
    ('cons', 'Cross-view Appearance Consistency', 'Cons.', 'higher', 'appearance', 'percent', 1, SUPP, 329),
    ('met3r', 'MEt3R', 'MEt3R', 'lower', 'appearance', 'feature distance', 3, SUPP, 344),
]
metrics = {}
for key, name, short, direction, group, unit, digits, file, line in metric_specs:
    metrics[key] = {'name': name, 'short_name': short, 'direction': direction, 'group': group,
                    'paper_unit': unit, 'paper_decimal_places': digits, 'definition_source': source(file, line)}

common_metrics = ['iou', 'cerr', 'isr', 'lra', 'gisr', 'glra', 'rot', 'trans', 'cammc', 'img', 'aes', 'warp', 'smooth', 'clip']
split_specs = [
    {'id': 'verified', 'name': 'Verified-FF', 'track': 'main', 'cases': 40, 'views_per_case': 1, 'clips_per_model': 40,
     'duration_seconds': 5, 'third_person_views': 31, 'first_person_views': 9,
     'source': source(EXP, 493, 549, 'tab:dv200_firstframe'), 'row_range': [518, 529], 'metric_ids': common_metrics,
     'description': '40 five-second scene-camera pairs with a shared first frame checked against the recorded state for methods that accept it.'},
    {'id': 'unverified', 'name': 'Unverified-FF', 'track': 'main', 'cases': 90, 'views_per_case': 1, 'clips_per_model': 90,
     'duration_seconds': 5, 'third_person_views': 78, 'first_person_views': 12,
     'source': source(EXP, 493, 549, 'tab:dv200_nofirstframe'), 'row_range': [533, 547], 'metric_ids': common_metrics,
     'description': '90 five-second pairs from scenes disjoint from Verified-FF. Models requiring an RGB input receive the unchecked frame 0 of MiniMax-H3 for the same scene and camera.'},
    {'id': 'long-horizon', 'name': 'Long-horizon', 'track': 'challenge', 'cases': 10, 'views_per_case': 1, 'clips_per_model': 10,
     'duration_seconds': 30, 'third_person_views': 4, 'first_person_views': 6,
     'source': source(EXP, 767, 784, 'tab:long_horizon'), 'row_range': [777, 782],
     'metric_ids': ['iou', 'cerr', 'isr', 'lra', 'gisr', 'glra', 're_iou', 're_state', 'rot', 'trans', 'cammc'],
     'description': 'Ten 30-second recordings, one camera per recording and one output per method. CWM receives an unchecked MiniMax-H3 first frame.'},
    {'id': 'multi-view', 'name': 'Multi-view', 'track': 'challenge', 'cases': 10, 'views_per_case': 4, 'clips_per_model': 40,
     'duration_seconds': 5, 'third_person_views': 40, 'first_person_views': 0,
     'source': source(EXP, 804, 822, 'tab:multiview_crossview'), 'row_range': [815, 820],
     'metric_ids': ['iou', 'cerr', 'miss', 'isr', 'lra', 'gisr', 'glra', 'comp', 'cons', 'met3r', 'rot', 'trans', 'cammc'],
     'description': 'Ten scenes with four synchronized views each; views are generated independently. CWM receives an unchecked MiniMax-H3 first frame.'},
    {'id': 'gunfight', 'name': 'Gunfight', 'track': 'domain', 'cases': 20, 'source_recordings': 10, 'views_per_case': 1, 'clips_per_model': 20,
     'duration_seconds': 5, 'third_person_views': 20, 'first_person_views': 0,
     'source': source(EXP, 903, 934, 'tab:neon_death'), 'row_range': [927, 932], 'metric_ids': common_metrics,
     'description': 'Twenty armed-confrontation cases derived from ten source recordings, for a comparison with the domain-specific model PWM. First-frame conditioning is provided to methods that accept it.'},
]

def extract_rows(split):
    start, end = split.pop('row_range')
    rows = []
    for index in range(start - 1, end):
        line = lines[index].strip()
        if line.startswith('%') or r'\inp{' not in line:
            continue
        fields = line.split('&')
        assert len(fields) == len(split['metric_ids']) + 2, (index + 1, len(fields))
        paper_name = re.sub(r'~\\citep?\{[^}]*\}', '', fields[0]).strip().replace('~', ' ')
        model = models[paper_name]
        inputs = re.search(r'\\inp\{([^}]+)\}', fields[1]).group(1).split(',')
        raw_strings = {}
        values = {}
        for metric, value in zip(split['metric_ids'], fields[2:]):
            numbers = re.findall(r'(?<![\w])-?\d+\.\d+', value)
            assert len(numbers) == 1, (split['id'], index + 1, metric, value)
            printed = numbers[0]
            assert len(printed.split('.')[1]) == metrics[metric]['paper_decimal_places']
            raw_strings[metric] = printed
            values[metric] = float(printed)
        rows.append({'model_id': model['id'], 'model_name': model['name'], 'paper_model_name': paper_name,
                     'family': model['family'], 'inputs': inputs, 'includes_text_prompt': True,
                     'metrics': values, 'paper_values': raw_strings,
                     'source': source(EXP, index + 1, label=split['source']['table_label'])})
    return rows

for split in split_specs:
    split['rows'] = extract_rows(split)
    split['model_count'] = len(split['rows'])
    split['duration_source'] = source(SUPP, 54)
    split['count_source'] = source(METHOD, 230) if split['track'] == 'main' else source(SUPP, {'long-horizon': 62, 'multi-view': 58, 'gunfight': 60}[split['id']])

data = {
    'schema_version': 1,
    'title': 'PROWBench paper leaderboard results',
    'provenance': {
        'archive': ARCHIVE.name,
        'archive_sha256': hashlib.sha256(ARCHIVE.read_bytes()).hexdigest(),
        'source_root_in_archive': 'PROWBench/',
        'source_file_sha256': {key: hashlib.sha256(value).hexdigest() for key, value in source_bytes.items()},
        'extraction': 'Only active (non-commented) LaTeX table rows were extracted. Raw strings preserve every printed decimal place. No normalized values or aggregate ranks are asserted by this file.',
        'extraction_script': 'scripts/import-leaderboard.py',
    },
    'input_legend': {
        'FF': 'First frame (checked against the recorded state in Verified-FF; also the label used for Gunfight first frames)',
        'UFF': 'Unchecked first frame: frame 0 of the MiniMax-H3 output for the same scene and camera',
        'C': 'Camera pose', 'D': 'Depth', 'CS': 'Class-level segmentation',
        'M': 'CWM proxy', 'P': 'Coarse 3D proxy', 'B': 'Colored-OBB proxy',
    },
    'families': {
        'camera': {'name': 'Camera-conditioned world models', 'source': source(EXP, 853)},
        'renderer': {'name': 'Task-specific renderers', 'source': source(EXP, 846)},
        'general': {'name': 'General-purpose video models', 'source': source(EXP, 853)},
    },
    'models': {model['id']: model for model in models.values()},
    'metrics': metrics,
    'splits': split_specs,
    'counts': {'splits': len(split_specs), 'distinct_models': len(models),
               'model_setting_rows': sum(len(s['rows']) for s in split_specs),
               'reported_metric_cells': sum(len(r['metrics']) for s in split_specs for r in s['rows']),
               'distinct_metrics': len(metrics)},
    'limitations': [
        {'id': 'aggregates-only', 'detail': 'The supplied archive contains paper table means, not per-sample evaluation results. Nonlinear f(mean(x)) is only a display conversion of reported means, not mean(f(x)); do not describe it as a recomputed benchmark score.'},
        {'id': 'disjoint-settings', 'detail': 'Verified-FF and Unverified-FF use different scenes and different counts. Compare and rank models within each setting; do not imply a paired first-frame ablation.', 'source': source(EXP, 493)},
        {'id': 'overlapping-metrics', 'detail': 'gISR and gLRA are computed by multiplying ISR/LRA and IoU per sample before averaging. Their published means must not be replaced by products of published mean ISR/LRA and IoU.', 'source': source(METHOD, 189, 209)},
        {'id': 'warp-convention', 'detail': 'Warp is reported in 10^-3 table units. For normalization, the leaderboard interprets these means using the local eval/prowbench_eval/metric_temporal.py convention: pixel differences divided by 255, squared and averaged across RGB channels and unoccluded pixels, averaged over frame pairs, then reported times 1000. The manuscript archive itself does not contain this evaluator implementation.', 'source': source(SUPP, 295)},
        {'id': 'conditional-appearance', 'detail': 'Appearance Compliance and Consistency exclude absent targets or observations with no judgeable attributes. They are percentages conditioned on judgeability and must be read with BBox Miss Rate.', 'source': source(SUPP, 329, 334)},
        {'id': 'conditional-center', 'detail': 'Center Error is conditional on detections; missing boxes contribute zero IoU but are not included in Center Error.', 'source': source(SUPP, 273, 275)},
        {'id': 'model-name-aliases', 'detail': "The main tables abbreviate Cosmos-Transfer2.5 as 'Cosmos 2.5' and LingBot-World 2.0 as 'LingBot 2.0'. Both names are retained, with canonical names from the active method-specification table.", 'source': source(SUPP, 383, 387)},
        {'id': 'small-challenges', 'detail': 'Long-horizon and Multi-view each have only ten cases/scenes. Gunfight has 20 cases derived from ten source recordings; the 20 cases should not be described as 20 independent recordings.', 'source': source(SUPP, 58, 60)},
        {'id': 'unequal-inputs', 'detail': 'Methods receive the controls supported by their native interface; several methods receive different first-frame inputs across settings. Input badges should remain visible.', 'source': source(EXP, 454)},
        {'id': 'source-not-ready-for-eval', 'detail': 'The archive is LaTeX source with revisions and commented-out older tables; no evaluation code, uncertainty estimates for these table cells, or authoritative overall leaderboard score is supplied.'},
        {'id': 'excluded-ablation', 'detail': 'The active MiniMax-H3 proxy-representation ablation at sec/04.experiments.tex:983-997 covers a ten-pair Verified-FF subset. It is not included as a separate comparable model leaderboard setting.'},
        {'id': 'estimator-bias', 'detail': 'Paper limitations include uncalibrated VLM judgments, pose-estimation errors, MiniMax-H3-based curation/first frames, and small challenge sets.', 'source': source(EXP, 1036)},
    ],
}
assert [s['model_count'] for s in split_specs] == [10, 10, 5, 5, 5]
assert data['counts']['reported_metric_cells'] == 470
data['provenance']['source_note'] = 'Values follow active tables in the supplied PROWBench.zip manuscript. Some Verified-FF values differ from the PDF currently bundled with the project website.'
payload = json.dumps(data, indent=2, ensure_ascii=False)
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text('// Generated by scripts/import-leaderboard.py; edit the importer, not these results.\n(function (root) {\n  const data = ' + payload + ';\n  if (typeof module === \"object\" && module.exports) module.exports = data;\n  else root.PROWLeaderboardData = data;\n})(typeof globalThis !== \"undefined\" ? globalThis : this);\n')
print(json.dumps({'path': str(OUT), 'counts': data['counts'], 'splits': {s['id']: s['model_count'] for s in split_specs}}, indent=2))
