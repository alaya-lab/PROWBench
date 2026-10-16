"""Check the added run against samples and guard against corrupting paper rows."""
import copy
import csv
import hashlib
import importlib.util
from pathlib import Path
import shutil
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
SPEC = importlib.util.spec_from_file_location("import_evaluation", ROOT / "scripts/import-evaluation.py")
importer = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(importer)
MODEL = "streamrender-h3-colored-obb"
NAME = "StreamRender-H3 (colored-OBB)"
SOURCE = ROOT / "assets/evaluations/streamrender_h3_20261012_162252/colored-obb"


class EvaluationImportTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = importer.load_data(ROOT / "assets/leaderboard-data.js")

    def prepare(self, directory=SOURCE, data=None, model=MODEL):
        return importer.prepare_evaluation(data or self.data, directory, model, NAME, "renderer")

    def test_reimport_is_idempotent_and_preserves_paper_rows(self):
        original = copy.deepcopy(self.data)
        imported, run = self.prepare()
        reimported, _ = self.prepare(data=imported)
        self.assertEqual(imported, reimported)
        self.assertEqual(original, self.data)  # prepare does not mutate its input
        baseline = copy.deepcopy(self.data)
        baseline["models"].pop(MODEL, None)
        baseline.pop("evaluation_runs", None)
        for split in baseline["splits"]:
            split["rows"] = [r for r in split["rows"] if r["model_id"] != MODEL]
        rebuilt, _ = self.prepare(data=baseline)
        self.assertEqual(rebuilt, imported)
        for before, after in zip(baseline["splits"], rebuilt["splits"]):
            self.assertEqual(before["rows"], [r for r in after["rows"] if r["model_id"] != MODEL])
        self.assertEqual(run["sample_count"], 200)
        self.assertEqual(run["validation"]["matched_aggregates"], 63)
        self.assertEqual({r["metric"] for r in run["validation"]["aggregate_only"]}, {"comp", "cons", "met3r"})

    def test_bundled_csv_hashes_match_recorded_sources(self):
        _, run = self.prepare()
        for metadata in run["files"].values():
            self.assertEqual(hashlib.sha256((ROOT / metadata["path"]).read_bytes()).hexdigest(), metadata["sha256"])

    def test_paper_model_cannot_be_overwritten(self):
        with self.assertRaisesRegex(ValueError, "Refusing to replace a paper model"):
            self.prepare(model="minimax-h3")

    def test_summary_mismatches_and_duplicates_are_rejected(self):
        for corruption in ["mean", "count", "duplicate_metric", "missing_metric", "duplicate_sample"]:
            with self.subTest(corruption=corruption), tempfile.TemporaryDirectory() as directory:
                target = Path(directory)
                for name in ["tables.csv", "per-sample-scores.csv"]:
                    shutil.copyfile(SOURCE / name, target / name)
                path = target / ("per-sample-scores.csv" if corruption == "duplicate_sample" else "tables.csv")
                with path.open(newline="") as stream:
                    reader = csv.DictReader(stream)
                    fields, rows = reader.fieldnames, list(reader)
                if corruption == "mean":
                    rows[0]["value"] = "0.9"
                elif corruption == "count":
                    rows[0]["n"] = "39"
                elif corruption == "missing_metric":
                    rows.pop(0)
                else:
                    rows.append(rows[0])
                with path.open("w", newline="") as stream:
                    writer = csv.DictWriter(stream, fieldnames=fields)
                    writer.writeheader()
                    writer.writerows(rows)
                with self.assertRaises(ValueError):
                    self.prepare(directory=target)


if __name__ == "__main__":
    unittest.main()
