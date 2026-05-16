from __future__ import annotations

from PySide6.QtCore import Qt
from PySide6.QtWidgets import QAbstractItemView, QHeaderView, QSizePolicy, QTableWidget


def configure_full_width_table(
    table: QTableWidget,
    hidden_columns: tuple[int, ...] = (),
    column_widths: dict[int, int] | None = None,
    stretch_columns: tuple[int, ...] | None = None,
) -> None:
    table.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)
    table.setAlternatingRowColors(True)
    table.setWordWrap(False)
    table.setTextElideMode(Qt.ElideRight)
    table.setSelectionBehavior(QAbstractItemView.SelectRows)
    table.verticalHeader().setDefaultSectionSize(42)
    table.verticalHeader().setVisible(False)
    header = table.horizontalHeader()
    header.setMinimumSectionSize(64)
    if column_widths is None and stretch_columns is None:
        header.setSectionResizeMode(QHeaderView.Stretch)
        header.setStretchLastSection(True)
    else:
        header.setSectionResizeMode(QHeaderView.Interactive)
        header.setStretchLastSection(False)
        for column, width in (column_widths or {}).items():
            header.setSectionResizeMode(column, QHeaderView.Interactive)
            table.setColumnWidth(column, width)
        for column in stretch_columns or ():
            header.setSectionResizeMode(column, QHeaderView.Stretch)
    for column in hidden_columns:
        table.setColumnHidden(column, True)
