from __future__ import annotations

import json

from PySide6.QtWidgets import QDialog, QLabel, QMessageBox, QPushButton, QTextEdit, QVBoxLayout

from app.config import AppConfig
from app.db import connect
from app.sync_client import AppsScriptClient


class DetailDialog(QDialog):
    def __init__(self, config: AppConfig, record_id: str, parent=None) -> None:
        super().__init__(parent)
        self.config = config
        self.record_id = record_id
        self.setWindowTitle("점검 상세보기")
        layout = QVBoxLayout(self)
        with connect(config.db_path) as conn:
            self.record = conn.execute("SELECT * FROM submissions WHERE record_id=?", (record_id,)).fetchone()
        if not self.record:
            layout.addWidget(QLabel("기록을 찾을 수 없습니다."))
            return
        status = self.record["status_json"]
        try:
            status_text = json.dumps(json.loads(status), ensure_ascii=False, indent=2)
        except Exception:
            status_text = status
        layout.addWidget(QLabel(f"실: {self.record['room_name']}"))
        layout.addWidget(QLabel(f"점검자: {self.record['person_name']}"))
        layout.addWidget(QLabel(f"제출일시: {self.record['submitted_at']}"))
        layout.addWidget(QLabel(f"이상여부: {'이상 있음' if self.record['abnormal'] else '이상 없음'}"))
        detail = QTextEdit()
        detail.setReadOnly(True)
        detail.setPlainText(f"점검상태:\n{status_text}\n\n특이사항:\n{self.record['remarks']}")
        layout.addWidget(detail)
        self.memo = QTextEdit()
        self.memo.setPlaceholderText("관리자 메모")
        self.memo.setPlainText(self.record["admin_memo"] or "")
        layout.addWidget(self.memo)
        verify = QPushButton("관리자 확인")
        verify.clicked.connect(self.verify)
        layout.addWidget(verify)

    def verify(self) -> None:
        with connect(self.config.db_path) as conn:
            conn.execute(
                """
                UPDATE submissions
                SET admin_verified=1, admin_verified_by='desktop', admin_verified_at=datetime('now', 'localtime'), admin_memo=?
                WHERE record_id=?
                """,
                (self.memo.toPlainText(), self.record_id),
            )
        if self.config.apps_script_url and self.config.sync_key:
            try:
                AppsScriptClient(self.config.apps_script_url, self.config.sync_key).verify_record(
                    self.record_id,
                    self.memo.toPlainText(),
                )
            except Exception as exc:
                QMessageBox.warning(
                    self,
                    "Google 반영 실패",
                    "로컬 확인 처리는 저장했지만 Google Sheet 반영에 실패했습니다.\n"
                    "네트워크와 Desktop Sync Key를 확인한 뒤 다시 동기화하세요.\n\n"
                    + str(exc),
                )
        self.accept()
