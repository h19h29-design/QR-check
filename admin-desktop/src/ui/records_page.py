from __future__ import annotations

from PySide6.QtCore import QDate
from PySide6.QtWidgets import (
    QComboBox,
    QDateEdit,
    QHBoxLayout,
    QLabel,
    QMessageBox,
    QPushButton,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)

from app.config import AppConfig
from app.db import connect
from app.models import now_iso
from app.sync_client import AppsScriptClient
from .detail_dialog import DetailDialog
from .ui_helpers import configure_full_width_table


class RecordsPage(QWidget):
    def __init__(self, config: AppConfig) -> None:
        super().__init__()
        self.config = config
        layout = QVBoxLayout(self)
        layout.setContentsMargins(10, 8, 10, 10)
        layout.setSpacing(8)

        controls = QHBoxLayout()
        controls.setSpacing(8)
        controls.addWidget(QLabel("시작일"))
        self.start_date = QDateEdit()
        self.start_date.setCalendarPopup(True)
        self.start_date.setDisplayFormat("yyyy-MM-dd")
        self.start_date.setDate(QDate.currentDate())
        self.start_date.setFixedWidth(132)
        controls.addWidget(self.start_date)

        controls.addWidget(QLabel("종료일"))
        self.end_date = QDateEdit()
        self.end_date.setCalendarPopup(True)
        self.end_date.setDisplayFormat("yyyy-MM-dd")
        self.end_date.setDate(QDate.currentDate())
        self.end_date.setFixedWidth(132)
        controls.addWidget(self.end_date)

        controls.addWidget(QLabel("실"))
        self.room_filter = QComboBox()
        self.room_filter.setFixedWidth(128)
        controls.addWidget(self.room_filter)

        controls.addWidget(QLabel("상태"))
        self.state_filter = QComboBox()
        self.state_filter.addItems(["전체", "이상 있음", "이상 없음", "미확인", "확인 완료"])
        self.state_filter.setFixedWidth(128)
        controls.addWidget(self.state_filter)

        refresh = QPushButton("조회")
        refresh.clicked.connect(self.refresh)
        controls.addWidget(refresh)

        bulk = QPushButton("조회 범위 이상 없음 일괄확인")
        bulk.clicked.connect(self.bulk_verify_normal)
        controls.addWidget(bulk)
        controls.addStretch(1)
        layout.addLayout(controls)

        self.table = QTableWidget(0, 7)
        self.table.setHorizontalHeaderLabels(["record_id", "제출일시", "실", "점검자", "역할", "이상여부", "관리자확인"])
        configure_full_width_table(self.table, hidden_columns=(0,))
        self.table.doubleClicked.connect(self.open_detail)
        layout.addWidget(self.table)

        self.load_rooms()
        self.refresh()

    def load_rooms(self) -> None:
        current = self.room_filter.currentData()
        self.room_filter.clear()
        self.room_filter.addItem("전체", "")
        with connect(self.config.db_path) as conn:
            rows = conn.execute("SELECT room_id, room_name FROM settings_rooms WHERE active=1 ORDER BY room_order, room_name").fetchall()
        for row in rows:
            self.room_filter.addItem(row["room_name"], row["room_id"])
        if current:
            index = self.room_filter.findData(current)
            if index >= 0:
                self.room_filter.setCurrentIndex(index)

    def _where(self) -> tuple[str, list[str]]:
        start = self.start_date.date().toString("yyyy-MM-dd")
        end = self.end_date.date().toString("yyyy-MM-dd")
        clauses = ["inspection_date BETWEEN ? AND ?"]
        params: list[str] = [start, end]
        room_id = self.room_filter.currentData()
        if room_id:
            clauses.append("room_id=?")
            params.append(room_id)
        state = self.state_filter.currentText()
        if state == "이상 있음":
            clauses.append("abnormal=1")
        elif state == "이상 없음":
            clauses.append("abnormal=0")
        elif state == "미확인":
            clauses.append("admin_verified=0")
        elif state == "확인 완료":
            clauses.append("admin_verified=1")
        return " AND ".join(clauses), params

    def refresh(self) -> None:
        self.load_rooms()
        where, params = self._where()
        with connect(self.config.db_path) as conn:
            rows = conn.execute(
                f"""
                SELECT record_id, submitted_at, room_name, person_name, role_type, abnormal, admin_verified
                FROM submissions
                WHERE {where}
                ORDER BY inspection_date DESC, room_name, submitted_at DESC
                """,
                params,
            ).fetchall()
        self.table.setRowCount(len(rows))
        for r, row in enumerate(rows):
            values = [
                row["record_id"],
                row["submitted_at"],
                row["room_name"],
                row["person_name"],
                "당직자" if row["role_type"] == "duty" else "담당자",
                "이상 있음" if row["abnormal"] else "이상 없음",
                "확인" if row["admin_verified"] else "미확인",
            ]
            for c, value in enumerate(values):
                self.table.setItem(r, c, QTableWidgetItem(str(value)))

    def open_detail(self) -> None:
        row = self.table.currentRow()
        if row < 0:
            return
        record_id = self.table.item(row, 0).text()
        dialog = DetailDialog(self.config, record_id, self)
        dialog.exec()
        self.refresh()

    def bulk_verify_normal(self) -> None:
        start = self.start_date.date().toString("yyyy-MM-dd")
        end = self.end_date.date().toString("yyyy-MM-dd")
        room_id = self.room_filter.currentData() or ""
        clauses = ["inspection_date BETWEEN ? AND ?"]
        params: list[str] = [start, end]
        if room_id:
            clauses.append("room_id=?")
            params.append(room_id)
        where = " AND ".join(clauses)
        if self.config.apps_script_url and self.config.sync_key:
            try:
                AppsScriptClient(self.config.apps_script_url, self.config.sync_key).bulk_verify_normal(start, end, room_id)
            except Exception as exc:
                QMessageBox.warning(
                    self,
                    "Google 반영 실패",
                    "Google Sheet 반영에 실패해서 로컬 일괄확인도 보류했습니다.\n"
                    "네트워크와 Desktop Sync Key를 확인한 뒤 다시 시도하세요.\n\n"
                    + str(exc),
                )
                return
        now = now_iso()
        with connect(self.config.db_path) as conn:
            conn.execute(
                f"""
                UPDATE submissions
                SET admin_verified=1, admin_verified_by='desktop', admin_verified_at=?, updated_at=?
                WHERE {where} AND abnormal=0 AND admin_verified=0
                """,
                [now, now, *params],
            )
        self.refresh()
