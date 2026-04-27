from __future__ import annotations

import sys

from PySide6.QtWidgets import QApplication

from app.config import load_config
from app.logging_config import configure_logging
from app.migrations import init_db
from ui.main_window import MainWindow


def main() -> int:
    config = load_config()
    data_dir = config.resolved_data_dir
    data_dir.mkdir(parents=True, exist_ok=True)
    configure_logging(data_dir / "logs")
    init_db(config.db_path)

    app = QApplication(sys.argv)
    app.setApplicationName("QR보안점검표 관리자")
    font = app.font()
    base_size = font.pointSizeF() if font.pointSizeF() > 0 else 10.0
    font.setPointSizeF(base_size * 1.2)
    app.setFont(font)
    app.setStyleSheet(
        """
        QWidget {
            font-family: "Malgun Gothic", "맑은 고딕", "Segoe UI", sans-serif;
            color: #17202a;
        }
        QPushButton {
            min-height: 38px;
            padding: 7px 12px;
            border: 1px solid #cfd8e3;
            border-radius: 8px;
            background: #ffffff;
            font-weight: 700;
        }
        QPushButton:hover {
            background: #eef6ff;
            border-color: #93c5fd;
        }
        QPushButton:pressed {
            background: #dbeafe;
        }
        QLineEdit, QComboBox, QDateEdit, QSpinBox {
            min-height: 36px;
            padding: 4px 8px;
            border: 1px solid #cfd8e3;
            border-radius: 8px;
            background: #ffffff;
        }
        QComboBox, QDateEdit {
            padding-right: 34px;
        }
        QComboBox::drop-down, QDateEdit::drop-down {
            subcontrol-origin: padding;
            subcontrol-position: top right;
            width: 30px;
            border-left: 1px solid #cfd8e3;
            border-top-right-radius: 8px;
            border-bottom-right-radius: 8px;
            background: #f8fafc;
        }
        QComboBox::down-arrow, QDateEdit::down-arrow {
            width: 10px;
            height: 10px;
        }
        QComboBox::drop-down:hover, QDateEdit::drop-down:hover {
            background: #eef6ff;
        }
        QCalendarWidget QWidget {
            background: #ffffff;
            color: #17202a;
        }
        QCalendarWidget QToolButton {
            min-height: 30px;
            padding: 4px 8px;
            border-radius: 6px;
            background: #f8fafc;
            color: #17202a;
        }
        QCalendarWidget QToolButton:hover {
            background: #eef6ff;
        }
        QCalendarWidget QAbstractItemView {
            selection-background-color: #2563eb;
            selection-color: #ffffff;
        }
        QTextEdit {
            min-height: 76px;
            padding: 8px;
            border: 1px solid #cfd8e3;
            border-radius: 8px;
            background: #ffffff;
        }
        QListWidget {
            padding: 8px;
        }
        QListWidget::item {
            min-height: 42px;
            padding: 8px;
        }
        QTableWidget {
            gridline-color: #d0d7de;
            alternate-background-color: #f6f8fa;
            selection-background-color: #dbeafe;
            selection-color: #111827;
            border: 1px solid #cfd8e3;
            border-radius: 8px;
            background: #ffffff;
        }
        QHeaderView::section {
            background: #eef2f7;
            border: 0;
            border-bottom: 1px solid #cfd8e3;
            padding: 10px;
            font-weight: 700;
        }
        #AppHeader {
            background: #111827;
            color: #ffffff;
            border-bottom: 1px solid #0f172a;
        }
        #AppHeader QLabel {
            color: #ffffff;
            background: transparent;
        }
        #AppFooter {
            background: #f8fafc;
            color: #475569;
            border-top: 1px solid #cfd8e3;
            padding: 8px 14px;
        }
        """
    )
    window = MainWindow(config)
    window.resize(1440, 900)
    window.show()
    return app.exec()


if __name__ == "__main__":
    raise SystemExit(main())
