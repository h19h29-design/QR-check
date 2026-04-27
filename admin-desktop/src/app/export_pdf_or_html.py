from __future__ import annotations

import json
from pathlib import Path


ITEM_LABELS = {
    "document": "서류보관상태",
    "cleaning": "청소상태",
    "lighting": "소등상태",
    "fire": "화기단속상태",
    "door": "문단속상태",
}


def export_printable_html(records: list[dict], output_path: str | Path, school_name: str = "") -> Path:
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    rows = []
    for record in records:
        status = record.get("status_json", {})
        if isinstance(status, str):
            try:
                status = json.loads(status)
            except json.JSONDecodeError:
                status = {}
        item_cells = "".join(f"<td>{status.get(key, '이상 무')}</td>" for key in ITEM_LABELS)
        rows.append(
            f"""
            <tr class="{'bad' if record.get('abnormal') else ''}">
              <td>{record.get('inspection_date', '')}</td>
              <td>{record.get('room_name', '')}</td>
              <td>{record.get('person_name', '')}</td>
              {item_cells}
              <td>{record.get('remarks', '')}</td>
              <td>{'확인' if record.get('admin_verified') else '미확인'}<br>{record.get('admin_verified_at', '')}</td>
              <td class="sign"></td>
              <td class="sign"></td>
            </tr>
            """
        )
    item_headers = "".join(f"<th>{label}</th>" for label in ITEM_LABELS.values())
    html = f"""<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>보안점검표 출력</title>
<style>
@page {{ size: A4 landscape; margin: 10mm; }}
body {{ font-family: 'Malgun Gothic', sans-serif; color: #111; }}
h1 {{ text-align: center; margin: 0 0 8mm; font-size: 18pt; }}
.meta {{ display: flex; justify-content: space-between; margin-bottom: 4mm; font-size: 10pt; }}
table {{ width: 100%; border-collapse: collapse; table-layout: fixed; }}
th, td {{ border: 1px solid #333; padding: 5px; font-size: 9pt; text-align: center; vertical-align: middle; word-break: keep-all; }}
th {{ background: #f1f3f5; }}
td:nth-child(9) {{ text-align: left; }}
.bad td {{ background: #fff0f0; }}
.sign {{ height: 34px; }}
</style>
</head>
<body>
<h1>보안점검표</h1>
<div class="meta"><span>기관명: {school_name}</span><span>출력일: <script>document.write(new Date().toLocaleDateString())</script></span></div>
<table>
<thead>
<tr><th>점검일</th><th>실명</th><th>점검자</th>{item_headers}<th>특이사항</th><th>관리자 확인</th><th>담당자 서명</th><th>관리자 서명</th></tr>
</thead>
<tbody>{''.join(rows)}</tbody>
</table>
</body>
</html>"""
    path.write_text(html, encoding="utf-8")
    return path

