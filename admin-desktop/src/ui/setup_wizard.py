from __future__ import annotations

from pathlib import Path

from PySide6.QtWidgets import (
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

from app.config import AppConfig, save_config
from app.db import connect, rows_to_dicts
from app.sync_client import AppsScriptClient, sync_payload_to_db


class SetupPage(QWidget):
    def __init__(self, config: AppConfig) -> None:
        super().__init__()
        self.config = config
        layout = QVBoxLayout(self)
        layout.setContentsMargins(12, 10, 12, 12)
        layout.setSpacing(10)

        title = QLabel("설정 및 Google 연결")
        title.setStyleSheet("font-size: 20pt; font-weight: 800; padding: 4px 0;")
        layout.addWidget(title)

        guide = QTextEdit()
        guide.setReadOnly(True)
        guide.setMaximumHeight(250)
        guide.setStyleSheet(
            "background: #f8fafc; border: 1px solid #cfd8e3; border-radius: 8px; "
            "padding: 10px; color: #17202a;"
        )
        guide.setPlainText(
            "Google 설정 방법(처음 1회)\n"
            "1. Google Drive에서 새 Google Sheet를 만들거나 배포 패키지의 Google Apps Script 코드 폴더를 준비합니다.\n"
            "2. Google Sheet에서 [확장 프로그램] > [Apps Script]를 열고 apps-script 폴더의 파일들을 같은 이름으로 붙여넣습니다.\n"
            "3. Apps Script에서 [배포] > [새 배포] > [웹 앱]을 선택합니다.\n"
            "4. 실행 사용자는 '나', 액세스 권한은 점검자 무로그인 제출을 위해 '모든 사용자'로 설정합니다.\n"
            "5. 처음 배포할 때 Google 권한 승인을 진행합니다. 이 승인은 학교 관리자 1명만 하면 됩니다.\n"
            "6. 배포 URL을 복사해서 아래 'Apps Script Web App URL'에 붙여넣습니다.\n"
            "7. 배포 URL 뒤에 ?page=setup을 붙여 열고 Desktop Sync Key를 발급받아 아래에 입력합니다.\n"
            "8. [설정 저장] 후 [연결 테스트]를 누릅니다.\n"
            "9. 실/담당자/당직자/점검항목을 등록한 뒤 [로컬 설정을 Google로 업로드]를 누릅니다.\n"
            "10. [QR 생성]에서 QR을 만든 뒤 휴대폰으로 테스트 제출하면 실사용 준비가 끝납니다.\n\n"
            "주의: 실제 Google 계정 비밀번호나 Client Secret은 이 프로그램에 입력하지 않습니다."
        )
        layout.addWidget(guide)

        form = QFormLayout()

        self.school_name = QLineEdit(config.school_name)
        self.admin_email = QLineEdit(config.admin_email)
        self.apps_script_url = QLineEdit(config.apps_script_url)
        self.apps_script_url.setPlaceholderText("https://script.google.com/macros/s/.../exec")
        self.sync_key = QLineEdit(config.sync_key)
        self.sync_key.setEchoMode(QLineEdit.Password)
        self.sync_key.setPlaceholderText("관리자 웹 page=setup에서 발급받은 Desktop Sync Key")
        self.interval = QSpinBox()
        self.interval.setRange(1, 120)
        self.interval.setValue(config.sync_interval_minutes)

        self.qr_output_dir = QLineEdit(str(config.qr_dir))
        self.export_output_dir = QLineEdit(str(config.export_dir))

        form.addRow("학교명", self.school_name)
        form.addRow("관리자 Google 이메일", self.admin_email)
        form.addRow("Apps Script Web App URL", self.apps_script_url)
        form.addRow("Desktop Sync Key", self.sync_key)
        form.addRow("자동 동기화 주기(분)", self.interval)
        form.addRow("QR 저장 폴더", self._folder_row(self.qr_output_dir, self.choose_qr_dir))
        form.addRow("출력물 저장 폴더", self._folder_row(self.export_output_dir, self.choose_export_dir))
        layout.addLayout(form)

        actions = QHBoxLayout()
        save = QPushButton("설정 저장")
        save.clicked.connect(self.save)
        test = QPushButton("연결 테스트")
        test.clicked.connect(self.test_connection)
        upload = QPushButton("로컬 설정을 Google로 업로드")
        upload.clicked.connect(self.upload_local_settings)
        pull = QPushButton("Google 데이터 내려받기")
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
        self.config.school_name = self.school_name.text().strip()
        self.config.admin_email = self.admin_email.text().strip()
        self.config.apps_script_url = self.apps_script_url.text().strip()
        self.config.sync_key = self.sync_key.text().strip()
        self.config.sync_interval_minutes = self.interval.value()
        self.config.qr_output_dir = self.qr_output_dir.text().strip()
        self.config.export_output_dir = self.export_output_dir.text().strip()
        Path(self.config.qr_dir).mkdir(parents=True, exist_ok=True)
        Path(self.config.export_dir).mkdir(parents=True, exist_ok=True)
        path = save_config(self.config)
        self.status.setText(f"저장 완료: {path}")

    def test_connection(self) -> None:
        self.save()
        try:
            client = AppsScriptClient(self.config.apps_script_url, self.config.sync_key)
            client.health()
            pulled = client.pull("")
            self.status.setText(
                "연결 성공: URL과 Desktop Sync Key가 모두 확인되었습니다. "
                f"서버 제출 기록 {len(pulled.get('submissions', []))}건 확인"
            )
        except Exception as exc:
            self.status.setText(f"연결 실패: {exc}")

    def upload_local_settings(self) -> None:
        self.save()
        if not self.config.apps_script_url or not self.config.sync_key:
            self.status.setText("Apps Script URL과 Desktop Sync Key를 먼저 입력하세요.")
            return
        try:
            with connect(self.config.db_path) as conn:
                rooms = rows_to_dicts(conn.execute("SELECT * FROM settings_rooms").fetchall())
                people = rows_to_dicts(conn.execute("SELECT * FROM settings_people").fetchall())
                items = rows_to_dicts(conn.execute("SELECT * FROM settings_check_items").fetchall())
            client = AppsScriptClient(self.config.apps_script_url, self.config.sync_key)
            client.push_settings({"rooms": rooms, "people": people, "items": items})
            self.status.setText(f"Google 업로드 완료: 실 {len(rooms)}개, 사람 {len(people)}명, 항목 {len(items)}개")
        except Exception as exc:
            self.status.setText(f"Google 업로드 실패: {exc}")

    def pull_google_data(self) -> None:
        self.save()
        if not self.config.apps_script_url or not self.config.sync_key:
            self.status.setText("Apps Script URL과 Desktop Sync Key를 먼저 입력하세요.")
            return
        try:
            client = AppsScriptClient(self.config.apps_script_url, self.config.sync_key)
            payload = client.pull("")
            with connect(self.config.db_path) as conn:
                count = sync_payload_to_db(conn, payload)
            self.status.setText(f"Google 데이터 내려받기 완료: 제출 기록 {count}건 반영")
        except Exception as exc:
            self.status.setText(f"Google 데이터 내려받기 실패: {exc}")
