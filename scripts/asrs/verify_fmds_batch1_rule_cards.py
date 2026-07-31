#!/usr/bin/env python3
"""Verify source-linked FMDS 8-34 Batch 1 rule cards and boundaries."""

from __future__ import annotations

import argparse
import html
import json
import os
import subprocess
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any, Callable


DOCUMENT_CODE = "FMDS0834"
REVISION_LABEL = "2026-04"
SOURCE_SHA256 = "c6f78457ac452c1c4c95b8d195ab5f33a5a772a4ebaf7d0e5ff28c055d8411ed"
EXPECTED_RULE_KEYS = {
    "batch1.hose_demand_duration",
    "batch1.tfs.gross_width_measurement",
    "batch1.tfs.net_width_sum",
    "batch1.tfs.obstruction_ignore",
    "batch1.tfs.qualifying_width_and_distance",
    "batch1.tfs.minimum_width_lookup",
    "batch1.tfs.adequacy",
    "batch1.tfs.noncompliance_escalation",
    "batch1.vertical_barrier.trigger",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--html", type=Path)
    return parser.parse_args()


def required_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def sql_literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


class Postgres:
    def __init__(self, database_url: str) -> None:
        self.database_url = database_url

    def run(self, sql: str, *, check: bool = True) -> subprocess.CompletedProcess[str]:
        process = subprocess.run(
            [
                "psql",
                self.database_url,
                "-X",
                "-v",
                "ON_ERROR_STOP=1",
                "-P",
                "pager=off",
                "-Atc",
                sql,
            ],
            check=False,
            capture_output=True,
            text=True,
        )
        if check and process.returncode != 0:
            raise RuntimeError(process.stderr.strip() or process.stdout.strip())
        return process

    def scalar(self, sql: str) -> str:
        return self.run(sql).stdout.strip()

    def json_rows(self, sql: str) -> list[dict[str, Any]]:
        wrapped = (
            "select coalesce(jsonb_agg(row_to_json(result_row)), '[]'::jsonb)::text "
            f"from ({sql}) result_row"
        )
        return json.loads(self.scalar(wrapped))

    def evaluate(self, revision_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        encoded = json.dumps(payload, separators=(",", ":"))
        raw = self.scalar(
            "select public.evaluate_fmds_batch1_rules("
            f"{sql_literal(revision_id)}::uuid, {sql_literal(encoded)}::jsonb)::text"
        )
        parsed = json.loads(raw)
        if not isinstance(parsed, dict):
            raise RuntimeError("Batch 1 evaluator did not return a JSON object")
        return parsed


def decimal(value: Any) -> Decimal:
    return Decimal(str(value))


def render_html(report: dict[str, Any]) -> str:
    boundary_rows = "\n".join(
        "<tr>"
        f"<td>{html.escape(check['name'])}</td>"
        f"<td><code>{html.escape(check['input'])}</code></td>"
        f"<td>{html.escape(check['expected'])}</td>"
        f"<td class='pass'>PASS</td>"
        "</tr>"
        for check in report["boundary_checks"]
    )
    rule_rows = "\n".join(
        "<tr>"
        f"<td><code>{html.escape(rule['rule_key'])}</code></td>"
        f"<td>{html.escape(rule['title'])}</td>"
        f"<td>{len(rule['citations'])}</td>"
        f"<td>{html.escape(rule['review_status'])}</td>"
        "</tr>"
        for rule in report["rules"]
    )
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>FMDS 8-34 Batch 1 Rule Verification</title>
<style>
  :root {{ color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }}
  body {{ margin: 0; color: #171717; background: #fff; }}
  main {{ width: min(1180px, calc(100% - 64px)); margin: 48px auto 72px; }}
  h1 {{ font-size: 32px; margin: 0 0 8px; letter-spacing: -0.03em; }}
  .subtitle {{ color: #5f6368; margin: 0 0 36px; }}
  .summary {{ display: flex; gap: 32px; padding: 20px 0; border-top: 1px solid #e7e7e7; border-bottom: 1px solid #e7e7e7; }}
  .summary div {{ min-width: 150px; }}
  .summary strong {{ display: block; font-size: 26px; }}
  .summary span {{ color: #6b7280; font-size: 13px; }}
  h2 {{ margin: 40px 0 12px; font-size: 20px; }}
  table {{ width: 100%; border-collapse: collapse; font-size: 14px; }}
  th {{ text-align: left; color: #6b7280; font-weight: 600; border-bottom: 1px solid #d7d7d7; padding: 10px 12px; }}
  td {{ border-bottom: 1px solid #ededed; padding: 10px 12px; vertical-align: top; }}
  code {{ font-size: 12px; }}
  .pass {{ color: #067647; font-weight: 700; }}
  .notice {{ margin-top: 36px; padding: 16px 0; border-top: 1px solid #e7e7e7; color: #4b5563; }}
</style>
</head>
<body>
<main>
  <h1>FMDS 8-34 Batch 1 rule verification</h1>
  <p class="subtitle">Source-linked deterministic rules · {html.escape(report['verified_at'])}</p>
  <div class="summary">
    <div><strong>{report['rule_count']}</strong><span>reviewed rule cards</span></div>
    <div><strong>{len(report['boundary_checks'])}</strong><span>passing boundary checks</span></div>
    <div><strong>{report['active_chunk_count']}</strong><span>active 2026 chunks</span></div>
    <div><strong>{html.escape(report['revision_status'])}</strong><span>revision status</span></div>
  </div>
  <h2>Rule-card coverage</h2>
  <table><thead><tr><th>Rule key</th><th>Title</th><th>Citations</th><th>Status</th></tr></thead><tbody>{rule_rows}</tbody></table>
  <h2>Exact boundary verification</h2>
  <table><thead><tr><th>Check</th><th>Input</th><th>Expected result</th><th>Outcome</th></tr></thead><tbody>{boundary_rows}</tbody></table>
  <p class="notice"><strong>Safety boundary:</strong> Batch 1 does not calculate sprinkler head count or determine full FMDS 8-34 compliance. The 2026 corpus remains staging and inactive.</p>
</main>
</body>
</html>
"""


def main() -> int:
    args = parse_args()
    database = Postgres(required_env("SUPABASE_ASRS_DATABASE_URL"))
    revisions = database.json_rows(
        "select id, status, source_sha256 "
        "from public.fmds_corpus_revisions "
        f"where document_code = {sql_literal(DOCUMENT_CODE)} "
        f"and revision_label = {sql_literal(REVISION_LABEL)}"
    )
    if len(revisions) != 1:
        raise RuntimeError(f"Expected one {DOCUMENT_CODE} {REVISION_LABEL} revision")
    revision = revisions[0]
    if revision["source_sha256"] != SOURCE_SHA256:
        raise RuntimeError("Staged revision source hash does not match the reviewed PDF")
    if revision["status"] != "staging":
        raise RuntimeError(f"Expected staging revision, found {revision['status']}")
    revision_id = revision["id"]

    rules = database.json_rows(
        "select rule_key, title, conditions, outputs, citations, derivation_method, review_status "
        "from public.fmds_rule_cards "
        f"where revision_id = {sql_literal(revision_id)}::uuid "
        "and rule_key like 'batch1.%' order by rule_key"
    )
    rule_keys = {rule["rule_key"] for rule in rules}
    if rule_keys != EXPECTED_RULE_KEYS:
        raise RuntimeError(
            f"Batch 1 rule-key mismatch: missing={sorted(EXPECTED_RULE_KEYS - rule_keys)}, "
            f"unexpected={sorted(rule_keys - EXPECTED_RULE_KEYS)}"
        )
    if any(rule["review_status"] != "reviewed" for rule in rules):
        raise RuntimeError("A Batch 1 rule card is not reviewed")
    if any(rule["derivation_method"] != "deterministic_from_approved_source_v1" for rule in rules):
        raise RuntimeError("A Batch 1 rule card has an unsupported derivation method")
    if any(not isinstance(rule["conditions"], dict) or not isinstance(rule["outputs"], dict) for rule in rules):
        raise RuntimeError("A Batch 1 rule card lacks structured conditions or outputs")
    if any(not isinstance(rule["citations"], list) or not rule["citations"] for rule in rules):
        raise RuntimeError("A Batch 1 rule card lacks source citations")

    event_ids = {
        str(citation["review_event_id"])
        for rule in rules
        for citation in rule["citations"]
    }
    event_id_list = ",".join(
        f"{sql_literal(event_id)}::uuid" for event_id in sorted(event_ids)
    )
    events = database.json_rows(
        "select id, decision, reviewer_id, reviewer_role, evidence_paths "
        "from public.fmds_visual_review_events "
        f"where id in ({event_id_list})"
    )
    if {event["id"] for event in events} != event_ids:
        raise RuntimeError("A rule-card citation points to a missing review event")
    if any(event["decision"] != "approved" or not event["evidence_paths"] for event in events):
        raise RuntimeError("A rule-card citation is not backed by an approved evidence event")

    def evaluate(payload: dict[str, Any]) -> dict[str, Any]:
        return database.evaluate(revision_id, payload)

    boundary_checks: list[dict[str, str]] = []

    def check(
        name: str,
        payload: dict[str, Any],
        assertion: Callable[[dict[str, Any]], bool],
        expected: str,
    ) -> dict[str, Any]:
        output = evaluate(payload)
        if not assertion(output):
            raise RuntimeError(
                f"Boundary check failed: {name}; expected {expected}; output={json.dumps(output, sort_keys=True)}"
            )
        boundary_checks.append(
            {
                "name": name,
                "input": json.dumps(payload, sort_keys=True),
                "expected": expected,
            }
        )
        return output

    for sprinkler_type, count, gpm, duration in (
        ("standard_coverage", 12, 250, 60),
        ("standard_coverage", 13, 500, 90),
        ("standard_coverage", 19, 500, 90),
        ("standard_coverage", 20, 500, 120),
        ("extended_coverage", 6, 250, 60),
        ("extended_coverage", 7, 500, 90),
        ("extended_coverage", 9, 500, 90),
        ("extended_coverage", 10, 500, 120),
    ):
        check(
            f"hose {sprinkler_type} count {count}",
            {
                "hose_demand": {
                    "ceiling_sprinkler_type": sprinkler_type,
                    "design_sprinkler_count": count,
                }
            },
            lambda out, expected_gpm=gpm, expected_duration=duration: (
                out["hose_demand"]["hose_demand_gpm"] == expected_gpm
                and out["hose_demand"]["water_supply_duration_min"]
                == expected_duration
            ),
            f"{gpm} gpm and {duration} min",
        )

    check(
        "net width sums open widths",
        {"transverse_flue": {"open_widths_in": [0.5, 1.0, 2.25]}},
        lambda out: decimal(out["net_width"]["net_transverse_flue_space_width_in"])
        == Decimal("3.75"),
        "3.75 in.",
    )
    for percent, ignored in ((Decimal("69.999"), False), (Decimal("70"), True)):
        check(
            f"uniform openness {percent}%",
            {"transverse_flue": {"horizontal_uniformly_open_percent": float(percent)}},
            lambda out, expected=ignored: out["obstruction"][
                "ignore_object_in_net_width_calculation"
            ]
            is expected,
            f"ignored={str(ignored).lower()}",
        )
    for width, angle, ignored in (
        (4, 30, True),
        (4.001, 30, False),
        (4, 29.999, False),
    ):
        check(
            f"obstruction width {width} in. angle {angle} degrees",
            {
                "transverse_flue": {
                    "object_width_in": width,
                    "object_angle_degrees": angle,
                }
            },
            lambda out, expected=ignored: out["obstruction"][
                "ignore_object_in_net_width_calculation"
            ]
            is expected,
            f"ignored={str(ignored).lower()}",
        )
    for width, qualifies in ((1.499, False), (1.5, True)):
        check(
            f"qualifying net width {width} in.",
            {"transverse_flue": {"net_width_in": width}},
            lambda out, expected=qualifies: out["qualifying_transverse_flue_space"][
                "qualifies"
            ]
            is expected,
            f"qualifies={str(qualifies).lower()}",
        )

    for distance, min_width in ((2, 1.5), (2.5, 2), (5, 3), (10, 6)):
        check(
            f"minimum width lookup at {distance} ft",
            {"transverse_flue": {"nominal_horizontal_distance_ft": distance}},
            lambda out, expected=min_width: decimal(
                out["minimum_width"]["recommended_min_net_width_in"]
            )
            == decimal(expected),
            f"minimum net width {min_width} in.",
        )
    check(
        "unsupported distance fails closed",
        {"transverse_flue": {"nominal_horizontal_distance_ft": 3}},
        lambda out: out["minimum_width"]["status"] == "unsupported_input",
        "unsupported_input; no interpolation",
    )
    check(
        "distance greater than 10 ft escalates",
        {"transverse_flue": {"nominal_horizontal_distance_ft": 10.001}},
        lambda out: (
            out["minimum_width"]["status"] == "escalated"
            and out["minimum_width"]["in_rack_sprinklers_required"] is True
            and out["minimum_width"]["check_vertical_barriers"] is True
        ),
        "in-rack sprinklers and vertical-barrier check",
    )

    check(
        "adequate transverse flue at exact width boundary",
        {
            "transverse_flue": {
                "nominal_horizontal_distance_ft": 10,
                "actual_net_width_in": 6,
                "vertically_aligned": True,
                "unobstructed_full_height": True,
            }
        },
        lambda out: out["adequacy"]["transverse_flue_spaces_adequate"] is True,
        "adequate=true",
    )
    check(
        "noncompliant transverse flue escalates",
        {
            "transverse_flue": {
                "nominal_horizontal_distance_ft": 10,
                "actual_net_width_in": 5.999,
                "vertically_aligned": True,
                "unobstructed_full_height": True,
            }
        },
        lambda out: (
            out["adequacy"]["transverse_flue_spaces_adequate"] is False
            and out["adequacy"]["in_rack_sprinklers_required_if_noncompliant"]
            is True
            and decimal(
                out["adequacy"][
                    "maximum_vertical_distance_between_in_rack_sprinklers_ft_if_noncompliant"
                ]
            )
            == Decimal("10")
        ),
        "in-rack sprinklers with 10 ft maximum vertical spacing",
    )

    for gross, net, distance, triggered in (
        (1.5, 0.5, 10, False),
        (1.5, 0.5, 10.001, True),
        (1.499, 0.5, 10.001, False),
        (1.5, 0.501, 10.001, False),
    ):
        check(
            f"vertical barrier gross {gross}, net {net}, distance {distance}",
            {
                "transverse_flue": {
                    "gross_width_between_uprights_in": gross,
                    "net_width_between_uprights_in": net,
                    "affected_flue_horizontal_distance_ft": distance,
                }
            },
            lambda out, expected=triggered: out["vertical_barrier"][
                "batch1_condition_triggered"
            ]
            is expected,
            f"triggered={str(triggered).lower()}",
        )

    check(
        "sprinkler head count remains unsupported",
        {"sprinkler_head_count": {"area_sq_ft": 10000}},
        lambda out: out["sprinkler_head_count"]["status"]
        == "unsupported_by_batch1",
        "unsupported_by_batch1",
    )
    check(
        "missing hose inputs fail closed",
        {"hose_demand": {}},
        lambda out: out["hose_demand"]["status"] == "insufficient_input",
        "insufficient_input",
    )

    active_chunk_count = int(
        database.scalar("select count(*) from public.fmds_active_chunks")
    )
    legacy_chunk_count = int(
        database.scalar("select count(*) from public.fm_text_chunks")
    )
    if active_chunk_count != 0:
        raise RuntimeError(f"Staging corpus leaked into active retrieval: {active_chunk_count}")
    if legacy_chunk_count != 43:
        raise RuntimeError(f"Legacy FM corpus changed: {legacy_chunk_count}/43 chunks")

    activation_process = database.run(
        "select public.activate_fmds_revision("
        f"{sql_literal(revision_id)}::uuid)",
        check=False,
    )
    activation_error = (activation_process.stderr or activation_process.stdout).strip()
    if "Table review incomplete" not in activation_error:
        raise RuntimeError(
            "Activation did not fail on incomplete full-corpus table review: "
            f"{activation_error or 'no error returned'}"
        )

    report = {
        "verified_at": datetime.now(timezone.utc).isoformat(),
        "document_code": DOCUMENT_CODE,
        "revision_label": REVISION_LABEL,
        "revision_id": revision_id,
        "revision_status": revision["status"],
        "source_sha256": SOURCE_SHA256,
        "rule_count": len(rules),
        "rules": rules,
        "review_event_count": len(events),
        "boundary_checks": boundary_checks,
        "active_chunk_count": active_chunk_count,
        "legacy_chunk_count": legacy_chunk_count,
        "activation_blocked": True,
        "activation_error": activation_error,
        "full_design_coverage": False,
        "unsupported_capabilities": [
            "sprinkler_head_count",
            "complete_asrs_configuration",
            "full_fmds_8_34_compliance_determination",
        ],
    }
    rendered = json.dumps(report, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")
    if args.html:
        args.html.parent.mkdir(parents=True, exist_ok=True)
        args.html.write_text(render_html(report), encoding="utf-8")
    print(
        json.dumps(
            {
                "status": "pass",
                "rule_count": len(rules),
                "boundary_check_count": len(boundary_checks),
                "active_chunk_count": active_chunk_count,
                "revision_status": revision["status"],
                "full_design_coverage": False,
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
