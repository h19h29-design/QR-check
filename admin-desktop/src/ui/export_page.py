from __future__ import annotations

from html import escape

from PySide6.QtCore import QDate
from PySide6.QtWidgets import (
    QComboBox,
    QDateEdit,
    QFileDialog,
    QGridLayout,
    QLabel,
    QMessageBox,
    QPushButton,
    QTableWidget,
    QTableWidgetItem,
    QTextEdit,
    QVBoxLayout,
    QWidget,
)

from app.config import AppConfig, STORAGE_MODE_SUPABASE
from app.db import connect, rows_to_dicts
from app.export_excel import export_security_check_xlsx
from app.export_hwp import export_hwp_or_fallback
from app.export_pdf_or_html import export_printable_html
from app.security import safe_filename
from app.supabase_backup import create_supabase_backup
from app.sync_client import create_storage_client, is_storage_configured
from .ui_helpers import configure_full_width_table


class ExportPage(QWidget):
    def __init__(self, config: AppConfig) -> None:
        super().__init__()
        self.config = config
        layout = QVBoxLayout(self)
        layout.setContentsMargins(10, 8, 10, 10)
        layout.setSpacing(8)
        title = QLabel("출력/보관")
        title.setStyleSheet("font-size: 20pt; font-weight: 900; padding: 0 0 4px 0; color: #111827;")
        layout.addWidget(title)

        controls = QGridLayout()
        controls.setHorizontalSpacing(8)
        controls.setVerticalSpacing(8)
        controls.addWidget(QLabel("시작일"), 0, 0)
        self.start_date = QDateEdit()
        self.start_date.setCalendarPopup(True)
        self.start_date.setDisplayFormat("yyyy-MM-dd")
        self.start_date.setDate(QDate.currentDate())
        self.start_date.setFixedWidth(132)
        controls.addWidget(self.start_date, 0, 1)

        controls.addWidget(QLabel("종료일"), 0, 2)
        self.end_date = QDateEdit()
        self.end_date.setCalendarPopup(True)
        self.end_date.setDisplayFormat("yyyy-MM-dd")
        self.end_date.setDate(QDate.currentDate())
        self.end_date.setFixedWidth(132)
        controls.addWidget(self.end_date, 0, 3)

        controls.addWidget(QLabel("실"), 0, 4)
        self.room_filter = QComboBox()
        self.room_filter.setFixedWidth(150)
        controls.addWidget(self.room_filter, 0, 5)

        preview = QPushButton("조회/미리보기")
        preview.clicked.connect(self.refresh_preview)
        xlsx = QPushButton("엑셀 출력")
        xlsx.clicked.connect(self.export_xlsx)
        html = QPushButton("HTML 인쇄 출력")
        html.clicked.connect(self.export_html)
        hwp = QPushButton("HWP 출력 또는 fallback")
        hwp.clicked.connect(self.export_hwp)
        backup = QPushButton("Supabase 백업 생성")
        backup.clicked.connect(self.backup_supabase)
        controls.addWidget(preview, 1, 0, 1, 2)
        controls.addWidget(xlsx, 1, 2)
        controls.addWidget(html, 1, 3)
        controls.addWidget(hwp, 1, 4, 1, 2)
        controls.addWidget(backup, 2, 0, 1, 2)
        controls.setColumnStretch(6, 1)
        layout.addLayout(controls)

        self.table = QTableWidget(0, 6)
        self.table.setHorizontalHeaderLabels(["점검일", "실", "점검자", "역할", "이상여부", "확인"])
        configure_full_width_table(self.table)
        layout.addWidget(self.table, 2)

        self.status = QLabel("")
        self.status.setWordWrap(True)
        self.status.setStyleSheet("padding: 12px; background: #eef6ff; border: 1px solid #bfdbfe; border-radius: 8px;")
        layout.addWidget(self.status)

        preview_label = QLabel("출력물 미리보기")
        preview_label.setStyleSheet("font-weight: 800; padding-top: 4px;")
        layout.addWidget(preview_label)
        self.preview = QTextEdit()
        self.preview.setReadOnly(True)
        self.preview.setMinimumHeight(320)
        self.preview.setStyleSheet(
            "background: #ffffff; border: 1px solid #94a3b8; border-radius: 8px; "
            "padding: 18px;"
        )
        layout.addWidget(self.preview, 3)
        self.load_rooms()
        self.refresh_preview()

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

    def _records(self) -> list[dict]:
        self.load_rooms()
        start = self.start_date.date().toString("yyyy-MM-dd")
        end = self.end_date.date().toString("yyyy-MM-dd")
        clauses = ["inspection_date BETWEEN ? AND ?"]
        params: list[str] = [start, end]
        room_id = self.room_filter.currentData()
        if room_id:
            clauses.append("room_id=?")
            params.append(room_id)
        with connect(self.config.db_path) as conn:
            rows = conn.execute(
                f"""
                SELECT * FROM submissions
                WHERE {' AND '.join(clauses)}
                ORDER BY inspection_date, room_name, submitted_at
                """,
                params,
            ).fetchall()
            return rows_to_dicts(rows)

    def _items(self) -> list[dict]:
        with connect(self.config.db_path) as conn:
            rows = conn.execute(
                "SELECT item_key, item_name, sort_order, active FROM settings_check_items WHERE active=1 ORDER BY sort_order, item_name"
            ).fetchall()
            return rows_to_dicts(rows)

    def refresh_preview(self) -> None:
        records = self._records()
        self.table.setRowCount(len(records))
        for r, record in enumerate(records):
            values = [
                record.get("inspection_date", ""),
                record.get("room_name", ""),
                record.get("person_name", ""),
                "당직자" if record.get("role_type") == "duty" else "담당자",
                "이상 있음" if record.get("abnormal") else "이상 없음",
                "확인" if record.get("admin_verified") else "미확인",
            ]
            for c, value in enumerate(values):
                self.table.setItem(r, c, QTableWidgetItem(str(value)))
        self.preview.setHtml(self._preview_html(records))
        self.status.setText(f"조회 결과 {len(records)}건 | 저장 위치: {self.config.export_dir}")

    def _preview_html(self, records: list[dict]) -> str:
        rows = []
        for record in records[:12]:
            abnormal = bool(record.get("abnormal"))
            rows.append(
                "<tr>"
                f"<td>{escape(str(record.get('inspection_date', '')))}</td>"
                f"<td>{escape(str(record.get('room_name', '')))}</td>"
                f"<td>{escape(str(record.get('person_name', '')))}</td>"
                f"<td style='color:{'#b91c1c' if abnormal else '#047857'};font-weight:700'>"
                f"{'이상 있음' if abnormal else '이상 없음'}</td>"
                f"<td>{'확인' if record.get('admin_verified') else '미확인'}</td>"
                "</tr>"
            )
        return f"""
        <html><body style="font-family:'Malgun Gothic'; color:#111827;">
        <h1 style="text-align:center;">보안점검표</h1>
        <p>기관명: {escape(self.config.school_name or '학교명 미설정')}</p>
        <p>조회 범위: {self.start_date.date().toString('yyyy-MM-dd')} ~ {self.end_date.date().toString('yyyy-MM-dd')}</p>
        <table width="100%" cellspacing="0" cellpadding="8" style="border-collapse:collapse;">
        <tr style="background:#eef2f7;"><th>날짜</th><th>실</th><th>점검자</th><th>상태</th><th>관리자</th></tr>
        {''.join(rows) if rows else '<tr><td colspan="5">조회된 점검 기록이 없습니다.</td></tr>'}
        </table>
        <p style="margin-top:24px;">담당자 서명: ____________________</p>
        <p>관리자 서명: ____________________</p>
        </body></html>
        """

    def _file_stem(self) -> str:
        start = self.start_date.date().toString("yyyyMMdd")
        end = self.end_date.date().toString("yyyyMMdd")
        room = self.room_filter.currentText()
        room_part = "" if room == "전체" else f"_{room}"
        return safe_filename(f"보안점검표_{start}_{end}{room_part}", "보안점검표")

    def export_xlsx(self) -> None:
        path = export_security_check_xlsx(self._records(), self.config.export_dir / f"{self._file_stem()}.xlsx", items=self._items())
        self.status.setText(f"엑셀 생성 완료: {path}")
        self.refresh_preview()

    def export_html(self) -> None:
        path = export_printable_html(self._records(), self.config.export_dir / f"{self._file_stem()}.html", self.config.school_name, self._items())
        self.status.setText(f"HTML 생성 완료: {path}")
        self.refresh_preview()

    def export_hwp(self) -> None:
        path = export_hwp_or_fallback(self._records(), self.config.export_dir / f"{self._file_stem()}.hwp", self.config.school_name, self._items())
        self.status.setText(f"출력 생성 완료: {path}")
        self.refresh_preview()

    def backup_supabase(self) -> None:
        if self.config.normalized_storage_mode != STORAGE_MODE_SUPABASE:
            QMessageBox.information(self, "Supabase 백업", "Supabase 저장소 모드에서만 사용할 수 있습니다.")
            return
        if not is_storage_configured(self.config):
            QMessageBox.warning(self, "Supabase 백업", "Supabase 주소, anon key, 학교 코드, Desktop Sync Key를 먼저 설정하세요.")
            return
        selected = QFileDialog.getExistingDirectory(self, "Supabase 백업 저장 폴더 선택", str(self.config.export_dir))
        if not selected:
            return
        try:
            path = create_supabase_backup(create_storage_client(self.config, timeout=60), selected)
        except Exception as exc:
            QMessageBox.warning(self, "Supabase 백업 실패", str(exc))
            return
        self.status.setText(f"Supabase 백업 생성 완료: {path}")
