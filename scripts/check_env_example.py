#!/usr/bin/env python3
"""
Static drift check: does .env.example document every environment variable
the code actually reads? No database or network needed — pure source scan.

Run locally (`python scripts/check_env_example.py`) or in CI. It fails
(exit 1) only when a REQUIRED variable is undocumented:
  - a pydantic Settings field WITHOUT a default (backend/app/core/config.py)
  - a VITE_* variable referenced by the frontend

Optional/dev variables (Settings fields with a default, os.environ reads,
dev flags) are reported as warnings but never fail the build.

Purpose: keep .env.example — the single onboarding contract for
environment setup — in sync as the team adds config over time.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="ignore")


def documented_keys() -> set[str]:
    text = read(ROOT / ".env.example")
    return set(re.findall(r"^([A-Z][A-Z0-9_]*)=", text, re.M))


def settings_fields() -> tuple[set[str], set[str]]:
    """(required, optional) pydantic Settings fields from config.py.
    A field with `= default` is optional; without is required."""
    required: set[str] = set()
    optional: set[str] = set()
    text = read(ROOT / "backend/app/core/config.py")
    for m in re.finditer(r"^\s{4}([A-Z][A-Z0-9_]*)\s*:\s*[^=\n]+?(=.*)?$", text, re.M):
        (optional if m.group(2) else required).add(m.group(1))
    return required, optional


def vite_vars() -> set[str]:
    found: set[str] = set()
    src = ROOT / "frontend" / "src"
    if src.exists():
        for p in src.rglob("*"):
            if p.suffix in {".ts", ".tsx", ".js", ".jsx"}:
                found.update(re.findall(r"import\.meta\.env\.([A-Z][A-Z0-9_]*)", read(p)))
    return found


def backend_os_env() -> set[str]:
    found: set[str] = set()
    for p in (ROOT / "backend").rglob("*.py"):
        txt = read(p)
        found.update(re.findall(r"""os\.(?:getenv|environ\.get)\(\s*["']([A-Z][A-Z0-9_]*)["']""", txt))
        found.update(re.findall(r"""os\.environ\[\s*["']([A-Z][A-Z0-9_]*)["']""", txt))
    return found


def main() -> int:
    documented = documented_keys()
    req_settings, opt_settings = settings_fields()

    required = req_settings | vite_vars()
    optional = (opt_settings | backend_os_env()) - required

    missing_required = sorted(required - documented)
    missing_optional = sorted(optional - documented)

    for name in missing_optional:
        print(f"  [warn] optional/dev var referenced in code but not in .env.example: {name}")

    if missing_required:
        print("\nFAIL: required env vars are missing from .env.example:")
        for name in missing_required:
            print(f"  - {name}")
        print("\nAdd them to .env.example (with a placeholder + comment) and re-run.")
        return 1

    print(f"\nOK: all {len(required)} required env vars are documented in .env.example.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
