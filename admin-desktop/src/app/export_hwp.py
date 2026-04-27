from __future__ import annotations

from pathlib import Path

from .export_pdf_or_html import export_printable_html


def export_hwp_or_fallback(records: list[dict], output_path: str | Path, school_name: str = "") -> Path:
    """HWP 자동화가 가능하면 HWP를 만들고, 아니면 HTML 인쇄물로 대체한다.

    `.hwp` 바이너리 생성은 한글 프로그램과 pywin32 COM 환경이 필요하다. 무료 배포판의
    기본 출력은 XLSX + HTML 인쇄이며, 이 함수는 HWP 환경이 없을 때 작업을 막지 않는다.
    """
    target = Path(output_path)
    try:
        import win32com.client  # type: ignore
    except Exception:
        return export_printable_html(records, target.with_suffix(".html"), school_name)

    html_path = export_printable_html(records, target.with_suffix(".html"), school_name)
    hwp = win32com.client.gencache.EnsureDispatch("HWPFrame.HwpObject")
    try:
        try:
            hwp.XHwpWindows.Item(0).Visible = False
        except Exception:
            pass
        try:
            hwp.RegisterModule("FilePathCheckDLL", "FilePathCheckerModule")
        except Exception:
            pass
        hwp.Open(str(html_path), "HTML", "")
        hwp.SaveAs(str(target), "HWP", "")
        return target
    finally:
        try:
            hwp.Quit()
        except Exception:
            pass

