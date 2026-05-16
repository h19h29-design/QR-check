from __future__ import annotations

from dataclasses import replace
from pathlib import Path

from PySide6.QtCore import QObject, QThread, Signal
from PySide6.QtWidgets import (
    QComboBox,
    QFileDialog,
    QFormLayout,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QPushButton,
    QSpinBox,
    QTextEdit,
    QVBoxLayout,
    QWidget,
)

from app.config import AppConfig, STORAGE_MODE_GOOGLE, STORAGE_MODE_SUPABASE, save_config
from app.db import connect, rows_to_dicts
from app.sync_client import create_storage_client, provider_label, sync_payload_to_db, sync_state_key


class SetupTaskWorker(QObject):
    finished = Signal(str)
    failed = Signal(str)

    def __init__(self, task) -> None:
        super().__init__()
        self.task = task

    def run(self) -> None:
        try:
            self.finished.emit(self.task())
        except Exception as exc:
            self.failed.emit(str(exc))


class SetupPage(QWidget):
    def __init__(self, config: AppConfig) -> None:
        super().__init__()
        self.config = config
        self._task_thread: QThread | None = None
        self._task_worker: SetupTaskWorker | None = None

        layout = QVBoxLayout(self)
        layout.setContentsMargins(12, 10, 12, 12)
        layout.setSpacing(10)

        title = QLabel("설정 및 저장소 연결")
        title.setStyleSheet("font-size: 20pt; font-weight: 800; padding: 4px 0;")
        layout.addWidget(title)

        guide = QTextEdit()
        guide.setReadOnly(True)
        guide.setMaximumHeight(210)
        guide.setStyleSheet(
            "background: #f8fafc; border: 1px solid #cfd8e3; border-radius: 8px; "
            "padding: 10px; color: #17202a;"
        )
        guide.setPlainText(
            "저장 방식 선택\n\n"
            "Google Drive 방식은 기존 방식입니다. Apps Script URL과 Desktop Sync Key를 사용하며, "
            "현재 학교 Google Sheet/Drive 흐름을 그대로 유지합니다.\n\n"
            "Supabase 방식은 각 학교가 직접 만든 Supabase 프로젝트를 원본 저장소로 사용합니다. "
            "학교 PC가 꺼져 있어도 QR 제출 페이지와 Supabase가 동작하면 제출을 받을 수 있습니다. "
            "service_role key는 입력하지 말고 anon public key만 입력하세요."
        )
        layout.addWidget(guide)

        form = QFormLayout()

        self.storage_mode = QComboBox()
        self.storage_mode.addItem("Google Drive 방식", STORAGE_MODE_GOOGLE)
        self.storage_mode.addItem("Supabase 방식", STORAGE_MODE_SUPABASE)
        index = self.storage_mode.findData(config.normalized_storage_mode)
        self.storage_mode.setCurrentIndex(max(index, 0))

        self.school_name = QLineEdit(config.school_name)
        self.admin_email = QLineEdit(config.admin_email)
        self.apps_script_url = QLineEdit(config.apps_script_url)
        self.apps_script_url.setPlaceholderText("https://script.google.com/macros/s/.../exec")
        self.sync_key = QLineEdit(config.sync_key)
        self.sync_key.setEchoMode(QLineEdit.Password)
        self.sync_key.setPlaceholderText("Desktop Sync Key")

        self.supabase_url = QLineEdit(config.supabase_url)
        self.supabase_url.setPlaceholderText("https://xxxx.supabase.co")
        self.supabase_anon_key = QLineEdit(config.supabase_anon_key)
        self.supabase_anon_key.setEchoMode(QLineEdit.Password)
        self.supabase_anon_key.setPlaceholderText("Supabase anon public key")
        self.supabase_org_code = QLineEdit(config.supabase_org_code)
        self.supabase_org_code.setPlaceholderText("예: school-2026")
        self.supabase_submit_url = QLineEdit(config.supabase_submit_url)
        self.supabase_submit_url.setPlaceholderText("https://example.pages.dev 또는 정적 제출 페이지 주소")

        self.interval = QSpinBox()
        self.interval.setRange(1, 120)
        self.interval.setValue(config.sync_interval_minutes)

        self.qr_output_dir = QLineEdit(str(config.qr_dir))
        self.export_output_dir = QLineEdit(str(config.export_dir))

        form.addRow("저장 방식", self.storage_mode)
        form.addRow("학교명", self.school_name)
        form.addRow("관리자 이메일", self.admin_email)
        form.addRow("Apps Script Web App URL", self.apps_script_url)
        form.addRow("Desktop Sync Key", self.sync_key)
        form.addRow("Supabase 주소", self.supabase_url)
        form.addRow("Supabase anon public key", self.supabase_anon_key)
        form.addRow("학교 코드", self.supabase_org_code)
        form.addRow("Supabase 제출 페이지 주소", self.supabase_submit_url)
        form.addRow("자동 동기화 주기(분)", self.interval)
        form.addRow("QR 저장 폴더", self._folder_row(self.qr_output_dir, self.choose_qr_dir))
        form.addRow("출력물 저장 폴더", self._folder_row(self.export_output_dir, self.choose_export_dir))
        layout.addLayout(form)

        actions = QHBoxLayout()
        save = QPushButton("설정 저장")
        save.clicked.connect(self.save)
        test = QPushButton("연결 테스트")
        test.clicked.connect(self.test_connection)
        upload = QPushButton("로컬 설정 업로드")
        upload.clicked.connect(self.upload_local_settings)
        pull = QPushButton("저장소 데이터 내려받기")
        pull.clicked.connect(self.pull_google_data)
        actions.addWidget(save)
        actions.addWidget(test)
        actions.addWidget(upload)
        actions.addWidget(pull)
        layout.addLayout(actions)

        self.status = QLineEdit()
        self.status.setReadOnly(True)
        layout.addWidget(self.status)

    def _folder_row(self, line: QLineEdit, callback) -> QWidget:
        wrapper = QWidget()
        row = QHBoxLayout(wrapper)
        row.setContentsMargins(0, 0, 0, 0)
        row.addWidget(line)
        button = QPushButton("찾기")
        button.clicked.connect(callback)
        row.addWidget(button)
        return wrapper

    def choose_qr_dir(self) -> None:
        selected = QFileDialog.getExistingDirectory(self, "QR 저장 폴더 선택", self.qr_output_dir.text())
        if selected:
            self.qr_output_dir.setText(selected)

    def choose_export_dir(self) -> None:
        selected = QFileDialog.getExistingDirectory(self, "출력물 저장 폴더 선택", self.export_output_dir.text())
        if selected:
            self.export_output_dir.setText(selected)

    def save(self) -> None:
        self.config.storage_mode = self.storage_mode.currentData()
        self.config.school_name = self.school_name.text().strip()
        self.config.admin_email = self.admin_email.text().strip()
        self.config.apps_script_url = self.apps_script_url.text().strip()
        self.config.sync_key = self.sync_key.text().strip()
        self.config.supabase_url = self.supabase_url.text().strip()
        self.config.supabase_anon_key = self.supabase_anon_key.text().strip()
        self.config.supabase_org_code = self.supabase_org_code.text().strip()
        self.config.supabase_submit_url = self.supabase_submit_url.text().strip()
        self.config.sync_interval_minutes = self.interval.value()
        self.config.qr_output_dir = self.qr_output_dir.text().strip()
        self.config.export_output_dir = self.export_output_dir.text().strip()
        Path(self.config.qr_dir).mkdir(parents=True, exist_ok=True)
        Path(self.config.export_dir).mkdir(parents=True, exist_ok=True)
        path = save_config(self.config)
        self.status.setText(f"저장 완료: {path}")

    def test_connection(self) -> None:
        self.save()
        config = self._config_snapshot()
        label = provider_label(config.normalized_storage_mode)

        def task() -> str:
            client = create_storage_client(config, timeout=20)
            health = client.health()
            schema = health.get("schema_version", {})
            version = schema.get("version", "확인됨") if isinstance(schema, dict) else "확인됨"
            return f"{label} 연결 성공: schema_version {version}"

        self._run_background(f"{label} 연결 테스트 중입니다...", task)

    def upload_local_settings(self) -> None:
        self.save()
        config = self._config_snapshot()
        label = provider_label(config.normalized_storage_mode)

        def task() -> str:
            state_key = sync_state_key(config.normalized_storage_mode)
            with connect(config.db_path) as conn:
                state = conn.execute("SELECT value FROM sync_state WHERE key=?", (state_key,)).fetchone()
                base_since = state["value"] if state else ""
                rooms = rows_to_dicts(conn.execute("SELECT * FROM settings_rooms").fetchall())
                people = rows_to_dicts(conn.execute("SELECT * FROM settings_people").fetchall())
                items = rows_to_dicts(conn.execute("SELECT * FROM settings_check_items").fetchall())
            client = create_storage_client(config, timeout=20)
            client.push_settings({"rooms": rooms, "people": people, "items": items, "base_since": base_since})
            return f"{label} 업로드 완료: 실 {len(rooms)}개, 인원 {len(people)}명, 항목 {len(items)}개"

        self._run_background(f"로컬 설정을 {label}로 업로드하는 중입니다...", task)

    def pull_google_data(self) -> None:
        self.save()
        config = self._config_snapshot()
        label = provider_label(config.normalized_storage_mode)

        def task() -> str:
            state_key = sync_state_key(config.normalized_storage_mode)
            client = create_storage_client(config, timeout=20)
            payload = client.pull("")
            with connect(config.db_path) as conn:
                count = sync_payload_to_db(conn, payload, state_key=state_key)
            return f"{label} 데이터 내려받기 완료: 제출 기록 {count}건 반영"

        self._run_background(f"{label} 데이터를 내려받는 중입니다...", task)

    def _config_snapshot(self) -> AppConfig:
        return replace(self.config)

    def _run_background(self, message: str, task) -> None:
        if self._task_thread and self._task_thread.isRunning():
            self.status.setText("이미 저장소 작업이 진행 중입니다. 잠시만 기다려 주세요.")
            return
        self.status.setText(message)
        self._task_thread = QThread(self)
        self._task_worker = SetupTaskWorker(task)
        self._task_worker.moveToThread(self._task_thread)
        self._task_thread.started.connect(self._task_worker.run)
        self._task_worker.finished.connect(self._task_finished)
        self._task_worker.failed.connect(self._task_failed)
        self._task_worker.finished.connect(self._task_thread.quit)
        self._task_worker.failed.connect(self._task_thread.quit)
        self._task_thread.finished.connect(self._task_worker.deleteLater)
        self._task_thread.finished.connect(self._task_thread.deleteLater)
        self._task_thread.finished.connect(self._clear_task_refs)
        self._task_thread.start()

    def _task_finished(self, message: str) -> None:
        self.status.setText(message)

    def _task_failed(self, message: str) -> None:
        self.status.setText(f"저장소 작업 실패: {message}")

    def _clear_task_refs(self) -> None:
        self._task_thread = None
        self._task_worker = None
