from __future__ import annotations

import json
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter


def export_security_check_xlsx(records: list[dict], output_path: str | Path, title: str = "보안점검표") -> Path:
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    wb = Workbook()
    ws = wb.active
    ws.title = "보안점검표"

    headers = [
        "점검일",
        "실명",
        "담당/당직",
        "점검자",
        "서류보관상태",
        "청소상태",
        "소등상태",
        "화기단속상태",
        "문단속상태",
        "특이사항",
        "이상여부",
        "관리자확인",
        "관리자확인일시",
        "담당자 서명",
        "관리자 서명",
    ]
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=len(headers))
    ws.cell(1, 1, title).font = Font(size=16, bold=True)
    ws.cell(1, 1).alignment = Alignment(horizontal="center")
    ws.append(headers)

    for record in records:
        status = record.get("status_json", {})
        if isinstance(status, str):
            try:
                status = json.loads(status)
            except json.JSONDecodeError:
                status = {}
        ws.append(
            [
                record.get("inspection_date", ""),
                record.get("room_name", ""),
                "당직자" if record.get("role_type") == "duty" else "담당자",
                record.get("person_name", ""),
                status.get("document", "이상 무"),
                status.get("cleaning", "이상 무"),
                status.get("lighting", "이상 무"),
                status.get("fire", "이상 무"),
                status.get("door", "이상 무"),
                record.get("remarks", ""),
                "이상 있음" if record.get("abnormal") else "이상 없음",
                "확인" if record.get("admin_verified") else "미확인",
                record.get("admin_verified_at", ""),
                "",
                "",
            ]
        )

    header_fill = PatternFill("solid", fgColor="E8EEF7")
    bad_fill = PatternFill("solid", fgColor="FFE5E5")
    thin = Side(style="thin", color="999999")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)
    for row in ws.iter_rows(min_row=2, max_row=ws.max_row, max_col=len(headers)):
        for cell in row:
            cell.border = border
            cell.alignment = Alignment(vertical="center", wrap_text=True)
        if row[10].value == "이상 있음":
            for cell in row:
                cell.fill = bad_fill
    for cell in ws[2]:
        cell.fill = header_fill
        cell.font = Font(bold=True)
        cell.alignment = Alignment(horizontal="center", vertical="center")

    widths = [12, 16, 10, 12, 15, 12, 12, 15, 12, 24, 12, 12, 20, 14, 14]
    for i, width in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = width
    ws.freeze_panes = "A3"
    wb.save(path)
    return path

