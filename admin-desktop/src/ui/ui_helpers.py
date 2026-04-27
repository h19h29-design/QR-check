from __future__ import annotations

from PySide6.QtWidgets import QAbstractItemView, QHeaderView, QSizePolicy, QTableWidget


def configure_full_width_table(table: QTableWidget, hidden_columns: tuple[int, ...] = ()) -> None:
    table.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)
    table.setAlternatingRowColors(True)
    table.setWordWrap(True)
    table.setSelectionBehavior(QAbstractItemView.SelectRows)
    table.verticalHeader().setDefaultSectionSize(52)
    table.verticalHeader().setVisible(False)
    header = table.horizontalHeader()
    header.setSectionResizeMode(QHeaderView.Stretch)
    header.setStretchLastSection(True)
    for column in hidden_columns:
        table.setColumnHidden(column, True)
