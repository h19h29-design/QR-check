from __future__ import annotations

import logging

from PySide6.QtCore import QObject, Qt, QThread, QTimer, Signal
from PySide6.QtWidgets import QHBoxLayout, QLabel, QListWidget, QListWidgetItem, QMainWindow, QPushButton, QSplitter, QStackedWidget, QVBoxLayout, QWidget

from app.config import AppConfig, save_config
from app.db import connect
from app.sync_client import AppsScriptClient, sync_payload_to_db
from .dashboard_page import DashboardPage
from .detail_dialog import DetailDialog
from .export_page import ExportPage
from .qr_page import QrPage
from .records_page import RecordsPage
from .settings_items_page import SettingsItemsPage
from .settings_people_page import SettingsPeoplePage
from .settings_rooms_page import SettingsRoomsPage
from .setup_wizard import SetupPage


class SyncWorker(QObject):
    finished = Signal(int)
    failed = Signal(str)

    def __init__(self, config: AppConfig) -> None:
        super().__init__()
        self.config = config

    def run(self) -> None:
        try:
            with connect(self.config.db_path) as conn:
                row = conn.execute("SELECT value FROM sync_state WHERE key='last_sync_at'").fetchone()
                since = row["value"] if row else ""
            client = AppsScriptClient(self.config.apps_script_url, self.config.sync_key, timeout=20)
            payload = client.pull(since)
            with connect(self.config.db_path) as conn:
                count = sync_payload_to_db(conn, payload)
            self.finished.emit(count)
        except Exception as exc:
            self.failed.emit(str(exc))


class MainWindow(QMainWindow):
    def __init__(self, config: AppConfig) -> None:
        super().__init__()
        self.config = config
        self.setWindowTitle("QR보안점검표 관리자")
        self.stack = QStackedWidget()
        self.nav = QListWidget()
        self.nav.setMinimumWidth(280)
        self.nav.setMaximumWidth(330)
        self.nav.setStyleSheet(
            """
            QListWidget {
                background: #172033;
                color: #dbe4ee;
                border: 0;
                font-size: 14pt;
                padding: 8px;
            }
            QListWidget::item {
                min-height: 50px;
                padding: 6px 12px;
                border-radius: 8px;
            }
            QListWidget::item:selected {
                background: #2563eb;
                color: #ffffff;
                font-weight: 800;
            }
            QListWidget::item:hover {
                background: #253858;
                color: #ffffff;
            }
            """
        )

        pages: list[tuple[str, QWidget]] = [
            ("대시보드", DashboardPage(config, navigate=self.go_to_page)),
            ("점검기록", RecordsPage(config)),
            ("실 관리", SettingsRoomsPage(config)),
            ("담당자/당직자 관리", SettingsPeoplePage(config)),
            ("점검항목 관리", SettingsItemsPage(config)),
            ("QR 생성", QrPage(config)),
            ("출력/보관", ExportPage(config)),
            ("설정", SetupPage(config)),
        ]
        for label, page in pages:
            item = QListWidgetItem(label)
            item.setTextAlignment(Qt.AlignVCenter)
            self.nav.addItem(item)
            self.stack.addWidget(page)

        self.nav.currentRowChanged.connect(self.stack.setCurrentIndex)
        self.nav.setCurrentRow(len(pages) - 1 if not self.config.apps_script_url or not self.config.sync_key else 0)

        splitter = QSplitter()
        splitter.addWidget(self.nav)
        splitter.addWidget(self.stack)
        splitter.setStretchFactor(1, 1)

        root = QWidget()
        root_layout = QVBoxLayout(root)
        root_layout.setContentsMargins(0, 0, 0, 0)
        root_layout.setSpacing(0)

        header = QWidget()
        header.setObjectName("AppHeader")
        header_layout = QHBoxLayout(header)
        header_layout.setContentsMargins(18, 10, 18, 10)
        title = QLabel("QR보안점검표 관리자")
        title.setStyleSheet("font-size: 18pt; font-weight: 900;")
        self.school_label = QLabel(self.config.school_name or "학교명 미설정")
        self.school_label.setStyleSheet("font-size: 12pt; color: #cbd5e1;")
        header_layout.addWidget(title)
        header_layout.addWidget(self.school_label)
        header_layout.addStretch(1)
        self.sync_badge = QLabel("Google 연결 대기" if self.config.apps_script_url else "Google 미설정")
        self.sync_badge.setStyleSheet(
            "font-size: 11pt; font-weight: 800; padding: 6px 10px; "
            "border-radius: 16px; background: #334155; color: #ffffff;"
        )
        sync_button = QPushButton("동기화")
        sync_button.setStyleSheet("background: #2563eb; color: #ffffff; border-color: #2563eb;")
        sync_button.clicked.connect(self.sync_from_google)
        header_layout.addWidget(self.sync_badge)
        header_layout.addWidget(sync_button)

        self.footer = QLabel("준비됨")
        self.footer.setObjectName("AppFooter")
        root_layout.addWidget(header)
        root_layout.addWidget(splitter, 1)
        root_layout.addWidget(self.footer)
        self.setCentralWidget(root)

        self.sync_timer = QTimer(self)
        self.sync_timer.timeout.connect(self.sync_from_google)
        self.sync_timer.start(max(1, self.config.sync_interval_minutes) * 60 * 1000)
        QTimer.singleShot(5000, self.sync_from_google)
        self.sync_thread: QThread | None = None
        self.sync_worker: SyncWorker | None = None

    def go_to_page(self, label: str) -> None:
        matches = self.nav.findItems(label, Qt.MatchExactly)
        if matches:
            self.nav.setCurrentItem(matches[0])

    def sync_from_google(self) -> None:
        if not self.config.apps_script_url or not self.config.sync_key:
            if hasattr(self, "sync_badge"):
                self.sync_badge.setText("Google 미설정")
            if hasattr(self, "footer"):
                self.footer.setText("Apps Script URL과 Desktop Sync Key를 설정하면 Google 동기화를 사용할 수 있습니다.")
            return
        if self.sync_thread and self.sync_thread.isRunning():
            self.footer.setText("이미 Google 동기화가 진행 중입니다.")
            return
        self.sync_badge.setText("동기화 중")
        self.footer.setText("Google 데이터를 동기화하는 중입니다. 화면은 계속 사용할 수 있습니다.")
        self.sync_thread = QThread(self)
        self.sync_worker = SyncWorker(self.config)
        self.sync_worker.moveToThread(self.sync_thread)
        self.sync_thread.started.connect(self.sync_worker.run)
        self.sync_worker.finished.connect(self.on_sync_finished)
        self.sync_worker.failed.connect(self.on_sync_failed)
        self.sync_worker.finished.connect(self.sync_thread.quit)
        self.sync_worker.failed.connect(self.sync_thread.quit)
        self.sync_thread.finished.connect(self.sync_worker.deleteLater)
        self.sync_thread.finished.connect(self.sync_thread.deleteLater)
        self.sync_thread.finished.connect(self._clear_sync_refs)
        self.sync_thread.start()

    def on_sync_finished(self, count: int) -> None:
        self._refresh_school_name_from_db()
        self.sync_badge.setText("Google 연결됨")
        self.footer.setText(f"Google 동기화 완료: 제출 기록 {count}건 반영")
        logging.getLogger(__name__).info("Google sync completed")

    def on_sync_failed(self, message: str) -> None:
        self.sync_badge.setText("동기화 오류")
        self.footer.setText(f"Google 동기화 실패: {message}")
        logging.getLogger(__name__).warning("Google sync failed: %s", message)

    def _clear_sync_refs(self) -> None:
        self.sync_thread = None
        self.sync_worker = None

    def _refresh_school_name_from_db(self) -> None:
        try:
            with connect(self.config.db_path) as conn:
                row = conn.execute("SELECT value FROM settings_school WHERE key='school_name'").fetchone()
            school_name = row["value"] if row and row["value"] else self.config.school_name
            if school_name and school_name != self.config.school_name:
                self.config.school_name = school_name
                save_config(self.config)
            self.school_label.setText(self.config.school_name or "학교명 미설정")
        except Exception as exc:
            logging.getLogger(__name__).warning("Failed to refresh school name: %s", exc)
