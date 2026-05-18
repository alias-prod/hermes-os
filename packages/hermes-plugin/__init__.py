"""Hermes OS plugin.

This follows the official Hermes plugin contract: a Python module with a
``register(ctx)`` entry point plus ``plugin.yaml`` metadata. The plugin keeps
OpenUI guidance available to Hermes without modifying Hermes core.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

_PLUGIN_DIR = Path(__file__).parent
_INLINE_PROMPT_PATH = _PLUGIN_DIR / "prompts" / "openui-inline-ui.md"
_SKILL_PATH = _PLUGIN_DIR / "skills" / "openui-app" / "SKILL.md"


def _json(data: dict[str, Any]) -> str:
    return json.dumps(data, ensure_ascii=False)


def _read_inline_prompt() -> str:
    try:
        return _INLINE_PROMPT_PATH.read_text(encoding="utf-8")
    except OSError:
        return "OpenUI inline guidance unavailable — prompts/openui-inline-ui.md missing."


def register(ctx: Any) -> None:
    """Register the OpenUI helper surface with Hermes Agent."""

    if _SKILL_PATH.exists():
        ctx.register_skill("openui-app", _SKILL_PATH, "OpenUI app authoring guide")

    schema = {
        "name": "openui_instructions",
        "description": (
            "Return the Hermes OS OpenUI instructions for rendering rich UI "
            "inside assistant responses. Call before producing openui-lang."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "surface": {
                    "type": "string",
                    "enum": ["inline", "app"],
                    "description": "Which OpenUI surface needs guidance.",
                    "default": "inline",
                }
            },
        },
    }

    def handle_openui_instructions(params: dict[str, Any], **_: Any) -> str:
        surface = str((params or {}).get("surface") or "inline").lower()
        if surface == "app" and _SKILL_PATH.exists():
            return _json({"success": True, "surface": "app", "instructions": _SKILL_PATH.read_text(encoding="utf-8")})
        return _json({"success": True, "surface": "inline", "instructions": _read_inline_prompt()})

    ctx.register_tool(
        name="openui_instructions",
        toolset="hermes_os",
        schema=schema,
        handler=handle_openui_instructions,
        description="Fetch OpenUI/openui-lang rendering instructions for Hermes OS.",
    )

    def openui_command(args: str = "", **_: Any) -> str:
        del args
        return "Hermes OS OpenUI is enabled. Use the openui_instructions tool or skill_view('hermes-os:openui-app') before emitting openui-lang."

    ctx.register_command("openui", openui_command, "Show Hermes OS OpenUI usage guidance.")
