from __future__ import annotations

import uuid

from PySide6.QtWidgets import QLabel, QHBoxLayout, QLineEdit, QMessageBox, QPushButton, QSpinBox, QTableWidget, QTableWidgetItem, QVBoxLayout, QWidget

from app.config import AppConfig
from app.db import connect
from app.models import now_iso
from .ui_helpers import configure_full_width_table


class SettingsItemsPage(QWidget):
    def __init__(self, config: AppConfig) -> None:
        super().__init__()
        self.config = config
        layout = QVBoxLayout(self)
        title = QLabel("점검항목 관리")
        title.setStyleSheet("font-size: 20pt; font-weight: 700; padding: 4px 0;")
        layout.addWidget(title)
        notice = QLabel(
            "점검항목은 모바일 점검표에 표시되는 순서대로 정렬됩니다. 표시순서는 점검표에 보이는 순서입니다. "
            "숫자가 낮을수록 위에 보이며, 예를 들어 10번은 100번보다 먼저 표시됩니다. "
            "추가 후 [설정]에서 Google 업로드를 누르세요."
        )
        notice.setWordWrap(True)
        notice.setStyleSheet("padding: 10px; background: #f8fafc; border: 1px solid #cfd8e3;")
        layout.addWidget(notice)

        controls = QHBoxLayout()
        self.item_name = QLineEdit()
        self.item_name.setPlaceholderText("예: 창문잠금상태")
        self.sort_order = QSpinBox()
        self.sort_order.setRange(1, 999)
        self.sort_order.setValue(100)
        self.sort_order.setToolTip("낮은 숫자일수록 모바일 점검표에서 먼저 표시됩니다. 보통 10, 20, 30처럼 입력하면 나중에 끼워 넣기 쉽습니다.")
        add = QPushButton("점검항목 추가")
        add.clicked.connect(self.add_item)
        controls.addWidget(QLabel("항목명"))
        controls.addWidget(self.item_name, 3)
        controls.addWidget(QLabel("표시순서"))
        controls.addWidget(self.sort_order, 1)
        controls.addWidget(add)
        layout.addLayout(controls)
        self.table = QTableWidget(0, 6)
        self.table.setHorizontalHeaderLabels(["item_id", "키", "항목명", "표시순서", "사용", "삭제/복구"])
        configure_full_width_table(
            self.table,
            hidden_columns=(0, 1),
            column_widths={3: 100, 4: 80, 5: 120},
            stretch_columns=(2,),
        )
        layout.addWidget(self.table)
        self.refresh()

    def refresh(self) -> None:
        with connect(self.config.db_path) as conn:
            rows = conn.execute("SELECT * FROM settings_check_items ORDER BY sort_order").fetchall()
        self.table.setRowCount(len(rows))
        for r, row in enumerate(rows):
            for c, key in enumerate(["item_id", "item_key", "item_name", "sort_order", "active"]):
                value = row[key]
                if key == "active":
                    value = "사용" if row[key] else "미사용"
                self.table.setItem(r, c, QTableWidgetItem(str(value)))
            button = QPushButton("삭제" if row["active"] else "복구")
            button.clicked.connect(lambda checked=False, item_id=row["item_id"], active=row["active"]: self.toggle_active(item_id, active))
            self.table.setCellWidget(r, 5, button)

    def add_item(self) -> None:
        name = self.item_name.text().strip()
        if not name:
            return
        key = f"custom_{uuid.uuid4().hex[:8]}"
        now = now_iso()
        with connect(self.config.db_path) as conn:
            conn.execute(
                """
                INSERT INTO settings_check_items(item_id, item_key, item_name, sort_order, active, created_at, updated_at)
                VALUES (?, ?, ?, ?, 1, ?, ?)
                """,
                (f"item_{uuid.uuid4().hex[:12]}", key, name, self.sort_order.value(), now, now),
            )
        self.item_name.clear()
        self.refresh()

    def toggle_active(self, item_id: str, active: int) -> None:
        next_active = 0 if active else 1
        if active:
            ok = QMessageBox.question(self, "점검항목 삭제", "선택한 점검항목을 미사용 처리할까요?")
            if ok != QMessageBox.StandardButton.Yes:
                return
        with connect(self.config.db_path) as conn:
            conn.execute("UPDATE settings_check_items SET active=?, updated_at=? WHERE item_id=?", (next_active, now_iso(), item_id))
        self.refresh()
