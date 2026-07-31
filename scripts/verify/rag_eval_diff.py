#!/usr/bin/env python3
"""
RAG Eval Regression Tracker

Compares two eval JSON baselines (L1 or L2) and surfaces regressions.
Run after any RAG change to verify you didn't break anything.

Usage:
  python3 scripts/verify/rag_eval_diff.py \\
      /path/to/rag-eval-baseline.json \\
      /tmp/rag-eval-current.json

  # L2 answer eval diff
  python3 scripts/verify/rag_eval_diff.py \\
      --type answer \\
      /path/to/rag-answer-eval-baseline.json \\
      /tmp/rag-answer-eval-current.json

Exit codes:
  0 = no regressions (or improvements only)
  1 = regressions detected
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# ── ANSI color helpers ──────────────────────────────────────────────────────

def green(s: str) -> str:
    return f"\033[92m{s}\033[0m"

def red(s: str) -> str:
    return f"\033[91m{s}\033[0m"

def yellow(s: str) -> str:
    return f"\033[93m{s}\033[0m"

def bold(s: str) -> str:
    return f"\033[1m{s}\033[0m"

def dim(s: str) -> str:
    return f"\033[2m{s}\033[0m"


# ── L1 Retrieval diff ───────────────────────────────────────────────────────

def diff_l1(baseline: Dict[str, Any], current: Dict[str, Any]) -> int:
    """Diff two L1 retrieval eval JSONs. Returns number of regressions."""
    base_summary = baseline.get("summary", {})
    curr_summary = current.get("summary", {})

    print(bold("\n── Summary Metrics ─────────────────────────────────────────"))
    metrics = [
        ("pass_rate",          "Pass rate",        True),
        ("source_match_rate",  "Source match",     True),
        ("keyword_match_rate", "Keyword match",    True),
        ("mrr",                "MRR",              True),
        ("avg_top_similarity", "Avg similarity",   True),
        ("avg_latency_ms",     "Avg latency (ms)", False),  # lower is better
    ]

    regressions = 0
    for key, label, higher_is_better in metrics:
        base_val = base_summary.get(key, 0)
        curr_val = curr_summary.get(key, 0)
        delta = curr_val - base_val

        if higher_is_better:
            improved = delta > 0.001
            regressed = delta < -0.001
        else:
            improved = delta < -1
            regressed = delta > 1

        if regressed:
            regressions += 1
            arrow = red(f"▼ {delta:+.3f}")
        elif improved:
            arrow = green(f"▲ {delta:+.3f}")
        else:
            arrow = dim(f"  {delta:+.3f}")

        print(f"  {label:22s} {base_val:.3f} → {curr_val:.3f}  {arrow}")

    # Per-question pass/fail changes
    base_by_id: Dict[int, Dict] = {q["id"]: q for q in baseline.get("per_question", [])}
    curr_by_id: Dict[int, Dict] = {q["id"]: q for q in current.get("per_question", [])}

    newly_failing: List[Dict] = []
    newly_passing: List[Dict] = []

    for qid, cq in curr_by_id.items():
        bq = base_by_id.get(qid)
        if not bq:
            continue
        base_passed = bq.get("passed", False)
        curr_passed = cq.get("passed", False)
        if base_passed and not curr_passed:
            newly_failing.append(cq)
            regressions += 1
        elif not base_passed and curr_passed:
            newly_passing.append(cq)

    if newly_failing:
        print(bold(red(f"\n── Regressions: {len(newly_failing)} question(s) newly FAILING ──")))
        for q in newly_failing:
            top_sim = q.get("top_similarity", 0)
            sources = q.get("source_types_found", [])[:3]
            print(f"  {red('✗')} Q{q['id']:02d} [{q.get('category','?')}] sim={top_sim:.3f} "
                  f"sources={sources}")
            print(f"      {dim(q['question'][:80])}")

    if newly_passing:
        print(bold(green(f"\n── Improvements: {len(newly_passing)} question(s) newly PASSING ──")))
        for q in newly_passing:
            print(f"  {green('✓')} Q{q['id']:02d} [{q.get('category','?')}] {dim(q['question'][:70])}")

    # Category-level breakdown
    base_qs = baseline.get("per_question", [])
    curr_qs = current.get("per_question", [])
    categories = sorted(set(q["category"] for q in curr_qs))

    print(bold("\n── Per-Category ────────────────────────────────────────────"))
    for cat in categories:
        b_cat = [q for q in base_qs if q["category"] == cat]
        c_cat = [q for q in curr_qs if q["category"] == cat]
        b_pass = sum(1 for q in b_cat if q.get("passed"))
        c_pass = sum(1 for q in c_cat if q.get("passed"))
        b_mrr = sum(q.get("mrr", 0) for q in b_cat) / len(b_cat) if b_cat else 0
        c_mrr = sum(q.get("mrr", 0) for q in c_cat) / len(c_cat) if c_cat else 0

        pass_delta = c_pass - b_pass
        mrr_delta = c_mrr - b_mrr

        if pass_delta < 0:
            pass_str = red(f"{b_pass}→{c_pass} ({pass_delta:+d})")
        elif pass_delta > 0:
            pass_str = green(f"{b_pass}→{c_pass} ({pass_delta:+d})")
        else:
            pass_str = dim(f"{b_pass}→{c_pass} (±0)")

        if mrr_delta < -0.05:
            mrr_str = red(f"MRR {b_mrr:.3f}→{c_mrr:.3f}")
        elif mrr_delta > 0.05:
            mrr_str = green(f"MRR {b_mrr:.3f}→{c_mrr:.3f}")
        else:
            mrr_str = dim(f"MRR {b_mrr:.3f}→{c_mrr:.3f}")

        n = len(c_cat)
        print(f"  {cat:20s} {pass_str}  {mrr_str}  (n={n})")

    return regressions


# ── L2 Answer quality diff ──────────────────────────────────────────────────

def diff_l2(baseline: Dict[str, Any], current: Dict[str, Any]) -> int:
    """Diff two L2 answer eval JSONs. Returns number of regressions."""
    base_summary = baseline.get("summary", {})
    curr_summary = current.get("summary", {})

    print(bold("\n── Answer Quality Metrics ──────────────────────────────────"))
    dimensions = ["specificity", "accuracy", "completeness", "actionability", "overall"]
    regressions = 0

    for dim_name in dimensions:
        base_val = base_summary.get(dim_name, 0)
        curr_val = curr_summary.get(dim_name, 0)
        delta = curr_val - base_val

        if delta < -0.2:
            regressions += 1
            arrow = red(f"▼ {delta:+.2f}")
        elif delta > 0.2:
            arrow = green(f"▲ {delta:+.2f}")
        else:
            arrow = dim(f"  {delta:+.2f}")

        print(f"  {dim_name:16s} {base_val:.2f} → {curr_val:.2f}  {arrow}")

    # Category-level
    base_cats = baseline.get("category_averages", {})
    curr_cats = current.get("category_averages", {})
    all_cats = sorted(set(list(base_cats.keys()) + list(curr_cats.keys())))

    print(bold("\n── Per-Category Overall Score ──────────────────────────────"))
    for cat in all_cats:
        b_overall = base_cats.get(cat, {}).get("overall", 0)
        c_overall = curr_cats.get(cat, {}).get("overall", 0)
        delta = c_overall - b_overall

        if delta < -0.3:
            regressions += 1
            d_str = red(f"▼ {delta:+.2f}")
        elif delta > 0.3:
            d_str = green(f"▲ {delta:+.2f}")
        else:
            d_str = dim(f"  {delta:+.2f}")

        print(f"  {cat:20s} {b_overall:.2f} → {c_overall:.2f}  {d_str}")

    # Per-question regressions (overall drop > 1 point)
    base_qs: Dict[int, Dict] = {q["id"]: q for q in baseline.get("questions", [])}
    curr_qs: Dict[int, Dict] = {q["id"]: q for q in current.get("questions", [])}

    sharp_regressions = []
    improvements = []
    for qid, cq in curr_qs.items():
        bq = base_qs.get(qid)
        if not bq:
            continue
        b_overall = (bq.get("scores") or {}).get("overall", 0)
        c_overall = (cq.get("scores") or {}).get("overall", 0)
        delta = c_overall - b_overall
        if delta <= -1:
            sharp_regressions.append((qid, cq, delta))
        elif delta >= 1:
            improvements.append((qid, cq, delta))

    if sharp_regressions:
        print(bold(red(f"\n── Sharp Regressions (overall ≥ -1 point) ─────────────")))
        for qid, q, d in sharp_regressions:
            regressions += 1
            print(f"  {red('✗')} Q{qid:02d} [{q.get('category','?')}]  "
                  f"overall {red(str(d)):s}  {dim(q['question'][:70])}")

    if improvements:
        print(bold(green(f"\n── Notable Improvements (overall ≥ +1 point) ──────────")))
        for qid, q, d in improvements:
            print(f"  {green('✓')} Q{qid:02d} [{q.get('category','?')}]  "
                  f"overall +{d:.0f}  {dim(q['question'][:70])}")

    return regressions


# ── Entry point ─────────────────────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser(description="Diff two RAG eval JSON baselines")
    parser.add_argument("baseline", help="Path to baseline JSON (older run)")
    parser.add_argument("current",  help="Path to current JSON (newer run)")
    parser.add_argument(
        "--type",
        choices=["retrieval", "answer"],
        default="retrieval",
        help="Eval type: 'retrieval' (L1, default) or 'answer' (L2)",
    )
    parser.add_argument(
        "--save-as-baseline",
        metavar="PATH",
        help="If no regressions, copy current file to this path as new baseline",
    )
    args = parser.parse_args()

    baseline_path = Path(args.baseline)
    current_path = Path(args.current)

    if not baseline_path.exists():
        print(red(f"Baseline file not found: {baseline_path}"), file=sys.stderr)
        return 2
    if not current_path.exists():
        print(red(f"Current file not found: {current_path}"), file=sys.stderr)
        return 2

    with open(baseline_path) as f:
        baseline = json.load(f)
    with open(current_path) as f:
        current = json.load(f)

    base_ts = baseline.get("timestamp", "unknown")
    curr_ts = current.get("timestamp", "unknown")

    print(bold("══════════════════════════════════════════════════════════════"))
    print(bold(f"  RAG EVAL DIFF  ({args.type.upper()})"))
    print(bold("══════════════════════════════════════════════════════════════"))
    print(f"  Baseline : {dim(base_ts)}  {dim(str(baseline_path))}")
    print(f"  Current  : {dim(curr_ts)}  {dim(str(current_path))}")

    if args.type == "answer":
        regressions = diff_l2(baseline, current)
    else:
        regressions = diff_l1(baseline, current)

    print(bold("\n══════════════════════════════════════════════════════════════"))
    if regressions == 0:
        print(bold(green(f"  ✓ PASS — no regressions detected")))
        if args.save_as_baseline:
            import shutil
            shutil.copy(current_path, args.save_as_baseline)
            print(green(f"  New baseline saved to {args.save_as_baseline}"))
    else:
        print(bold(red(f"  ✗ FAIL — {regressions} regression(s) detected")))
    print(bold("══════════════════════════════════════════════════════════════\n"))

    return 0 if regressions == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
