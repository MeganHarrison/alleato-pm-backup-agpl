import pytest

from src.services.integrations.microsoft_graph.outlook_attribution import (
    OutlookProjectAttributionConflict,
    resolve_authoritative_project_consensus,
)


def _row(**overrides):
    row = {
        "id": 1,
        "project_id": 178,
        "assignment_method": "attribution_rule:keyword",
        "assignment_confidence": 0.97,
    }
    row.update(overrides)
    return row


def test_resolve_authoritative_project_consensus_ignores_propagated_assignments():
    consensus = resolve_authoritative_project_consensus(
        [
            _row(),
            _row(
                id=2,
                project_id=31,
                assignment_method="existing_document",
                assignment_confidence=1.0,
            ),
            _row(
                id=3,
                project_id=31,
                assignment_method="project_company_domain",
                assignment_confidence=0.74,
            ),
        ]
    )

    assert consensus is not None
    assert consensus.project_id == 178
    assert consensus.confidence == 0.97
    assert consensus.evidence_row_ids == (1,)


def test_resolve_authoritative_project_consensus_fails_on_authoritative_conflict():
    with pytest.raises(OutlookProjectAttributionConflict, match="projects 31, 178"):
        resolve_authoritative_project_consensus(
            [
                _row(),
                _row(
                    id=2,
                    project_id=31,
                    assignment_method="manual_review",
                    assignment_confidence=1.0,
                ),
            ]
        )


def test_resolve_authoritative_project_consensus_does_not_promote_weak_domain_match():
    assert (
        resolve_authoritative_project_consensus(
            [
                _row(
                    project_id=31,
                    assignment_method="project_company_domain",
                    assignment_confidence=0.74,
                )
            ]
        )
        is None
    )
