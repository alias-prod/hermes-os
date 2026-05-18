# @openuidev/hermes-os-plugin

Hermes OS plugin assets for Hermes Agent.

This package follows the official Hermes plugin shape:

```text
plugin.yaml
__init__.py        # register(ctx)
prompts/
skills/
```

The plugin registers:

- `openui_instructions` tool — returns inline/app OpenUI guidance.
- `openui-app` skill — durable OpenUI app authoring instructions.
- `/openui` command — short usage hint inside Hermes sessions.

Install by copying this directory to `~/.hermes/plugins/hermes-os/` or by packaging it through a Hermes-compatible plugin distribution path, then enable it with:

```bash
hermes plugins enable hermes-os
```

Project-local plugins under `./.hermes/plugins/` require `HERMES_ENABLE_PROJECT_PLUGINS=true`, per Hermes' plugin docs.
