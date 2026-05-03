from __future__ import annotations

import json

from PySide6.QtCore import QUrl
from PySide6.QtGui import QDesktopServices
from PySide6.QtWidgets import QDialog, QLabel, QMessageBox, QPushButton, QTextEdit, QVBoxLayout

from app.config import AppConfig
from app.db import connect
from app.models import now_iso
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
            self.attachments = conn.execute(
                "SELECT item_key, file_name, drive_url, local_path FROM attachments WHERE record_id=? ORDER BY created_at",
                (record_id,),
            ).fetchall()
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
        layout.addWidget(QLabel("첨부파일"))
        if self.attachments:
            for attachment in self.attachments:
                label = attachment["file_name"] or attachment["item_key"] or "첨부파일"
                button = QPushButton(f"열기: {label}")
                button.clicked.connect(
                    lambda checked=False, url=attachment["drive_url"], path=attachment["local_path"]: self.open_attachment(url, path)
                )
                layout.addWidget(button)
        else:
            layout.addWidget(QLabel("첨부파일 없음"))
        self.memo = QTextEdit()
        self.memo.setPlaceholderText("관리자 메모")
        self.memo.setPlainText(self.record["admin_memo"] or "")
        layout.addWidget(self.memo)
        verify = QPushButton("관리자 확인")
        verify.clicked.connect(self.verify)
        layout.addWidget(verify)

    def open_attachment(self, drive_url: str, local_path: str = "") -> None:
        target = drive_url or local_path
        if not target:
            QMessageBox.information(self, "첨부파일", "열 수 있는 첨부파일 경로가 없습니다.")
            return
        QDesktopServices.openUrl(QUrl.fromUserInput(target))

    def verify(self) -> None:
        memo = self.memo.toPlainText()
        if self.config.apps_script_url and self.config.sync_key:
            try:
                AppsScriptClient(self.config.apps_script_url, self.config.sync_key).verify_record(self.record_id, memo)
            except Exception as exc:
                QMessageBox.warning(
                    self,
                    "Google 반영 실패",
                    "Google Sheet 반영에 실패해서 로컬 확인 처리도 보류했습니다.\n"
                    "네트워크와 Desktop Sync Key를 확인한 뒤 다시 시도하세요.\n\n"
                    + str(exc),
                )
                return
        now = now_iso()
        with connect(self.config.db_path) as conn:
            conn.execute(
                """
                UPDATE submissions
                SET admin_verified=1, admin_verified_by='desktop', admin_verified_at=?, admin_memo=?, updated_at=?
                WHERE record_id=?
                """,
                (now, memo, now, self.record_id),
            )
        self.accept()
