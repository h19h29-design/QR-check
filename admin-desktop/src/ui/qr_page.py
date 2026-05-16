from __future__ import annotations

from PySide6.QtWidgets import QLabel, QMessageBox, QPushButton, QTableWidget, QTableWidgetItem, QVBoxLayout, QWidget

from app.config import AppConfig, STORAGE_MODE_SUPABASE
from app.db import connect
from app.qr_generator import build_submit_url, build_supabase_submit_url, generate_qr_label_html, generate_qr_png
from app.security import DPAPI_PREFIX, unprotect_local_secret
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
        configure_full_width_table(
            self.table,
            hidden_columns=(1,),
            column_widths={0: 280},
            stretch_columns=(2,),
        )
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
        if self.config.normalized_storage_mode == STORAGE_MODE_SUPABASE:
            if not self.config.supabase_submit_url or not self.config.supabase_org_code:
                QMessageBox.warning(self, "QR 생성 불가", "[설정]에서 Supabase 제출 페이지 주소와 학교 코드를 먼저 입력하고 저장하세요.")
                return
        elif not self.config.apps_script_url:
            QMessageBox.warning(self, "QR 생성 불가", "[설정]에서 Apps Script Web App URL을 먼저 입력하고 저장하세요.")
            return
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
        if not rooms:
            QMessageBox.information(self, "QR 생성", "등록된 실이 없습니다. [실 관리]에서 실을 먼저 추가하세요.")
            return
        missing = []
        prepared = []
        for room in rooms:
            token = unprotect_local_secret(room["submit_token"] or "")
            if not token or token.startswith(DPAPI_PREFIX):
                missing.append(room["room_name"])
            else:
                prepared.append((room, token))
        if missing:
            QMessageBox.warning(
                self,
                "QR 생성 불가",
                "다음 실은 이 PC에 QR 원본 토큰이 없어 QR을 만들 수 없습니다.\n"
                "실을 이 관리자 프로그램에서 다시 추가하거나 토큰을 재발급한 뒤 Google 업로드를 진행하세요.\n\n"
                + "\n".join(missing),
            )
            return
        self.config.qr_dir.mkdir(parents=True, exist_ok=True)
        self.config.export_dir.mkdir(parents=True, exist_ok=True)
        self.table.setRowCount(len(prepared))
        for r, (room, token) in enumerate(prepared):
            if self.config.normalized_storage_mode == STORAGE_MODE_SUPABASE:
                url = build_supabase_submit_url(
                    self.config.supabase_submit_url,
                    room["room_id"],
                    token,
                    self.config.supabase_org_code,
                )
            else:
                url = build_submit_url(
                    self.config.apps_script_url,
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
