# agentic-abap-evals

A vendor-neutral collection of agentic ABAP benchmarks.

Each eval is a natural-language task an ABAP developer might hand to an agent (find an override, walk a type hierarchy, locate a framework dispatcher) plus a rubric that grades the agent's final answer **without inspecting how it got there**. Bring any agent stack — MCP server, IDE plugin, custom integration. If it answers the question, it passes.

Today this repo is a curated showcase of what is possible. Over time, the goal is a shared platform on which any ABAP-aware agent can be measured against a common bar.

## The six showcase evals

| id | category | what's hard about it |
|---|---|---|
| [`aff-handler-intermediate-parent`](prompts/aff-handler-intermediate-parent.json) | multi-hop | Walk two sibling inheritance chains and identify the intermediate ancestor one passes through. |
| [`aff-handler-no-deserialize`](prompts/aff-handler-no-deserialize.json) | multi-hop | Enumerate handler classes, inspect each override, find the one that diverges from the base. |
| [`atc-check-call-order`](prompts/atc-check-call-order.json) | multi-hop | The redefinition is not the call site. Find the framework class that actually dispatches the method. |
| [`db-table-from-exists-method`](prompts/db-table-from-exists-method.json) | multi-hop | Bridge OO repo → DDIC. Resists training-data hallucinations like `TADIR`/`TRDIR`. |
| [`longest-method-large`](prompts/longest-method-large.json) | multi-hop | Find the longest public method in a class large enough that whole-file reads should not be cheaper. |
| [`nonexistent-class`](prompts/nonexistent-class.json) | negative-path | Restraint test. The agent should run one search, see nothing, and stop — no fabrications. |

All six target SAP-standard objects (`cl_aff_*`, `cl_abap_compiler`, `if_ci_test`) so any system with a standard ABAP stack can run them. One (`atc-check-call-order`) references a customer Z-class as the entry point — see its `notes` field for substitutions.

## How to use them

The flow is intentionally simple — the suite makes no assumptions about your agent stack:

1. **Pick a prompt.** Read the `prompt` field from any JSON in `prompts/`.
2. **Hand the prompt text to your agent.** That's it. No tool list, no system message we mandate.
3. **Grade the agent's final reply.** Pass the spec and the answer text to `grading/grade.mjs`.

```bash
# CLI use
echo "cl_ddls_aff_object_handler" > /tmp/answer.txt
node grading/grade.mjs prompts/aff-handler-no-deserialize.json /tmp/answer.txt
# → PASS  (exit code 0)
```

```js
// Library use, from any Node-based runner
import { grade } from './grading/grade.mjs';
import { readFileSync } from 'node:fs';

const spec = JSON.parse(readFileSync('prompts/aff-handler-no-deserialize.json', 'utf8'));
const answer = await myAgent.run(spec.prompt);
const { pass, reasons } = grade(spec, answer);
```

Run the grader's own self-tests any time:

```bash
node grading/grade.test.mjs
```

## What "tool-agnostic" means

The spec does **not** tell you which tools your agent should use. We grade outputs only; trajectories are your business.

What the spec *does* express, where it's relevant, is **constraints** — capability-level guardrails the runner is expected to enforce. ABAP source lives on the SAP system as virtual files; an agent that falls back to local `grep` or `find` is by definition hallucinating. So every prompt forbids `localFilesystemAccess`, `shellExecution`, `webSearch`, `subAgents`, and `destinationMutation` by default (see [`defaults.json`](defaults.json)). Individual prompts may add prompt-specific forbidden capabilities — `nonexistent-class` forbids `referenceSearch`, because the restraint signal we want is "agent decided not to call it."

The capability vocabulary lives in [`CAPABILITIES.md`](CAPABILITIES.md). Each capability term is mapped to "what this means at runtime" — your runner translates it to its own denylist (e.g. for Claude Code, this becomes `--disallowedTools Bash,Read,…`).

This split — vendor-neutral *capabilities* in the spec, vendor-specific *tool names* in the runner — is what lets the same eval run against different agent stacks without rewrites.

## Spec schema

```json
{
  "id": "task-id",
  "category": "multi-hop | negative-path | coverage",
  "description": "What capability or regression this prompt exercises (1–2 sentences).",
  "prompt": "The natural-language task handed to the agent.",
  "success": {
    "type": "substring_any | substring_all",
    "needles": ["..."],
    "caseInsensitive": true
  },
  "antiNeedles": ["regex pattern that, if matched, fails the run"],
  "constraints": {
    "forbiddenCapabilities": ["referenceSearch"]
  },
  "notes": "Free-form: ground-truth date, gotchas, ideal trajectory hints."
}
```

`prompt` and `success` are the only required fields. See [`PROMPT_QUALITY.md`](PROMPT_QUALITY.md) for the rubric-design rules every spec follows.

## Why grade only the answer (and not the trajectory)?

Trajectory grading — "did the agent call the right tool?" — only makes sense when you know the tool taxonomy. As soon as the suite leaves any one stack, that vocabulary breaks.

Output grading is portable, lossy, and honest. It misses cases where the agent guessed correctly without doing real work; it cannot reward elegant trajectories over clumsy ones. We accept that. The compensation is `antiNeedles` (catches lying patterns: fabricated line numbers, "Found N references" on non-existent classes) and prompts that are hard enough that guessing usually fails.

When trajectory-aware metrics matter to you, build them in your runner. Keep the spec portable.

## Roadmap

This is a v1 deliberately scoped to a curated showcase. Things we will add when there is reason to:

- More prompts. PRs welcome — see [`CONTRIBUTING.md`](CONTRIBUTING.md).
- Optional capability tags on prompts (`hover`, `referenceSearch`, `typeHierarchy`) once we have enough evals to make tagging useful for filtering.
- A reference runner harness, once two or more agent stacks have informally validated the suite.
- Aggregated benchmark dashboards, once the contributor base wants them.

We are explicit about what we are *not* shipping today: a runner, leaderboards, scheduled evals, regression baselines. Those are infrastructure choices that depend on community shape; we would rather see what contributors need than guess.

## Contributing

We want your evals. The bar is high — see [`PROMPT_QUALITY.md`](PROMPT_QUALITY.md) — but the format is small and the review loop is short. Read [`CONTRIBUTING.md`](CONTRIBUTING.md) and open a PR.

## License

MIT — see [`LICENSE`](LICENSE).
