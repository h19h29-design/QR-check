from __future__ import annotations

from collections.abc import Callable
from datetime import date

from PySide6.QtWidgets import (
    QGridLayout,
    QHBoxLayout,
    QFrame,
    QLabel,
    QPushButton,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)

from app.config import AppConfig
from app.db import connect
from .ui_helpers import configure_full_width_table


class DashboardPage(QWidget):
    def __init__(self, config: AppConfig, navigate: Callable[[str], None] | None = None) -> None:
        super().__init__()
        self.config = config
        self.navigate = navigate

        layout = QVBoxLayout(self)
        layout.setSpacing(10)

        title = QLabel("오늘 점검 상황판")
        title.setStyleSheet("font-size: 20pt; font-weight: 900; padding: 2px 0; color: #111827;")
        layout.addWidget(title)

        self.steps = QHBoxLayout()
        for i, label in enumerate(["1 설정 저장", "2 실/담당자 등록", "3 Google 업로드", "4 QR 생성", "5 테스트 제출"], start=1):
            step = QLabel(label)
            step.setAlignment(QtAlignCenter())
            step.setStyleSheet(
                "font-size: 11pt; font-weight: 700; padding: 8px; border: 1px solid #cfd8e3; "
                + ("background: #e7f2ee; color: #14523e;" if i <= 2 else "background: #ffffff; color: #334155;")
            )
            self.steps.addWidget(step)
        layout.addLayout(self.steps)

        quick = QGridLayout()
        quick.setHorizontalSpacing(12)
        quick.setVerticalSpacing(12)
        quick_labels = ["점검기록", "실 관리", "담당자/당직자 관리", "QR 생성", "출력/보관", "설정"]
        for index, label in enumerate(quick_labels):
            button = QPushButton(label)
            button.setMinimumHeight(56)
            button.setStyleSheet(
                "font-size: 13pt; font-weight: 900; text-align: left; padding: 10px 12px; "
                "background: #ffffff; border: 1px solid #cfd8e3; border-radius: 8px;"
            )
            button.clicked.connect(lambda checked=False, page=label: self.navigate(page) if self.navigate else None)
            quick.addWidget(button, index // 3, index % 3)
        layout.addLayout(quick)

        self.summary = QGridLayout()
        layout.addLayout(self.summary)

        self.room_grid = QGridLayout()
        layout.addWidget(QLabel("실별 상태"))
        layout.addLayout(self.room_grid)

        self.priority = QTableWidget(0, 4)
        self.priority.setHorizontalHeaderLabels(["우선확인", "실", "내용", "제출일시"])
        configure_full_width_table(self.priority)
        layout.addWidget(QLabel("우선 확인 목록"))
        layout.addWidget(self.priority)

        self.table = QTableWidget(0, 5)
        self.table.setHorizontalHeaderLabels(["제출일시", "실", "점검자", "이상여부", "확인"])
        configure_full_width_table(self.table)
        layout.addWidget(QLabel("최근 제출 기록"))
        layout.addWidget(self.table)

        refresh = QPushButton("새로고침")
        refresh.clicked.connect(self.refresh)
        layout.addWidget(refresh)
        self.refresh()

    def refresh(self) -> None:
        today = date.today().isoformat()
        with connect(self.config.db_path) as conn:
            row = conn.execute(
                """
                SELECT
                  COUNT(*) total,
                  SUM(CASE WHEN abnormal=1 THEN 1 ELSE 0 END) abnormal_count,
                  SUM(CASE WHEN admin_verified=0 THEN 1 ELSE 0 END) unverified_count,
                  SUM(CASE WHEN admin_verified=1 THEN 1 ELSE 0 END) verified_count
                FROM submissions WHERE inspection_date=?
                """,
                (today,),
            ).fetchone()
            latest = conn.execute(
                """
                SELECT submitted_at, room_name, person_name, abnormal, admin_verified
                FROM submissions
                ORDER BY submitted_at DESC
                LIMIT 20
                """
            ).fetchall()
            room_rows = conn.execute(
                """
                SELECT r.room_name,
                       COUNT(s.record_id) submitted_count,
                       SUM(CASE WHEN s.abnormal=1 THEN 1 ELSE 0 END) abnormal_count,
                       SUM(CASE WHEN s.admin_verified=0 THEN 1 ELSE 0 END) unverified_count
                FROM settings_rooms r
                LEFT JOIN submissions s ON s.room_id=r.room_id AND s.inspection_date=?
                WHERE r.active=1
                GROUP BY r.room_id, r.room_name, r.room_order
                ORDER BY r.room_order, r.room_name
                LIMIT 12
                """,
                (today,),
            ).fetchall()
            priority = conn.execute(
                """
                SELECT submitted_at, room_name, person_name, abnormal, admin_verified, remarks
                FROM submissions
                WHERE inspection_date=? AND (abnormal=1 OR admin_verified=0)
                ORDER BY abnormal DESC, submitted_at DESC
                LIMIT 10
                """,
                (today,),
            ).fetchall()

        while self.summary.count():
            child = self.summary.takeAt(0)
            if child.widget():
                child.widget().deleteLater()
        while self.room_grid.count():
            child = self.room_grid.takeAt(0)
            if child.widget():
                child.widget().deleteLater()

        cards = [
            ("오늘 전체", row["total"] or 0),
            ("이상 있음", row["abnormal_count"] or 0),
            ("미확인", row["unverified_count"] or 0),
            ("확인 완료", row["verified_count"] or 0),
        ]
        for i, (label, value) in enumerate(cards):
            title = QLabel(f"{label}\n{value}")
            title.setAlignment(QtAlignCenter())
            title.setStyleSheet(
                "font-size: 16pt; font-weight: 900; padding: 12px; border: 1px solid #d0d7de; "
                "background: #ffffff; color: #111827; border-radius: 8px;"
            )
            self.summary.addWidget(title, 0, i)

        if room_rows:
            for i, item in enumerate(room_rows):
                submitted = item["submitted_count"] or 0
                abnormal = item["abnormal_count"] or 0
                unverified = item["unverified_count"] or 0
                if abnormal:
                    label = "이상 있음"
                    color = "#fee4e2"
                    ink = "#991b1b"
                elif submitted and unverified:
                    label = "미확인"
                    color = "#fff7ed"
                    ink = "#9a3412"
                elif submitted:
                    label = "완료"
                    color = "#dcfce7"
                    ink = "#166534"
                else:
                    label = "미제출"
                    color = "#f1f5f9"
                    ink = "#475569"
                room = QLabel(f"{item['room_name']}\n{label}")
                room.setAlignment(QtAlignCenter())
                room.setStyleSheet(
                    f"font-size: 12pt; font-weight: 800; padding: 10px; border: 1px solid #cfd8e3; "
                    f"background: {color}; color: {ink};"
                )
                self.room_grid.addWidget(room, i // 4, i % 4)
        else:
            empty = QLabel("등록된 실이 없습니다. [실 관리]에서 먼저 실을 추가하세요.")
            empty.setStyleSheet("padding: 18px; background: #fff7ed; border: 1px solid #fed7aa;")
            self.room_grid.addWidget(empty, 0, 0)

        self.priority.setRowCount(len(priority))
        for r, item in enumerate(priority):
            values = [
                "이상 있음" if item["abnormal"] else "미확인",
                item["room_name"],
                item["remarks"] or ("관리자 확인 대기" if not item["admin_verified"] else ""),
                item["submitted_at"],
            ]
            for c, value in enumerate(values):
                self.priority.setItem(r, c, QTableWidgetItem(str(value)))

        self.table.setRowCount(len(latest))
        for r, item in enumerate(latest):
            self.table.setItem(r, 0, QTableWidgetItem(item["submitted_at"]))
            self.table.setItem(r, 1, QTableWidgetItem(item["room_name"]))
            self.table.setItem(r, 2, QTableWidgetItem(item["person_name"]))
            self.table.setItem(r, 3, QTableWidgetItem("이상 있음" if item["abnormal"] else "이상 없음"))
            self.table.setItem(r, 4, QTableWidgetItem("확인" if item["admin_verified"] else "미확인"))


def QtAlignCenter():
    from PySide6.QtCore import Qt

    return Qt.AlignCenter
