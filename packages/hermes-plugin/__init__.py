"""Hermes OS plugin."""

from __future__ import annotations

import json
import time
import uuid
from pathlib import Path
from typing import Any

from hermes_constants import get_hermes_home

_PLUGIN_DIR = Path(__file__).parent
_INLINE_PROMPT_PATH = _PLUGIN_DIR / "prompts" / "openui-inline-ui.md"
_SKILL_PATH = _PLUGIN_DIR / "skills" / "openui-app" / "SKILL.md"


def _json(data: Any) -> str:
    return json.dumps(data, ensure_ascii=False)


def _read_inline_prompt() -> str:
    try:
        return _INLINE_PROMPT_PATH.read_text(encoding="utf-8")
    except OSError:
        return "OpenUI inline guidance unavailable — prompts/openui-inline-ui.md missing."


def _state_dir() -> Path:
    return get_hermes_home() / "plugins" / "hermes-os"


def _apps_path() -> Path:
    return _state_dir() / "apps.json"


def _read_apps() -> list[dict[str, Any]]:
    try:
        data = json.loads(_apps_path().read_text(encoding="utf-8"))
        return [item for item in data if isinstance(item, dict)] if isinstance(data, list) else []
    except Exception:
        return []


def _write_apps(apps: list[dict[str, Any]]) -> None:
    path = _apps_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(apps, ensure_ascii=False, indent=2), encoding="utf-8")


def _app_summary(app: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": app.get("id", ""),
        "title": app.get("title", "Untitled app"),
        "agentId": app.get("agentId", "main"),
        "sessionKey": app.get("sessionKey", ""),
        "createdAt": app.get("createdAt", ""),
        "updatedAt": app.get("updatedAt", ""),
    }


def _merge_statements(existing: str, patch: str) -> str:
    lines = existing.splitlines()
    patch_lines = [line for line in patch.splitlines() if line.strip()]
    index: dict[str, int] = {}
    for i, line in enumerate(lines):
        if "=" in line and not line.lstrip().startswith("//"):
            name = line.split("=", 1)[0].strip()
            if name:
                index[name] = i
    for line in patch_lines:
        if "=" in line and not line.lstrip().startswith("//"):
            name = line.split("=", 1)[0].strip()
            if name in index:
                lines[index[name]] = line
                continue
        lines.append(line)
    return "\n".join(lines).strip() + "\n"


_HERMES_OS_CONTEXT = """
Hermes OS app system is available in this session.

Pick the surface:
- Inline `openui-lang` in chat: static, transient response card.
- Durable Hermes OS app: use `app_create` when the user asks for a dashboard, app, command center, war room, monitor, tracker, hub, briefing, live data, refreshable UI, or persistent surface they can reopen from Apps/sidebar/home.

For durable apps:
1. Call `openui_instructions({surface: "app"})` or load the `openui-app` skill first.
2. Build RAW openui-lang app code with `root = Stack(...)`.
3. Call `app_create({title, code})` immediately. Do not claim app tools are missing.
4. To edit an existing app, call `get_app({id})`, then `app_update({id, patch})` with only changed statements.
""".strip()


def register(ctx: Any) -> None:
    """Register the OpenUI helper surface with Hermes Agent."""

    if _SKILL_PATH.exists():
        ctx.register_skill("openui-app", _SKILL_PATH, "OpenUI app authoring guide")

    def inject_hermes_os_context(**_: Any) -> dict[str, str]:
        return {"context": _HERMES_OS_CONTEXT}

    try:
        ctx.register_hook("pre_llm_call", inject_hermes_os_context)
    except Exception:
        pass

    def handle_openui_instructions(params: dict[str, Any], **_: Any) -> str:
        surface = str((params or {}).get("surface") or "inline").lower()
        if surface == "app" and _SKILL_PATH.exists():
            return _json({"success": True, "surface": "app", "instructions": _SKILL_PATH.read_text(encoding="utf-8")})
        return _json({"success": True, "surface": "inline", "instructions": _read_inline_prompt()})

    ctx.register_tool(
        name="openui_instructions",
        toolset="hermes_os",
        schema={
            "name": "openui_instructions",
            "description": "Return Hermes OS OpenUI instructions. Call before producing openui-lang.",
            "parameters": {
                "type": "object",
                "properties": {"surface": {"type": "string", "enum": ["inline", "app"], "default": "inline"}},
            },
        },
        handler=handle_openui_instructions,
        description="Fetch OpenUI/openui-lang rendering instructions for Hermes OS.",
    )

    def app_create(params: dict[str, Any], **kwargs: Any) -> str:
        title = str((params or {}).get("title") or "Untitled app").strip() or "Untitled app"
        code = str((params or {}).get("code") or "").strip()
        if not code:
            return _json({"error": "app_create requires non-empty code"})
        now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        app = {
            "id": f"app-{uuid.uuid4().hex[:12]}",
            "title": title,
            "content": code,
            "agentId": str(kwargs.get("agent_id") or "main"),
            "sessionKey": str(kwargs.get("session_key") or ""),
            "createdAt": now,
            "updatedAt": now,
        }
        apps = _read_apps()
        apps.append(app)
        _write_apps(apps)
        return _json({"id": app["id"], "title": title, "createdAt": now, "message": "App saved. It is available in Hermes OS Apps."})

    def get_app(params: dict[str, Any], **_: Any) -> str:
        app_id = str((params or {}).get("id") or "")
        for app in _read_apps():
            if app.get("id") == app_id:
                return _json({"id": app.get("id"), "title": app.get("title"), "content": app.get("content")})
        return _json({"error": "App not found", "id": app_id})

    def app_update(params: dict[str, Any], **_: Any) -> str:
        app_id = str((params or {}).get("id") or "")
        patch = str((params or {}).get("patch") or "")
        apps = _read_apps()
        for app in apps:
            if app.get("id") == app_id:
                app["content"] = _merge_statements(str(app.get("content") or ""), patch)
                app["updatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                _write_apps(apps)
                return _json({"id": app_id, "updatedAt": app["updatedAt"], "message": "App updated"})
        return _json({"error": "App not found", "id": app_id})

    def list_apps(params: dict[str, Any] | None = None, **_: Any) -> str:
        del params
        return _json({"apps": [_app_summary(app) for app in _read_apps()]})

    for name, description, handler, properties, required in [
        ("app_create", "Create a durable Hermes OS app from raw openui-lang code.", app_create, {"title": {"type": "string"}, "code": {"type": "string"}}, ["title", "code"]),
        ("get_app", "Fetch an existing Hermes OS app by id before editing.", get_app, {"id": {"type": "string"}}, ["id"]),
        ("app_update", "Patch an existing Hermes OS app with changed/new openui-lang statements only.", app_update, {"id": {"type": "string"}, "patch": {"type": "string"}}, ["id", "patch"]),
        ("list_apps", "List durable Hermes OS apps.", list_apps, {}, []),
    ]:
        ctx.register_tool(
            name=name,
            toolset="hermes_os",
            schema={"name": name, "description": description, "parameters": {"type": "object", "properties": properties, "required": required}},
            handler=handler,
            description=description,
        )

    def api_list_apps(_request: dict[str, Any]) -> dict[str, Any]:
        return {"body": {"apps": [_app_summary(app) for app in _read_apps()]}}

    def api_get_app(request: dict[str, Any]) -> dict[str, Any]:
        app_id = str((request.get("match_info") or {}).get("app_id") or "")
        for app in _read_apps():
            if app.get("id") == app_id:
                return {"body": {"app": app}}
        return {"status": 404, "body": {"error": "App not found", "id": app_id}}

    def api_delete_app(request: dict[str, Any]) -> dict[str, Any]:
        app_id = str((request.get("match_info") or {}).get("app_id") or "")
        apps = _read_apps()
        _write_apps([app for app in apps if app.get("id") != app_id])
        return {"body": {"ok": True}}

    if hasattr(ctx, "register_api_route"):
        ctx.register_api_route(
            "GET",
            "apps",
            api_list_apps,
            description="List durable Hermes OS OpenUI apps.",
            feature="hermes_os.apps",
        )
        ctx.register_api_route(
            "GET",
            "apps/{app_id}",
            api_get_app,
            description="Fetch a durable Hermes OS OpenUI app.",
            feature="hermes_os.apps",
        )
        ctx.register_api_route(
            "DELETE",
            "apps/{app_id}",
            api_delete_app,
            description="Delete a durable Hermes OS OpenUI app.",
            feature="hermes_os.apps",
        )

    def openui_command(args: str = "", **_: Any) -> str:
        del args
        return "Hermes OS OpenUI is enabled. Use openui_instructions({surface:'app'}) and app_create for durable apps."

    ctx.register_command("openui", openui_command, "Show Hermes OS OpenUI usage guidance.")
