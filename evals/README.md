# Trigger evals

Do the skill descriptions make Claude pick the skill when it should, and stay out when it shouldn't?

| File | Skill | Queries |
|---|---|---|
| [`ui-design.trigger.json`](ui-design.trigger.json) | `ui-design` | 10 should trigger · 10 should not |
| [`ui-design-slim.trigger.json`](ui-design-slim.trigger.json) | `ui-design-slim` | 10 should trigger · 10 should not |

Format — the one used by Anthropic's `skill-creator` skill: `[{ "query": "...", "should_trigger": true }]`.

Each set is meant for **one skill installed at a time** (the two descriptions overlap on purpose — you install one or the other).

The negative queries are near-misses, not random topics: logos, banners, slides, video, Word and Excel files (other skills cover them), and frontend work that is not interface design (build config, Safari flexbox bugs, lint setup, API code, translation files).

## Running

You need Claude Code (`claude -p`) and the `skill-creator` skill. Its scripts call `select()` on process pipes, so run them on **macOS or Linux** (or WSL), not in native Windows Python. Every query is sent to the model several times, so a run uses real tokens: 20 queries × 3 runs = 60 headless sessions per skill.

From the `skill-creator` folder:

```bash
python -m scripts.run_eval --eval-set /path/to/ui-design-skills/evals/ui-design.trigger.json --skill-path /path/to/ui-design-skills/ui-design --runs-per-query 3 --verbose
```

To let it propose a better description (60/40 train/held-out split, up to 5 rounds):

```bash
python -m scripts.run_loop --eval-set /path/to/ui-design-skills/evals/ui-design.trigger.json --skill-path /path/to/ui-design-skills/ui-design --model claude-opus-5-5 --max-iterations 5 --verbose
```

Take `best_description` from the output (it is chosen by the held-out score), put it into the skill's `SKILL.md`, and keep it under 1024 characters.

## Keeping the sets honest

- Add a query when a real request triggered the wrong thing, phrased the way the person actually wrote it.
- Keep roughly half positive, half negative, with the negatives as close to the boundary as you can.
- Don't tune a description until it passes one query that nobody would type.
