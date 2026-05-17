from __future__ import annotations

from PySide6.QtCore import Qt
from PySide6.QtWidgets import QHBoxLayout, QLabel, QListWidget, QListWidgetItem, QPushButton, QSplitter, QTextBrowser, QVBoxLayout, QWidget

from app.manual_content import MANUAL_HTML, MANUAL_SECTIONS
from app.resources import resource_path


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

        intro = QLabel("번호를 누르면 설치, 저장 방식, QR 생성, 백업, 업데이트 안내를 바로 확인할 수 있습니다.")
        intro.setWordWrap(True)
        intro.setStyleSheet("color: #475569; font-size: 11pt;")
        layout.addWidget(intro)

        splitter = QSplitter(Qt.Horizontal)
        self.section_list = QListWidget()
        self.section_list.setMinimumWidth(260)
        self.section_list.setMaximumWidth(360)
        self.section_list.setStyleSheet(
            """
            QListWidget {
                background: #f8fafc;
                border: 1px solid #cfd8e3;
                border-radius: 8px;
                padding: 8px;
            }
            QListWidget::item {
                min-height: 42px;
                padding: 6px 10px;
                border-radius: 6px;
                color: #0f172a;
            }
            QListWidget::item:selected {
                background: #2563eb;
                color: #ffffff;
                font-weight: 800;
            }
            """
        )
        for anchor, number, title_text, _ in MANUAL_SECTIONS:
            item = QListWidgetItem(f"{number}. {title_text}")
            item.setData(Qt.UserRole, anchor)
            self.section_list.addItem(item)
        self.section_list.currentItemChanged.connect(self._scroll_to_section)

        self.browser = QTextBrowser()
        self.browser.setOpenExternalLinks(True)
        self.browser.setSearchPaths([str(resource_path("manual"))])
        self.browser.setHtml(self._wrap_html(MANUAL_HTML))
        self.browser.setStyleSheet(
            """
            QTextBrowser {
                background: #ffffff;
                border: 1px solid #cfd8e3;
                border-radius: 8px;
                padding: 14px;
                line-height: 1.55;
            }
            """
        )
        splitter.addWidget(self.section_list)
        splitter.addWidget(self.browser)
        splitter.setStretchFactor(1, 1)
        layout.addWidget(splitter, 1)

        footer = QLabel("팁: 설정 화면에도 Google/Supabase 최초 설정 순서가 들어 있습니다. 실제 운영 전에는 QR 1개를 휴대폰으로 시험 제출하세요.")
        footer.setWordWrap(True)
        footer.setAlignment(Qt.AlignLeft)
        footer.setStyleSheet("color: #475569;")
        layout.addWidget(footer)

        self.section_list.setCurrentRow(0)

    def scroll_to_top(self) -> None:
        self.browser.scrollToAnchor("top")

    def _scroll_to_section(self, current: QListWidgetItem | None, _previous: QListWidgetItem | None) -> None:
        if current is None:
            return
        anchor = current.data(Qt.UserRole)
        if anchor:
            self.browser.scrollToAnchor(str(anchor))

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
            line-height: 1.62;
          }}
          h1 {{ font-size: 30px; margin: 0 0 12px; color: #0f172a; }}
          h2 {{ font-size: 22px; margin: 30px 0 10px; color: #1d4ed8; }}
          h2 span {{
            display: inline-block;
            min-width: 28px;
            padding: 3px 8px;
            margin-right: 8px;
            border-radius: 14px;
            background: #dbeafe;
            color: #1e40af;
          }}
          p, li {{ margin-bottom: 8px; }}
          ol, ul {{ margin-left: 22px; }}
          b {{ color: #0f172a; }}
          .lead {{
            padding: 12px 14px;
            border-left: 5px solid #2563eb;
            background: #eff6ff;
          }}
          .toc {{
            margin: 16px 0 24px;
          }}
          .toc-item {{
            display: block;
            margin: 6px 0;
            padding: 9px 11px;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            text-decoration: none;
            color: #0f172a;
            background: #f8fafc;
          }}
          .toc-item span {{
            display: inline-block;
            min-width: 24px;
            font-weight: 900;
            color: #2563eb;
          }}
          figure {{
            margin: 14px 0;
            padding: 12px;
            border: 1px solid #d8e0ea;
            border-radius: 8px;
            background: #f8fafc;
          }}
          figure img {{
            max-width: 100%;
          }}
          figcaption {{
            margin-top: 8px;
            color: #475569;
            font-size: 14px;
          }}
          .warn {{
            margin: 12px 0;
            padding: 12px 14px;
            border-left: 5px solid #dc2626;
            background: #fff1f2;
            color: #7f1d1d;
            font-weight: 700;
          }}
          .back a {{ color: #2563eb; }}
        </style>
        </head>
        <body>{body}</body>
        </html>
        """
