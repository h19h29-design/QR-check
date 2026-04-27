from __future__ import annotations

from PySide6.QtWidgets import QLabel, QPushButton, QTableWidget, QTableWidgetItem, QVBoxLayout, QWidget

from app.config import AppConfig
from app.db import connect
from app.qr_generator import build_submit_url, generate_qr_label_html, generate_qr_png
from .ui_helpers import configure_full_width_table


class QrPage(QWidget):
    def __init__(self, config: AppConfig) -> None:
        super().__init__()
        self.config = config
        layout = QVBoxLayout(self)
        title = QLabel("QR 생성")
        title.setStyleSheet("font-size: 20pt; font-weight: 700; padding: 4px 0;")
        layout.addWidget(title)
        self.info = QLabel("")
        self.info.setWordWrap(True)
        self.info.setStyleSheet("padding: 14px; background: #fff7ed; border: 1px solid #fed7aa;")
        layout.addWidget(self.info)

        gen = QPushButton("등록된 실 QR PNG와 A4 부착용 HTML 생성")
        gen.clicked.connect(self.generate_labels)
        layout.addWidget(gen)

        self.table = QTableWidget(0, 3)
        self.table.setHorizontalHeaderLabels(["실", "room_id", "QR 파일"])
        configure_full_width_table(self.table, hidden_columns=(1,))
        layout.addWidget(self.table)
        self._show_locations()

    def _show_locations(self) -> None:
        self.info.setText(
            f"QR 저장 폴더: {self.config.qr_dir}\n"
            f"A4 출력물 저장 폴더: {self.config.export_dir}\n"
            "저장 위치는 [설정] 메뉴에서 바꿀 수 있습니다. QR이 실제로 동작하려면 로컬 설정을 Google로 업로드한 뒤 생성하세요."
        )

    def generate_labels(self) -> None:
        self._show_locations()
        rows_for_html = []
        with connect(self.config.db_path) as conn:
            rooms = conn.execute(
                """
                SELECT r.room_id, r.room_name, t.submit_token
                FROM settings_rooms r
                LEFT JOIN room_submit_tokens_local t ON t.room_id = r.room_id
                WHERE r.active=1
                ORDER BY r.room_order, r.room_name
                """
            ).fetchall()
        self.config.qr_dir.mkdir(parents=True, exist_ok=True)
        self.config.export_dir.mkdir(parents=True, exist_ok=True)
        self.table.setRowCount(len(rooms))
        for r, room in enumerate(rooms):
            token = room["submit_token"] or "토큰_재발급_필요"
            url = build_submit_url(
                self.config.apps_script_url or "https://script.google.com/macros/s/DEPLOYMENT_ID/exec",
                room["room_id"],
                token,
            )
            png = generate_qr_png(url, self.config.qr_dir / f"{room['room_id']}.png")
            rows_for_html.append({"room_name": room["room_name"], "qr_path": png.as_posix()})
            self.table.setItem(r, 0, QTableWidgetItem(room["room_name"]))
            self.table.setItem(r, 1, QTableWidgetItem(room["room_id"]))
            self.table.setItem(r, 2, QTableWidgetItem(str(png)))
        output = generate_qr_label_html(rows_for_html, self.config.export_dir / "qr_labels.html")
        self.info.setText(f"생성 완료\nQR 저장 폴더: {self.config.qr_dir}\nA4 출력물: {output}")
