from __future__ import annotations

import os

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

from PySide6.QtWidgets import QApplication

from app.config import AppConfig
from ui.setup_wizard import SetupPage


def test_setup_page_enables_only_selected_storage_fields():
    app = QApplication.instance() or QApplication([])
    page = SetupPage(AppConfig())

    page.storage_mode.setCurrentIndex(page.storage_mode.findData("google"))
    assert page.apps_script_url.isEnabled()
    assert not page.supabase_url.isEnabled()
    assert not page.supabase_anon_key.isEnabled()

    page.storage_mode.setCurrentIndex(page.storage_mode.findData("supabase"))
    assert not page.apps_script_url.isEnabled()
    assert page.supabase_url.isEnabled()
    assert page.supabase_anon_key.isEnabled()
    assert page.supabase_org_code.isEnabled()
    assert page.supabase_submit_url.isEnabled()

    app.processEvents()
