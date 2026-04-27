from __future__ import annotations

from PySide6.QtWidgets import QLabel, QComboBox, QHBoxLayout, QLineEdit, QMessageBox, QPushButton, QSpinBox, QTableWidget, QTableWidgetItem, QVBoxLayout, QWidget

from app.config import AppConfig
from app.db import connect
from app.migrations import add_person
from app.models import now_iso
from .ui_helpers import configure_full_width_table


class SettingsPeoplePage(QWidget):
    def __init__(self, config: AppConfig) -> None:
        super().__init__()
        self.config = config
        layout = QVBoxLayout(self)
        title = QLabel("담당자/당직자 관리")
        title.setStyleSheet("font-size: 20pt; font-weight: 700; padding: 4px 0;")
        layout.addWidget(title)
        notice = QLabel(
            "담당자와 당직자를 등록합니다. 실을 지정하지 않으면 전체 공통 인원으로 사용할 수 있습니다. "
            "표시순서는 선택 목록에 보이는 순서입니다. 숫자가 낮을수록 위에 보이며, 예를 들어 10번은 100번보다 먼저 표시됩니다."
        )
        notice.setWordWrap(True)
        notice.setStyleSheet("padding: 10px; background: #eef6ff; border: 1px solid #bfdbfe;")
        layout.addWidget(notice)

        controls = QHBoxLayout()
        self.person_name = QLineEdit()
        self.person_name.setPlaceholderText("이름")
        self.role_type = QComboBox()
        self.role_type.addItem("담당자", "responsible")
        self.role_type.addItem("당직자", "duty")
        self.room = QComboBox()
        self.sort_order = QSpinBox()
        self.sort_order.setRange(1, 999)
        self.sort_order.setValue(100)
        self.sort_order.setToolTip("낮은 숫자일수록 선택 목록에서 먼저 표시됩니다. 보통 10, 20, 30처럼 입력하면 나중에 끼워 넣기 쉽습니다.")
        add = QPushButton("추가")
        add.clicked.connect(self.add_person)
        controls.addWidget(QLabel("이름"))
        controls.addWidget(self.person_name, 2)
        controls.addWidget(QLabel("역할"))
        controls.addWidget(self.role_type, 1)
        controls.addWidget(QLabel("실"))
        controls.addWidget(self.room, 2)
        controls.addWidget(QLabel("표시순서"))
        controls.addWidget(self.sort_order, 1)
        controls.addWidget(add)
        layout.addLayout(controls)
        self.table = QTableWidget(0, 6)
        self.table.setHorizontalHeaderLabels(["person_id", "이름", "역할", "실", "사용", "삭제/복구"])
        configure_full_width_table(self.table, hidden_columns=(0,))
        layout.addWidget(self.table)
        self.load_rooms()
        self.refresh()

    def load_rooms(self) -> None:
        current = self.room.currentData() if hasattr(self, "room") else ""
        self.room.clear()
        self.room.addItem("전체", "")
        with connect(self.config.db_path) as conn:
            rows = conn.execute("SELECT room_id, room_name FROM settings_rooms WHERE active=1 ORDER BY room_order, room_name").fetchall()
        for row in rows:
            self.room.addItem(row["room_name"], row["room_id"])
        if current:
            index = self.room.findData(current)
            if index >= 0:
                self.room.setCurrentIndex(index)

    def refresh(self) -> None:
        self.load_rooms()
        with connect(self.config.db_path) as conn:
            rows = conn.execute(
                """
                SELECT p.*, COALESCE(r.room_name, '전체') room_label
                FROM settings_people p
                LEFT JOIN settings_rooms r ON r.room_id=p.room_id
                ORDER BY p.role_type, p.sort_order, p.person_name
                """
            ).fetchall()
        self.table.setRowCount(len(rows))
        for r, row in enumerate(rows):
            role = "당직자" if row["role_type"] == "duty" else "담당자"
            values = [row["person_id"], row["person_name"], role, row["room_label"], "사용" if row["active"] else "미사용"]
            for c, value in enumerate(values):
                self.table.setItem(r, c, QTableWidgetItem(str(value)))
            button = QPushButton("삭제" if row["active"] else "복구")
            button.clicked.connect(lambda checked=False, person_id=row["person_id"], active=row["active"]: self.toggle_active(person_id, active))
            self.table.setCellWidget(r, 5, button)

    def add_person(self) -> None:
        name = self.person_name.text().strip()
        if not name:
            return
        with connect(self.config.db_path) as conn:
            add_person(conn, name, self.role_type.currentData(), self.room.currentData() or "", self.sort_order.value())
        self.person_name.clear()
        self.refresh()

    def toggle_active(self, person_id: str, active: int) -> None:
        next_active = 0 if active else 1
        if active:
            ok = QMessageBox.question(self, "사용자 삭제", "선택한 담당자/당직자를 미사용 처리할까요?")
            if ok != QMessageBox.StandardButton.Yes:
                return
        with connect(self.config.db_path) as conn:
            conn.execute("UPDATE settings_people SET active=?, updated_at=? WHERE person_id=?", (next_active, now_iso(), person_id))
        self.refresh()
