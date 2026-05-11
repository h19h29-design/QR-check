from __future__ import annotations

from app.qr_generator import build_submit_url, generate_qr_label_html, generate_qr_png


def test_build_submit_url():
    url = build_submit_url("https://script.google.com/macros/s/abc/exec", "room_1", "tok")
    assert "page=submit" in url
    assert "roomId=room_1" in url
    assert "submitToken=tok" in url


def test_generate_qr_png(tmp_path):
    path = generate_qr_png("https://example.com", tmp_path / "qr.png")
    assert path.exists()
    assert path.stat().st_size > 100


def test_generate_qr_label_html_uses_file_uri_and_escapes_text(tmp_path):
    qr = generate_qr_png("https://example.com", tmp_path / "qr.png")
    html_path = generate_qr_label_html([{"room_name": "과학실 <1>", "qr_path": qr}], tmp_path / "labels.html")
    text = html_path.read_text(encoding="utf-8")
    assert "file:///" in text
    assert "과학실 &lt;1&gt;" in text
