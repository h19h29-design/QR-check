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
        guide.setMinimumHeight(260)
        guide.setMaximumHeight(360)
        guide.setStyleSheet(
            "background: #f8fafc; border: 1px solid #cfd8e3; border-radius: 8px; "
            "padding: 10px; color: #17202a;"
        )
        self.guide = guide
        layout.addWidget(guide)

        form = QFormLayout()
        form.setFieldGrowthPolicy(QFormLayout.ExpandingFieldsGrow)
        form.setRowWrapPolicy(QFormLayout.DontWrapRows)

        self.storage_mode = QComboBox()
        self.storage_mode.addItem("Google Drive 방식", STORAGE_MODE_GOOGLE)
        self.storage_mode.addItem("Supabase 방식", STORAGE_MODE_SUPABASE)
        index = self.storage_mode.findData(config.normalized_storage_mode)
        self.storage_mode.setCurrentIndex(max(index, 0))
        self.storage_mode.currentIndexChanged.connect(self._update_storage_mode_fields)

        self.school_name = QLineEdit(config.school_name)
        self.admin_email = QLineEdit(config.admin_email)
        self.apps_script_url = QLineEdit(config.apps_script_url)
        self.apps_script_url.setMinimumWidth(720)
        self.apps_script_url.setPlaceholderText("https://script.google.com/macros/s/.../exec")
        self.sync_key = QLineEdit(config.sync_key)
        self.sync_key.setMinimumWidth(720)
        self.sync_key.setEchoMode(QLineEdit.Password)
        self.sync_key.setPlaceholderText("Desktop Sync Key")

        self.supabase_url = QLineEdit(config.supabase_url)
        self.supabase_url.setMinimumWidth(720)
        self.supabase_url.setPlaceholderText("https://xxxx.supabase.co")
        self.supabase_anon_key = QLineEdit(config.supabase_anon_key)
        self.supabase_anon_key.setMinimumWidth(720)
        self.supabase_anon_key.setEchoMode(QLineEdit.Password)
        self.supabase_anon_key.setPlaceholderText("Supabase anon public key")
        self.supabase_org_code = QLineEdit(config.supabase_org_code)
        self.supabase_org_code.setMinimumWidth(720)
        self.supabase_org_code.setPlaceholderText("예: school-2026")
        self.supabase_submit_url = QLineEdit(config.supabase_submit_url)
        self.supabase_submit_url.setMinimumWidth(720)
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
        self._update_storage_mode_fields()

    def _update_storage_mode_fields(self) -> None:
        mode = self.storage_mode.currentData()
        google = mode == STORAGE_MODE_GOOGLE
        supabase = mode == STORAGE_MODE_SUPABASE
        self.apps_script_url.setEnabled(google)
        self.supabase_url.setEnabled(supabase)
        self.supabase_anon_key.setEnabled(supabase)
        self.supabase_org_code.setEnabled(supabase)
        self.supabase_submit_url.setEnabled(supabase)
        self.sync_key.setPlaceholderText("Google Desktop Sync Key" if google else "Supabase Desktop Sync Key")
        self.guide.setPlainText(self._mode_help_text(mode))

    def _mode_help_text(self, mode: str) -> str:
        if mode == STORAGE_MODE_SUPABASE:
            return (
                "Supabase 방식 작동 원리\n"
                "- 각 학교가 자기 Supabase 프로젝트를 만들고, 그 프로젝트가 원본 DB가 됩니다.\n"
                "- QR 제출 페이지는 정적 HTML입니다. 학교 PC가 꺼져 있어도 정적 페이지와 Supabase가 살아 있으면 제출됩니다.\n"
                "- QR에는 roomId, token, org만 들어갑니다. Supabase anon key는 QR에 넣지 않습니다.\n"
                "- 제출 페이지는 Supabase RPC를 호출하고, DB 내부에서 submit token hash를 검증합니다.\n"
                "- service_role key는 절대 입력하지 않습니다.\n\n"
                "Supabase 값 구하는 순서\n"
                "1. https://supabase.com 에 가입하고 New project를 만듭니다.\n"
                "2. Supabase Dashboard에서 SQL Editor를 열고 배포본의 setup_supabase.sql을 실행합니다.\n"
                "3. seed_sample.sql을 실제 학교 코드, 학교명, Desktop Sync Key로 바꾸어 실행합니다.\n"
                "4. Project Settings > API 또는 Connect/API Keys 화면에서 Project URL을 복사합니다.\n"
                "5. 같은 화면에서 anon public key 또는 publishable/anon key를 복사합니다. service_role key는 복사하지 않습니다.\n"
                "6. 배포본의 supabase-submit 폴더를 Cloudflare Pages, GitHub Pages, Vercel 같은 정적 호스팅에 올립니다.\n"
                "7. supabase-submit/config.js에 Supabase URL, anon key, 학교 코드를 입력합니다.\n"
                "8. 이 설정 화면에 Supabase 주소, anon key, 학교 코드, 제출 페이지 주소, Desktop Sync Key를 입력하고 연결 테스트를 누릅니다.\n"
            )
        return (
            "Google Drive 방식 작동 원리\n"
            "- 기존 방식입니다. Google Apps Script가 제출 화면과 동기화 API 역할을 합니다.\n"
            "- 제출 데이터는 학교 Google Sheet에, 첨부파일은 학교 Google Drive에 저장됩니다.\n"
            "- 점검자는 Google 로그인 없이 QR의 roomId + submitToken으로 제출합니다.\n"
            "- Windows 관리자 프로그램은 Apps Script Web App URL과 Desktop Sync Key로 Google 데이터를 동기화합니다.\n\n"
            "Google 값 구하는 순서\n"
            "1. 학교 관리자 Google 계정으로 Google Sheet를 새로 만듭니다.\n"
            "2. Google Sheet에서 확장 프로그램 > Apps Script를 엽니다.\n"
            "3. 배포본의 2_Google_AppsScript_Code 폴더에 있는 .gs/.html 파일을 같은 이름으로 붙여 넣습니다.\n"
            "4. Apps Script에서 배포 > 새 배포 > 유형 선택 > 웹 앱을 선택합니다.\n"
            "5. 실행 사용자는 나, 액세스 권한은 점검자 제출을 위해 모든 사용자로 설정합니다.\n"
            "6. 처음 배포할 때 Google 권한 승인 화면을 학교 관리자 계정으로 승인합니다.\n"
            "7. 배포가 끝나면 Web App URL을 복사해 이 화면의 Apps Script Web App URL에 넣습니다.\n"
            "8. Apps Script 편집기에서 createInitialSetupKey 함수를 실행해 초기 설정 키를 만듭니다.\n"
            "9. Web App URL 뒤에 ?page=setup을 붙여 열고 초기 설정 키, 학교명, 관리자 이메일을 입력합니다.\n"
            "10. 화면에 표시되는 Desktop Sync Key를 복사해 이 화면에 넣고 연결 테스트를 누릅니다.\n"
        )

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
