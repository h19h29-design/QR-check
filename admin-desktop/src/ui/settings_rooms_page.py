from __future__ import annotations

from PySide6.QtWidgets import QLabel, QHBoxLayout, QLineEdit, QMessageBox, QPushButton, QSpinBox, QTableWidget, QTableWidgetItem, QVBoxLayout, QWidget

from app.config import AppConfig
from app.db import connect
from app.migrations import add_room
from app.models import now_iso
from .ui_helpers import configure_full_width_table


class SettingsRoomsPage(QWidget):
    def __init__(self, config: AppConfig) -> None:
        super().__init__()
        self.config = config
        layout = QVBoxLayout(self)
        title = QLabel("실 관리")
        title.setStyleSheet("font-size: 20pt; font-weight: 700; padding: 4px 0;")
        layout.addWidget(title)
        notice = QLabel(
            "실을 추가하면 room_id와 submit_token이 자동 생성됩니다. 표시순서는 목록에 보이는 순서입니다. "
            "숫자가 낮을수록 위에 보이며, 예를 들어 10번은 100번보다 먼저 표시됩니다. "
            "추가 후 [설정]에서 Google 업로드, [QR 생성]에서 QR 출력을 진행하세요."
        )
        notice.setWordWrap(True)
        notice.setStyleSheet("padding: 10px; background: #fff7ed; border: 1px solid #fed7aa;")
        layout.addWidget(notice)

        controls = QHBoxLayout()
        self.room_name = QLineEdit()
        self.room_name.setPlaceholderText("예: 교무실")
        self.room_order = QSpinBox()
        self.room_order.setRange(1, 999)
        self.room_order.setValue(100)
        self.room_order.setToolTip("낮은 숫자일수록 목록과 점검표에서 먼저 표시됩니다. 보통 10, 20, 30처럼 입력하면 나중에 끼워 넣기 쉽습니다.")
        controls.addWidget(QLabel("실명"))
        controls.addWidget(self.room_name, 3)
        controls.addWidget(QLabel("표시순서"))
        controls.addWidget(self.room_order, 1)
        add = QPushButton("실 추가")
        add.clicked.connect(self.add_room)
        controls.addWidget(add)
        refresh = QPushButton("새로고침")
        refresh.clicked.connect(self.refresh)
        controls.addWidget(refresh)
        layout.addLayout(controls)
        self.table = QTableWidget(0, 6)
        self.table.setHorizontalHeaderLabels(["room_id", "실명", "표시순서", "사용", "token hash", "삭제/복구"])
        configure_full_width_table(
            self.table,
            hidden_columns=(0, 4),
            column_widths={2: 100, 3: 80, 5: 120},
            stretch_columns=(1,),
        )
        layout.addWidget(self.table)
        self.refresh()

    def refresh(self) -> None:
        with connect(self.config.db_path) as conn:
            rows = conn.execute("SELECT * FROM settings_rooms ORDER BY room_order, room_name").fetchall()
        self.table.setRowCount(len(rows))
        for r, row in enumerate(rows):
            for c, key in enumerate(["room_id", "room_name", "room_order", "active", "submit_token_hash"]):
                value = row[key]
                if key == "active":
                    value = "사용" if row[key] else "미사용"
                self.table.setItem(r, c, QTableWidgetItem(str(value)))
            button = QPushButton("삭제" if row["active"] else "복구")
            button.clicked.connect(lambda checked=False, room_id=row["room_id"], active=row["active"]: self.toggle_active(room_id, active))
            self.table.setCellWidget(r, 5, button)

    def add_room(self) -> None:
        name = self.room_name.text().strip()
        if not name:
            return
        with connect(self.config.db_path) as conn:
            add_room(conn, name, self.room_order.value())
        self.room_name.clear()
        self.refresh()

    def toggle_active(self, room_id: str, active: int) -> None:
        next_active = 0 if active else 1
        if active:
            ok = QMessageBox.question(
                self,
                "실 삭제",
                "선택한 실을 미사용 처리할까요?\n이미 생성된 QR은 더 이상 사용하지 않는 것을 권장합니다.",
            )
            if ok != QMessageBox.StandardButton.Yes:
                return
        with connect(self.config.db_path) as conn:
            conn.execute("UPDATE settings_rooms SET active=?, updated_at=? WHERE room_id=?", (next_active, now_iso(), room_id))
        self.refresh()
