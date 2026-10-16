#!/usr/bin/env python3
"""PROWBench 百分制归一化：与 leaderboard-core.js 当前页面口径一致。

输入 x 是论文表格或评测汇总 CSV 中的原始数值（模型均值），不是再次读取视频计算的指标。
仅使用 Python 标准库；支持网站的 leaderboard-data.js 或下载的原始 JSON。

用法（在仓库根目录）：
  python3 scripts/normalize_metrics.py --explain
  python3 scripts/normalize_metrics.py --output normalized-results.json
  python3 scripts/normalize_metrics.py --input source-results.json --output scores.json

也可以导入 normalize_metric(metric_id, value)，单独转换一个数值。
缺失/无效值返回 None；Warp 转为归一化 RMSE 分数，与 Smoothness 平均后计入总分。
"""

import argparse
import json
import math
from pathlib import Path
import re
import sys


GROUPS = {
    "entity": "Entity control",
    "logic": "Logic / state",
    "camera": "Camera control",
    "quality": "Visual quality",
    "temporal": "Temporal quality",
    "text": "Text alignment",
    "memory": "Memory",
    "appearance": "Multi-view consistency",
}

# ID、名称、大项、公式、输入单位/解释、规则依据。
# 这里只记录现行网站规则；其中自定义映射不表示 PROWBench 论文原有的官方分数。
_RULES = [
    ("iou", "BBox IoU", "entity", "100*x",
     "x 为 [0,1] 的 IoU；漏检已在原指标中计零。", "比例转百分制"),
    ("cerr", "CErr", "entity", "100/(1+x)",
     "x 已按图像对角线归一化；仅对检测到的目标计算。误差越小，分数越高。", "借鉴 WBENCH 倒数误差映射的自定义方案"),
    ("isr", "ISR", "logic", "100*x",
     "x 为交互成功率，范围 [0,1]。", "比例转百分制"),
    ("lra", "LRA", "logic", "100*x",
     "x 为逻辑与渲染对齐比例，范围 [0,1]。", "比例转百分制"),
    ("gisr", "gISR", "logic", "100*x",
     "直接使用论文报告的 gISR；不能用 mean(IoU)*mean(ISR) 重算。", "比例转百分制，保留原始逐样本乘积的均值"),
    ("glra", "gLRA", "logic", "100*x",
     "直接使用论文报告的 gLRA；不能用 mean(IoU)*mean(LRA) 重算。", "比例转百分制，保留原始逐样本乘积的均值"),
    ("rot", "RotErr", "camera", "100/(1+pi*x/180)",
     "x 的单位为度，先转换为弧度；1 弧度误差映射为 50 分。", "自定义倒数映射，非 WBENCH NavScore"),
    ("trans", "TransErr", "camera", "100/(1+x)",
     "x 已使用各轨迹自身最大位移归一化，不是以米为单位的误差。", "借鉴 WBENCH 倒数误差映射的自定义方案"),
    ("cammc", "CamMC", "camera", "100/(1+x)",
     "x 为姿态矩阵的 Frobenius 距离，其中平移部分已归一化。", "借鉴 WBENCH 倒数误差映射的自定义方案"),
    ("img", "Img / Imaging", "quality", "x",
     "MUSIQ 表格值已经使用约 0–100 的分数尺度，不再乘 100。", "沿用 WBENCH Imaging 缩放"),
    ("aes", "Aes / Aesthetic", "quality", "100*x",
     "表中 x 是已除以 10 的 LAION 分数，例如 0.609 -> 60.9；若输入原始 6.09，应先除以 10。", "沿用 WBENCH Aesthetic 缩放"),
    ("warp", "Warp", "temporal", "100*(1-sqrt(x/1000))",
     "x=1000*MSE；像素差先除以 255，RGB 通道取均值，再对有效像素和帧对平均。", "采用本地 metric_temporal.py 的计算口径，按归一化 RMSE 自定义转分"),
    ("smooth", "Smooth / Motion Smoothness", "temporal", "100*x",
     "x 是 VBench smoothness，已经是高分更好的 [0,1] 分数，不再取反。", "沿用 WBENCH Motion Smoothness 缩放"),
    ("clip", "CLIP-Score", "text", "clip(x,0,100)",
     "论文已报告 100*cosine_similarity，不再乘 100；负值裁剪为 0。", "当前采用的非负 CLIPScore 映射"),
    ("re_iou", "Re-IoU", "memory", "100*x",
     "x 为目标重新出现后的 IoU，范围 [0,1]。", "比例转百分制"),
    ("re_state", "Re-State", "memory", "100*x",
     "x 为可判断的返回事件中状态正确的比例，范围 [0,1]。", "比例转百分制"),
    ("miss", "Miss -> Detection", "entity", "100*(1-x)",
     "x 为漏检率 [0,1]；取补数后显示为 Detection，高分更好。", "错误率转成功率"),
    ("comp", "Comp. / Compliance", "appearance", "x",
     "论文已经报告百分数，例如 83.4，不再乘 100；以可判断目标为条件。", "已有百分制"),
    ("cons", "Cons. / Consistency", "appearance", "x",
     "论文已经报告百分数，不再乘 100；以可判断的跨视角观测为条件。", "已有百分制"),
    ("met3r", "MEt3R", "appearance", "100*(1-x/2)",
     "按余弦距离 [0,2] 反向线性映射：0 -> 100，1 -> 50，2 -> 0。", "基于 MEt3R 距离范围的自定义映射"),
]
RULES = {
    metric: dict(name=name, group=group, formula=formula, explanation=note, basis=basis)
    for metric, name, group, formula, note, basis in _RULES
}
EXCLUDED_METRICS = frozenset()
SCORE_BASIS = "对论文或评测汇总 CSV 报告的模型均值做展示转换；非线性 f(mean(x)) 不等于 mean(f(x))。逐样本 CSV 用于核对汇总，不改变此计算顺序。"


def normalize_metric(metric_id, value):
    """将一个报告的汇总值转换为 [0,100] 分数；缺失、非法值返回 None。"""
    if metric_id not in RULES:
        raise ValueError(f"未知 metric ID: {metric_id}")
    # bool、数值字符串和空值不当作合法指标，避免 None/False 被误算为 100 分。
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    if not math.isfinite(value) or (value < 0 and metric_id != "clip"):
        return None
    x = float(value)

    if metric_id in {"iou", "isr", "lra", "gisr", "glra", "re_iou", "re_state"}:
        score = 100 * x
    elif metric_id in {"cerr", "trans", "cammc"}:
        score = 100 / (1 + x)
    elif metric_id == "rot":
        score = 100 / (1 + math.pi * x / 180)  # 输入为度；转换为弧度。
    elif metric_id == "aes":
        score = 100 * x  # 输入是论文的 0–1 值，不是 LAION 原始 0–10 值。
    elif metric_id == "smooth":
        score = 100 * x
    elif metric_id in {"img", "comp", "cons", "clip"}:
        score = x  # 这些表格值已经乘过 100，或本来就是百分制尺度。
    elif metric_id == "miss":
        score = 100 * (1 - x)
    elif metric_id == "met3r":
        score = 100 * (1 - x / 2)
    elif metric_id == "warp":
        score = 100 * (1 - math.sqrt(x / 1000))

    return min(100.0, max(0.0, score))


def complete_mean(values):
    """任一必需分数缺失就返回 None，不为不同模型使用不同的平均分母。"""
    if not values or any(value is None for value in values):
        return None
    return sum(values) / len(values)


def category_members(metric_ids):
    """使用该评测组实际定义的全部指标，包括 Warp。"""
    groups = {}
    for metric in metric_ids:
        group = RULES[metric]["group"]
        groups.setdefault(group, [])
        if metric not in EXCLUDED_METRICS:
            groups[group].append(metric)
    return groups


def normalize_row(row, metric_ids):
    """先归一化小项，再组内平均，最后大项等权平均；全程不提前四舍五入。"""
    normalized = {metric: normalize_metric(metric, row["metrics"].get(metric)) for metric in metric_ids}
    categories = {
        group: complete_mean([normalized[metric] for metric in members])
        for group, members in category_members(metric_ids).items()
    }
    return {
        **row,
        "normalized_metrics": normalized,
        "category_scores": categories,
        "overall_score": complete_mean(list(categories.values())),
    }


def normalize_dataset(data):
    """各 setting 独立排名，保留原始值、打印精度和来源；输出包含完整公式。"""
    splits = []
    for split in data["splits"]:
        rows = [normalize_row(row, split["metric_ids"]) for row in split["rows"]]
        for row in rows:
            score = row["overall_score"]
            row["overall_rank"] = None if score is None else 1 + sum(
                other["overall_score"] is not None and other["overall_score"] - score > 1e-9
                for other in rows
            )
        rows.sort(key=lambda row: (
            row["overall_score"] is None,
            -row["overall_score"] if row["overall_score"] is not None else 0,
            row["model_name"].casefold(),
        ))
        splits.append({**split, "scoring_categories": category_members(split["metric_ids"]), "rows": rows})
    return {
        **data,
        "normalization": {
            "score_basis": SCORE_BASIS,
            "metric_rules": RULES,
            "category_names": GROUPS,
            "final_clip": "min(100, max(0, score))",
            "category_score": "mean(normalized submetrics in this category)",
            "overall_score": "mean(category scores in this setting)",
            "excluded_metrics": sorted(EXCLUDED_METRICS),
            "missing_value_policy": "任一必需小项（包括 Warp）缺失，该大项和总分均为 null。",
            "rounding": "不在计算或导出时舍入；网页仅显示小项 1 位、大项和总分 2 位小数。",
        },
        "splits": splits,
    }


def load_data(path):
    """读取纯 JSON 或网站包装的 JSON；不会执行输入文件中的 JavaScript。"""
    text = Path(path).read_text(encoding="utf-8-sig")
    if text.lstrip().startswith("{"):
        return json.loads(text)
    match = re.search(r"\bconst\s+data\s*=\s*", text)
    if not match:
        raise ValueError("输入需要是原始 JSON 或网站 assets/leaderboard-data.js。")
    data, _ = json.JSONDecoder().raw_decode(text[match.end():])
    return data


def explain():
    print("x = PROWBench 论文表格或评测汇总 CSV 原值；S = 当前网站的 0–100 分数，高分更好。\n")
    for metric, rule in RULES.items():
        print(f"{metric:9} {rule['name']}: S = {rule['formula']}")
        print(f"          {rule['explanation']} 依据：{rule['basis']}")
    print("\n所有有效分数最后 clip 到 [0,100]；不根据当前模型的最好/最差值做 min-max。")
    print("大项 = 其中小项归一化后的平均；总分 = 各大项等权平均；各 setting 分开排名。")
    print("Temporal quality = (S_Warp + S_Smoothness) / 2；任一必需项缺失则不计总分。")
    print(SCORE_BASIS)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--explain", action="store_true", help="逐项打印公式、输入单位和依据后退出")
    parser.add_argument("--input", type=Path, default=Path(__file__).resolve().parents[1] / "assets/leaderboard-data.js",
                        help="原始结果 JSON 或 leaderboard-data.js，默认使用仓库数据")
    parser.add_argument("--output", type=Path, help="输出带小项分数、大项均分和总排名的 JSON；默认打印到 stdout")
    args = parser.parse_args()
    if args.explain:
        explain()
        return
    result = normalize_dataset(load_data(args.input))
    content = json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(content, encoding="utf-8")
        print(f"已导出 {sum(len(split['rows']) for split in result['splits'])} 条结果：{args.output}", file=sys.stderr)
    else:
        print(content, end="")


if __name__ == "__main__":
    main()
