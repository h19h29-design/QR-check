from __future__ import annotations

from openpyxl import load_workbook

from app.export_excel import export_security_check_xlsx
from app.export_hwp import export_hwp_or_fallback
from app.export_pdf_or_html import export_printable_html


def sample_records():
    return [
        {
            "inspection_date": "2026-04-26",
            "room_name": "행정실",
            "person_name": "홍길동",
            "role_type": "responsible",
            "status_json": {"document": "이상 무", "cleaning": "이상 무", "lighting": "이상 무", "fire": "이상 무", "door": "이상 무"},
            "abnormal": False,
            "remarks": "",
            "admin_verified": True,
            "admin_verified_at": "2026-04-26T10:00:00+09:00",
        }
    ]


def test_export_xlsx(tmp_path):
    path = export_security_check_xlsx(sample_records(), tmp_path / "out.xlsx")
    assert path.exists()
    assert path.stat().st_size > 1000


def test_export_html(tmp_path):
    path = export_printable_html(sample_records(), tmp_path / "out.html", "샘플학교")
    text = path.read_text(encoding="utf-8")
    assert "보안점검표" in text
    assert "담당자 서명" in text


def test_export_hwp_fallback(tmp_path):
    path = export_hwp_or_fallback(sample_records(), tmp_path / "out.hwp", "샘플학교")
    assert path.exists()


def test_export_dynamic_custom_items(tmp_path):
    records = sample_records()
    records[0]["status_json"]["window"] = "이상 유"
    items = [{"item_key": "window", "item_name": "창문잠금상태", "active": 1}]
    xlsx_path = export_security_check_xlsx(records, tmp_path / "custom.xlsx", items=items)
    wb = load_workbook(xlsx_path)
    headers = [cell.value for cell in wb.active[2]]
    assert "창문잠금상태" in headers

    html_path = export_printable_html(records, tmp_path / "custom.html", "샘플학교", items)
    text = html_path.read_text(encoding="utf-8")
    assert "창문잠금상태" in text
    assert "이상 유" in text
