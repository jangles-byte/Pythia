# PYTHIA skill for Hermes

A self-contained Hermes skill that teaches your agent how to **use** PYTHIA's
local agent API (`http://localhost:8088`) — read the live world view, pull
filtered events, read/trigger forecasts, and ask grounded questions.

It is usage-only: no setup or install steps for PYTHIA itself, just how to call it.

## Install (one copy)

Drop the `pythia` folder into your Hermes skills directory:

```bash
cp -R integrations/hermes/skills/pythia ~/.hermes/skills/
```

That's it. Hermes will pick up `~/.hermes/skills/pythia/SKILL.md` and use the
skill whenever a task needs real-world context or a forecast.

> PYTHIA itself must be running for the skill to return data — start it with
> `./run-all.sh` from the repo root (see the main README). The skill assumes the
> default address `http://localhost:8088`.
