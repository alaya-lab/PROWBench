"""Validate the Python export against the website's normalization and ranking."""
import importlib.util
import json
import math
from pathlib import Path
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("normalize_metrics", ROOT / "scripts/normalize_metrics.py")
normalizer = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(normalizer)


class NormalizationTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = normalizer.load_data(ROOT / "assets/leaderboard-data.js")

    def test_units_and_direction(self):
        samples = {
            "iou": (0.354, 35.4), "cerr": (0.25, 80),
            "isr": (0.5, 50), "lra": (0.680, 68),
            "gisr": (0.170, 17), "glra": (0.242, 24.2),
            "rot": (180 / math.pi, 50), "trans": (1, 50), "cammc": (0.25, 80),
            "img": (68.1, 68.1), "aes": (0.609, 60.9), "warp": (0.647, 97.45638053160461),
            "smooth": (0.987, 98.7), "clip": (25.2, 25.2),
            "re_iou": (0.25, 25), "re_state": (0.8, 80), "miss": (0.192, 80.8),
            "comp": (83.4, 83.4), "cons": (75.8, 75.8), "met3r": (0.397, 80.15),
        }
        self.assertEqual(set(samples), set(normalizer.RULES))
        for metric, (value, expected) in samples.items():
            with self.subTest(metric=metric):
                actual = normalizer.normalize_metric(metric, value)
                if expected is None:
                    self.assertIsNone(actual)
                else:
                    self.assertAlmostEqual(actual, expected, places=10)

    def test_invalid_values_are_not_perfect_scores(self):
        for value in [None, True, False, "0.5", float("nan"), float("inf"), -1]:
            self.assertIsNone(normalizer.normalize_metric("cerr", value))
            self.assertIsNone(normalizer.normalize_metric("warp", value))
        self.assertEqual(normalizer.normalize_metric("clip", -3), 0)
        self.assertEqual(normalizer.normalize_metric("img", 110), 100)
        self.assertEqual(normalizer.normalize_metric("met3r", 2), 0)
        with self.assertRaises(ValueError):
            normalizer.normalize_metric("typo", 0.5)

    def test_two_level_average_and_missing_values(self):
        ids = ["iou", "cerr", "isr", "lra", "gisr", "glra"]
        row = {"metrics": {"iou": 0.2, "cerr": 1, "isr": 0.8, "lra": 0.6, "gisr": 0.4, "glra": 0.2}}
        score = normalizer.normalize_row(row, ids)
        self.assertEqual(score["category_scores"], {"entity": 35, "logic": 50})
        self.assertEqual(score["overall_score"], 42.5)
        self.assertNotEqual(score["overall_score"], (20 + 50 + 80 + 60 + 40 + 20) / 6)
        row["metrics"]["cerr"] = None
        self.assertIsNone(normalizer.normalize_row(row, ids)["overall_score"])

    def test_warp_units_aggregation_and_missing_values(self):
        for value, expected in [(0, 100), (2.5, 95), (250, 50), (1000, 0), (1001, 0)]:
            self.assertEqual(normalizer.normalize_metric("warp", value), expected)
        ids = ["warp", "smooth", "iou", "cerr"]
        row = {"metrics": {"warp": 250, "smooth": 0.8, "iou": 0.2, "cerr": 1}}
        result = normalizer.normalize_row(row, ids)
        self.assertEqual(result["category_scores"], {"temporal": 65, "entity": 35})
        self.assertEqual(result["overall_score"], 50)
        row["metrics"]["warp"] = 0
        self.assertEqual(normalizer.normalize_row(row, ids)["overall_score"], 62.5)
        for value in [None, float("nan"), -1]:
            row["metrics"]["warp"] = value
            result = normalizer.normalize_row(row, ids)
            self.assertIsNone(result["category_scores"]["temporal"])
            self.assertIsNone(result["overall_score"])

    def test_json_and_js_input_are_equivalent(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "input.json"
            path.write_text(json.dumps(self.data), encoding="utf-8")
            self.assertEqual(normalizer.load_data(path), self.data)

    def test_full_snapshot_matches_browser_implementation(self):
        # Cross-language check: the site's JS is the current source of scoring behavior.
        reference_js = """
          const data = require('./assets/leaderboard-data.js');
          const core = require('./leaderboard-core.js');
          console.log(JSON.stringify(data.splits.map(split => ({
            id: split.id,
            rows: split.rows.map(row => ({
              model_id: row.model_id,
              normalized_metrics: Object.fromEntries(split.metric_ids.map(id => [id, core.normalize(id, row.metrics[id])])),
              category_scores: Object.fromEntries(core.categoryIds(split).map(group => [group, core.categoryScore(row, group, split)])),
              overall_score: core.overallScore(row, split),
              overall_rank: core.rankFor(row, split.rows, 'overall', 'normalized', data.metrics, split)
            }))
          }))));
        """
        reference = json.loads(subprocess.run(["node", "-e", reference_js], cwd=ROOT, check=True,
                                             capture_output=True, text=True).stdout)
        exported = normalizer.normalize_dataset(self.data)
        self.assertEqual(exported["normalization"]["excluded_metrics"], [])
        cells = categories = models = 0
        for actual_split, expected_split in zip(exported["splits"], reference):
            self.assertEqual(actual_split["id"], expected_split["id"])
            expected_rows = {row["model_id"]: row for row in expected_split["rows"]}
            for actual in actual_split["rows"]:
                expected = expected_rows[actual["model_id"]]
                models += 1
                for key in ["normalized_metrics", "category_scores"]:
                    self.assertEqual(set(actual[key]), set(expected[key]))
                    for metric, value in actual[key].items():
                        if key == "normalized_metrics":
                            cells += 1
                        else:
                            categories += 1
                        self.assertIsNotNone(value)
                        self.assertAlmostEqual(value, expected[key][metric], places=10)
                self.assertAlmostEqual(actual["overall_score"], expected["overall_score"], places=10)
                self.assertEqual(actual["overall_rank"], expected["overall_rank"])
        self.assertEqual((models, cells, categories), (35, 470, 190))


if __name__ == "__main__":
    unittest.main()
