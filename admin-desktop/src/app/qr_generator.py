from __future__ import annotations

from pathlib import Path
from urllib.parse import urlencode

import qrcode


def build_submit_url(apps_script_url: str, room_id: str, submit_token: str) -> str:
    query = urlencode({"page": "submit", "roomId": room_id, "submitToken": submit_token})
    separator = "&" if "?" in apps_script_url else "?"
    return f"{apps_script_url}{separator}{query}"


def generate_qr_png(url: str, output_path: str | Path) -> Path:
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    qr = qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=10, border=4)
    qr.add_data(url)
    qr.make(fit=True)
    image = qr.make_image(fill_color="black", back_color="white")
    image.save(path)
    return path


def generate_qr_label_html(rows: list[dict], output_path: str | Path) -> Path:
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    cards = []
    for row in rows:
        cards.append(
            f"""
            <section class="card">
              <h2>{row.get('room_name', '')}</h2>
              <img src="{row.get('qr_path', '')}" alt="QR 코드">
              <p>퇴실 전 QR을 스캔하고 보안점검표를 제출해 주세요.</p>
            </section>
            """
        )
    html = f"""<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>QR 코드 부착용 출력물</title>
<style>
@page {{ size: A4; margin: 12mm; }}
body {{ font-family: 'Malgun Gothic', sans-serif; margin: 0; color: #111; }}
.grid {{ display: grid; grid-template-columns: repeat(2, 1fr); gap: 12mm; }}
.card {{ border: 1px solid #111; padding: 10mm; min-height: 115mm; text-align: center; break-inside: avoid; }}
h1 {{ font-size: 18pt; margin: 0 0 8mm; }}
h2 {{ font-size: 16pt; margin: 0 0 8mm; }}
img {{ width: 54mm; height: 54mm; object-fit: contain; }}
p {{ font-size: 11pt; line-height: 1.5; }}
</style>
</head>
<body>
<h1>QR보안점검표 부착용</h1>
<main class="grid">{''.join(cards)}</main>
</body>
</html>"""
    path.write_text(html, encoding="utf-8")
    return path

