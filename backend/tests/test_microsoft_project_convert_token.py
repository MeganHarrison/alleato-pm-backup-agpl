import base64
import hashlib
import hmac
import json
import time

import pytest
from fastapi import HTTPException

from src.api.main import _configured_cors_origins, _verify_schedule_convert_token
from src.services.microsoft_project_parser import (
    MicrosoftProjectParseError,
    _is_missing_java_runtime_error,
    _is_pdf_token,
    parse_microsoft_project_file,
)


def _token(secret: str, payload: dict) -> str:
    encoded = base64.urlsafe_b64encode(json.dumps(payload).encode("utf-8")).decode("ascii").rstrip("=")
    signature = base64.urlsafe_b64encode(
        hmac.new(secret.encode("utf-8"), encoded.encode("ascii"), hashlib.sha256).digest()
    ).decode("ascii").rstrip("=")
    return f"{encoded}.{signature}"


def test_schedule_convert_token_accepts_matching_project(monkeypatch):
    monkeypatch.setenv("ADMIN_API_KEY", "test-secret")
    token = _token("test-secret", {"project_id": 25125, "exp": int(time.time()) + 60})

    _verify_schedule_convert_token(token, 25125)


def test_missing_java_runtime_detection_handles_local_macos_jpype_error():
    assert _is_missing_java_runtime_error("Command '['/usr/libexec/java_home']' returned non-zero exit status 1.")


def test_schedule_convert_token_rejects_project_mismatch(monkeypatch):
    monkeypatch.setenv("ADMIN_API_KEY", "test-secret")
    token = _token("test-secret", {"project_id": 25125, "exp": int(time.time()) + 60})

    with pytest.raises(HTTPException) as exc:
        _verify_schedule_convert_token(token, 983)

    assert exc.value.status_code == 401
    assert "does not match" in exc.value.detail


def test_schedule_convert_token_rejects_expired_token(monkeypatch):
    monkeypatch.setenv("ADMIN_API_KEY", "test-secret")
    token = _token("test-secret", {"project_id": 25125, "exp": int(time.time()) - 1})

    with pytest.raises(HTTPException) as exc:
        _verify_schedule_convert_token(token, 25125)

    assert exc.value.status_code == 401
    assert "expired" in exc.value.detail


def test_configured_cors_origins_includes_production_project_host(monkeypatch):
    monkeypatch.delenv("FRONTEND_CORS_ORIGINS", raising=False)

    assert "https://projects.alleatogroup.com" in _configured_cors_origins()


class TestIsPdfToken:
    def test_rejects_pdf_name_objects(self):
        assert _is_pdf_token("/TilingType 1") is True
        assert _is_pdf_token("/Type/Pattern") is True
        assert _is_pdf_token("/Filter/FlateDecode") is True
        assert _is_pdf_token("/XObject<<") is True
        assert _is_pdf_token("/PaintType 1") is True
        assert _is_pdf_token("/Resources<<") is True

    def test_rejects_bare_float_coordinates(self):
        assert _is_pdf_token("751.439") is True
        assert _is_pdf_token("280.32") is True
        assert _is_pdf_token("-12.5") is True

    def test_rejects_pdf_dictionary_syntax(self):
        assert _is_pdf_token("/ExtGState<</R7 7 0 R") is True

    def test_rejects_pdf_structural_keywords(self):
        # Single PDF cross-reference / body keywords
        assert _is_pdf_token("obj") is True
        assert _is_pdf_token("endobj") is True
        assert _is_pdf_token("xref") is True
        assert _is_pdf_token("trailer") is True
        assert _is_pdf_token("startxref") is True
        assert _is_pdf_token("stream") is True
        assert _is_pdf_token("endstream") is True
        # Case-insensitive
        assert _is_pdf_token("OBJ") is True
        assert _is_pdf_token("Xref") is True

    def test_rejects_compound_pdf_keyword_sequences(self):
        # The exact pattern reported in issue #448
        assert _is_pdf_token("obj endobj xref") is True
        assert _is_pdf_token("stream endstream") is True
        assert _is_pdf_token("xref trailer startxref") is True

    def test_rejects_pdf_object_references(self):
        assert _is_pdf_token("1 0 obj") is True
        assert _is_pdf_token("5 2 R") is True
        assert _is_pdf_token("10 0 obj") is True

    def test_accepts_real_task_names(self):
        assert _is_pdf_token("Site Preparation") is False
        assert _is_pdf_token("Install HVAC") is False
        assert _is_pdf_token("Phase 1 - Foundation") is False
        assert _is_pdf_token("Task A") is False
        assert _is_pdf_token("100% Complete") is False
        # Construction tasks that contain PDF-adjacent words but are legitimate
        assert _is_pdf_token("Stream Crossing Installation") is False
        assert _is_pdf_token("Trailer Mobilization") is False


def test_parse_microsoft_project_file_rejects_pdf_bytes():
    pdf_bytes = b"%PDF-1.4 fake pdf content"
    with pytest.raises(MicrosoftProjectParseError, match="PDF"):
        parse_microsoft_project_file("schedule.xml", pdf_bytes)


def test_parse_microsoft_project_xml_filters_pdf_tokens():
    xml = b"""<?xml version="1.0"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <Tasks>
    <Task><UID>1</UID><OutlineNumber>1</OutlineNumber><Name>Site Preparation</Name><Active>1</Active></Task>
    <Task><UID>2</UID><OutlineNumber>2</OutlineNumber><Name>/TilingType 1</Name><Active>1</Active></Task>
    <Task><UID>3</UID><OutlineNumber>3</OutlineNumber><Name>/Filter/FlateDecode</Name><Active>1</Active></Task>
    <Task><UID>4</UID><OutlineNumber>4</OutlineNumber><Name>Install HVAC</Name><Active>1</Active></Task>
    <Task><UID>5</UID><OutlineNumber>5</OutlineNumber><Name>751.439</Name><Active>1</Active></Task>
    <Task><UID>6</UID><OutlineNumber>6</OutlineNumber><Name>obj endobj xref</Name><Active>1</Active></Task>
    <Task><UID>7</UID><OutlineNumber>7</OutlineNumber><Name>obj</Name><Active>1</Active></Task>
    <Task><UID>8</UID><OutlineNumber>8</OutlineNumber><Name>1 0 obj</Name><Active>1</Active></Task>
    <Task><UID>9</UID><OutlineNumber>9</OutlineNumber><Name>Stream Crossing</Name><Active>1</Active></Task>
  </Tasks>
</Project>"""
    tasks = parse_microsoft_project_file("schedule.xml", xml)
    names = [t["name"] for t in tasks]
    assert "Site Preparation" in names
    assert "Install HVAC" in names
    assert "Stream Crossing" in names
    assert "/TilingType 1" not in names
    assert "/Filter/FlateDecode" not in names
    assert "751.439" not in names
    # Issue #448: PDF cross-reference table fragments must be filtered
    assert "obj endobj xref" not in names
    assert "obj" not in names
    assert "1 0 obj" not in names
