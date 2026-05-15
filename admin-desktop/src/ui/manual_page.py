from __future__ import annotations

from PySide6.QtCore import Qt
from PySide6.QtWidgets import QHBoxLayout, QLabel, QPushButton, QTextBrowser, QVBoxLayout, QWidget

from app.manual_content import MANUAL_HTML


class ManualPage(QWidget):
    def __init__(self) -> None:
        super().__init__()
        layout = QVBoxLayout(self)
        layout.setContentsMargins(16, 14, 16, 16)
        layout.setSpacing(12)

        header = QHBoxLayout()
        title = QLabel("도움말/매뉴얼")
        title.setStyleSheet("font-size: 18pt; font-weight: 900;")
        header.addWidget(title)
        header.addStretch(1)
        top_button = QPushButton("맨 위로")
        top_button.clicked.connect(self.scroll_to_top)
        header.addWidget(top_button)
        layout.addLayout(header)

        intro = QLabel("설치 후 처음 설정하는 순서부터 QR 생성, 조회, 출력, 문제 해결까지 프로그램 안에서 확인할 수 있습니다.")
        intro.setWordWrap(True)
        intro.setStyleSheet("color: #475569; font-size: 11pt;")
        layout.addWidget(intro)

        self.browser = QTextBrowser()
        self.browser.setOpenExternalLinks(True)
        self.browser.setHtml(self._wrap_html(MANUAL_HTML))
        self.browser.setStyleSheet(
            """
            QTextBrowser {
                background: #ffffff;
                border: 1px solid #cfd8e3;
                border-radius: 10px;
                padding: 14px;
                line-height: 1.55;
            }
            """
        )
        layout.addWidget(self.browser, 1)

        footer = QLabel("팁: 설정 화면에도 Google 최초 설정 순서가 들어 있습니다. 실제 운영 전에는 QR 1개를 휴대폰으로 시험 제출하세요.")
        footer.setWordWrap(True)
        footer.setAlignment(Qt.AlignLeft)
        footer.setStyleSheet("color: #475569;")
        layout.addWidget(footer)

    def scroll_to_top(self) -> None:
        self.browser.verticalScrollBar().setValue(0)

    @staticmethod
    def _wrap_html(body: str) -> str:
        return f"""
        <html>
        <head>
        <style>
          body {{
            font-family: 'Malgun Gothic', '맑은 고딕', 'Segoe UI', sans-serif;
            color: #17202a;
            font-size: 16px;
            line-height: 1.6;
          }}
          h1 {{ font-size: 30px; margin: 0 0 16px; color: #0f172a; }}
          h2 {{ font-size: 22px; margin: 28px 0 10px; color: #1d4ed8; }}
          p, li {{ margin-bottom: 8px; }}
          ol, ul {{ margin-left: 22px; }}
          b {{ color: #0f172a; }}
        </style>
        </head>
        <body>{body}</body>
        </html>
        """
