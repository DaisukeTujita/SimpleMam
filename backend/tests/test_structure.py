from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]


def test_pc_and_shared_code_do_not_import_mobile():
    for folder in ("frontend/src/app/pc", "frontend/src/components", "frontend/src/lib"):
        for path in (ROOT / folder).rglob("*.tsx"):
            text = path.read_text(encoding="utf-8")
            assert not re.search(r'(?:from|import)\s*\(?[\'"][^\'"]*app/mobile', text), path


def test_no_adapter_or_system_setting_or_sub_number_in_runtime_sql():
    for path in (ROOT / "backend/app").rglob("*.py"):
        text = path.read_text(encoding="utf-8")
        assert "M_SYSTEM" not in text, path
        assert "material_sub_number" not in text, path
        assert not re.search(r"\b(?:CREATE|ALTER|DROP|TRUNCATE)\s+TABLE\b", text, re.I), path
