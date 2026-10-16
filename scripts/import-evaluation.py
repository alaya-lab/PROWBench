#!/usr/bin/env python3
"""Validate and add one complete colored-OBB evaluation run to the local leaderboard.

The paper rows remain unchanged. Re-importing the same model ID replaces only
that evaluation's rows. Normalization is applied to tables.csv means, never to
individual samples; the latter are used to check the supplied aggregates.
"""
import argparse
import copy
import csv
import hashlib
import json
import math
from pathlib import Path
import re
import shutil

from normalize_metrics import load_data


ROOT = Path(__file__).resolve().parents[1]
DATASETS = {
    "verified_ff_40": "verified", "unverified_ff_90": "unverified",
    "long_horizon": "long-horizon", "multi4": "multi-view", "gunfight": "gunfight",
}
ALIASES = {
    "interaction": "isr", "align": "lra", "imaging": "img", "aesthetic": "aes",
    "msmooth": "smooth", "reappear_iou": "re_iou", "state_persist": "re_state",
    "IoU": "iou", "CenterErr": "cerr", "MissRate": "miss", "ISR": "isr",
    "LRA": "lra", "gISR": "gisr", "gLRA": "glra", "RotErr_deg": "rot",
    "rot_deg": "rot", "TransErr": "trans", "CamMC": "cammc",
    "compliance_percent": "comp", "consistency_percent": "cons", "MEt3R": "met3r",
}
SAMPLE_COLUMNS = {
    "iou": "iou", "cerr": "center_error", "isr": "isr", "lra": "lra",
    "gisr": "gisr", "glra": "glra", "rot": "rot_deg", "trans": "trans_error",
    "cammc": "cammc", "img": "imaging_quality", "aes": "aesthetic_quality",
    "warp": "warp_error_x1000", "smooth": "motion_smoothness", "clip": "clip_score",
    "re_iou": "reappear_iou", "re_state": "state_persist", "miss": "miss_rate",
}
AGGREGATE_ONLY = {"comp", "cons", "met3r"}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def read_csv(path, required):
    with path.open(encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream)
        require(reader.fieldnames and len(reader.fieldnames) == len(set(reader.fieldnames)),
                f"{path}: missing or duplicate column names")
        require(required <= set(reader.fieldnames), f"{path}: missing required columns")
        rows = list(reader)
    require(rows, f"{path}: no rows")
    require(all(None not in row and all(value is not None for value in row.values()) for row in rows),
            f"{path}: malformed CSV row")
    return rows


def number(value):
    result = float(value)
    require(math.isfinite(result), f"Non-finite score: {value}")
    return result


def mean(values):
    require(bool(values), "No valid observations for a reported metric")
    return math.fsum(values) / len(values)


def prepare_evaluation(data, directory, model_id, model_name, family):
    """Return a validated copy and run metadata without modifying any files."""
    require(re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", model_id), "Use a lowercase model ID slug")
    require(bool(model_name.strip()), "Model name is required")
    require(family in data["families"], f"Unknown model family: {family}")
    previous = data["models"].get(model_id)
    require(not previous or previous.get("evaluation_run_id") == model_id,
            f"Refusing to replace a paper model: {model_id}")
    tables_path, samples_path = directory / "tables.csv", directory / "per-sample-scores.csv"
    tables = read_csv(tables_path, {"dataset", "n_videos", "metric", "value", "n", "expected", "aggregation"})
    samples = read_csv(samples_path, {"dataset", "method", "representation", "episode", "camera",
                                     "has_reference_image", *SAMPLE_COLUMNS.values()})
    methods, representations = {s["method"] for s in samples}, {s["representation"] for s in samples}
    require(len(methods) == 1, "Expected samples from exactly one method")
    require(representations == {"colored-obb"}, "This importer expects the colored-OBB input representation")
    method = next(iter(methods))
    require(re.fullmatch(r"[A-Za-z0-9_-]+", method), "Method ID must be safe for a relative asset path")
    require({r["dataset"] for r in tables} == set(DATASETS), "Summary must cover all five datasets")
    require({r["dataset"] for r in samples} == set(DATASETS), "Samples must cover all five datasets")
    keys = [(r["dataset"], r["episode"], r["camera"]) for r in samples]
    require(len(keys) == len(set(keys)), "Duplicate sample (dataset, episode, camera)")
    prefix = f"assets/evaluations/{method}/colored-obb"
    result = copy.deepcopy(data)
    checks = []
    run = {
        "id": model_id, "model_id": model_id, "model_name": model_name,
        "method": method, "representation": "colored-obb",
        "sample_count": len(samples), "metric_count": len(tables),
        "files": {name: {"path": f"{prefix}/{name}", "sha256": hashlib.sha256((directory / name).read_bytes()).hexdigest()}
                  for name in ["tables.csv", "per-sample-scores.csv"]},
        "score_basis": "Normalize the reported aggregate, then average within categories, then average categories. Per-sample scores validate aggregates only.",
        "datasets": {},
    }
    for dataset, split_id in DATASETS.items():
        split = next(s for s in result["splits"] if s["id"] == split_id)
        subset = [s for s in samples if s["dataset"] == dataset]
        require(len(subset) == split["clips_per_model"], f"{dataset}: incorrect sample count")
        refs = [s["has_reference_image"].lower() for s in subset]
        require(set(refs) <= {"true", "false"}, f"{dataset}: invalid reference-image flag")
        require(len(set(refs)) == 1, f"{dataset}: mixed reference-image conditions need explicit input metadata")
        scenes = {}
        if dataset == "multi4":
            for sample in subset:
                scenes.setdefault(sample["episode"], []).append(sample)
            require(len(scenes) == split["cases"] and all(len(views) == 4 for views in scenes.values()),
                    "Multi-view requires ten scenes with four distinct views each")
        cells = {}
        for line, table in enumerate(tables, 2):
            if table["dataset"] != dataset:
                continue
            metric = ALIASES.get(table["metric"], table["metric"])
            require(metric in split["metric_ids"] and metric not in cells,
                    f"{dataset}: unknown or duplicate metric {table['metric']}")
            value = number(table["value"])
            require(value >= 0 or metric == "clip", f"{dataset}/{metric}: negative value")
            n, expected = int(table["n"]), int(table["expected"])
            require(n == expected and n > 0, f"{dataset}/{metric}: incomplete aggregate ({n}/{expected})")
            require(int(table["n_videos"]) == len(subset), f"{dataset}/{metric}: incorrect video count")
            detail = {"source_metric": table["metric"], "line": line, "n": n, "expected": expected,
                      "aggregation": table["aggregation"], "per_sample_check": "not_in_sample_csv"}
            if metric in SAMPLE_COLUMNS:
                column = SAMPLE_COLUMNS[metric]
                if dataset == "multi4":
                    require(all(s[column].strip() for s in subset), f"Multi-view {metric}: missing view score")
                    values = [mean([number(s[column]) for s in views]) for views in scenes.values()]
                else:
                    values = [number(s[column]) for s in subset if s[column].strip()]
                require(len(values) == n, f"{dataset}/{metric}: sample count disagrees with tables.csv")
                recomputed = mean(values)
                require(math.isclose(value, recomputed, rel_tol=1e-10, abs_tol=1e-10),
                        f"{dataset}/{metric}: summary {value} disagrees with sample mean {recomputed}")
                detail.update(per_sample_check="matched", recomputed_mean=recomputed)
            else:
                require(dataset == "multi4" and metric in AGGREGATE_ONLY,
                        f"{dataset}/{metric}: unrecognized aggregate-only metric")
            cells[metric] = {"value": value, "raw": table["value"], "detail": detail}
            checks.append(detail["per_sample_check"])
        require(set(cells) == set(split["metric_ids"]), f"{dataset}: incomplete metric set")
        source = {"kind": "evaluation", "run_id": model_id, "method": method, "representation": "colored-obb",
                  "file": f"{prefix}/tables.csv", "line": min(c["detail"]["line"] for c in cells.values()),
                  "per_sample_file": f"{prefix}/per-sample-scores.csv", "dataset": dataset}
        row = {
            "model_id": model_id, "model_name": model_name, "family": family,
            "inputs": (["RI"] if refs[0] == "true" else []) + ["B"], "includes_text_prompt": True,
            "metrics": {m: cells[m]["value"] for m in split["metric_ids"]},
            "raw_values": {m: cells[m]["raw"] for m in split["metric_ids"]},
            "metric_coverage": {m: cells[m]["detail"] for m in split["metric_ids"]},
            "source": source,
        }
        split["rows"] = [r for r in split["rows"] if r["model_id"] != model_id] + [row]
        split["model_count"] = len(split["rows"])
        run["datasets"][split_id] = {
            "source_dataset": dataset, "videos": len(subset), "reference_image_count": refs.count("true"),
            "aggregation": sorted({c["detail"]["aggregation"] for c in cells.values()}),
            "coverage": {m: {key: cells[m]["detail"][key] for key in ["n", "expected", "per_sample_check"]} for m in split["metric_ids"]},
            "samples_without_entity_score": [{"episode": s["episode"], "camera": s["camera"]} for s in subset if not s["iou"].strip()],
        }
    run["validation"] = {"matched_aggregates": checks.count("matched"),
                         "aggregate_only": [{"split": "multi-view", "metric": m} for m in sorted(AGGREGATE_ONLY)],
                         "tolerance": "relative and absolute tolerance 1e-10"}
    result["models"][model_id] = {"id": model_id, "name": model_name, "family": family,
                                 "configuration": f"colored-OBB; run {method}", "evaluation_run_id": model_id}
    result["input_legend"]["RI"] = "Reference image supplied in this evaluation run; the CSV does not specify whether it is a verified first frame"
    result["evaluation_runs"] = [r for r in result.get("evaluation_runs", []) if r["id"] != model_id] + [run]
    result["title"] = "PROWBench leaderboard results"
    result["provenance"]["evaluation_import_script"] = "scripts/import-evaluation.py"
    result["counts"] = {
        "splits": len(result["splits"]), "distinct_models": len(result["models"]),
        "model_setting_rows": sum(len(s["rows"]) for s in result["splits"]),
        "reported_metric_cells": sum(len(r["metrics"]) for s in result["splits"] for r in s["rows"]),
        "distinct_metrics": len(result["metrics"]),
    }
    return result, run


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path, help="Directory containing tables.csv and per-sample-scores.csv")
    parser.add_argument("--model-id", required=True)
    parser.add_argument("--model-name", required=True)
    parser.add_argument("--family", choices=["camera", "renderer", "general"], default="renderer")
    parser.add_argument("--input", type=Path, default=ROOT / "assets/leaderboard-data.js")
    parser.add_argument("--output", type=Path, default=ROOT / "assets/leaderboard-data.js")
    args = parser.parse_args()
    result, run = prepare_evaluation(load_data(args.input), args.directory, args.model_id, args.model_name, args.family)
    # Copy only after all validation succeeds, preserving the exact uploaded CSVs.
    for name, meta in run["files"].items():
        destination = ROOT / meta["path"]
        destination.parent.mkdir(parents=True, exist_ok=True)
        source = args.directory / name
        if source.resolve() != destination.resolve():
            shutil.copyfile(source, destination)
    payload = json.dumps(result, indent=2, ensure_ascii=False, allow_nan=False)
    content = ('// Generated by scripts/import-leaderboard.py and scripts/import-evaluation.py.\n'
               '(function (root) {\n  const data = ' + payload + ';\n'
               '  if (typeof module === "object" && module.exports) module.exports = data;\n'
               '  else root.PROWLeaderboardData = data;\n'
               '})(typeof globalThis !== "undefined" ? globalThis : this);\n')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(content, encoding="utf-8")
    print(json.dumps({"output": str(args.output), "counts": result["counts"], "validation": run["validation"]}, indent=2))


if __name__ == "__main__":
    main()
