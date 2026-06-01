# Contributing

We want your evals. This guide covers the mechanics; [`PROMPT_QUALITY.md`](PROMPT_QUALITY.md) covers the design rubric every spec follows.

## What we accept

A new eval that:

- targets a **stable SAP-standard object** (`cl_*`, `if_*`, `i_*` CDS views, DDIC tables in the standard release) — not a customer Z-class that may not exist in the next reviewer's system,
- has **one verifiable answer** (an identifier, a line number, a type name, a category — not a list, not a "describe", not a ranked output),
- is **read-only and idempotent** — no destination state mutation, no dependence on previous runs,
- is phrased **by purpose**, not by keyword — if the answer's identifier appears verbatim in the prompt, the prompt isn't really testing anything.

That last rule is the one most first contributions miss. See `PROMPT_QUALITY.md` rule 3 for examples.

## How to submit

One PR per prompt. Keep the diff small.

The PR body should include:

1. **The question, in plain English** — one or two sentences on what regression this prompt would catch.
2. **The canonical answer** you verified.
3. **The system you verified it against** — release / SP / system identifier (rough is fine: "S/4HANA 2024 SP01"). This becomes the ground-truth date in the spec's `notes` field.
4. **Two or three plausible-wrong answers** — the most defensible incorrect responses you can think of. Reviewers will run them through the grader and confirm they fail.
5. **Trajectories from at least one agent stack** — paste the final answer and (optionally) a brief note on what the agent did. We use this to confirm the prompt isn't trivially solvable by training-data recall and isn't impossibly hard.

## Mechanics

### File and ID

```
prompts/<id>.json
```

`id` matches the filename. kebab-case. Short and descriptive (`hover-cds-column-type`, not `eval-1`).

### Spec template

Copy from [`prompts/aff-handler-no-deserialize.json`](prompts/aff-handler-no-deserialize.json) (the multi-hop template) or [`prompts/nonexistent-class.json`](prompts/nonexistent-class.json) (the negative-path template). Strip the fields you don't need.

Required: `id`, `category`, `description`, `prompt`, `success`.
Optional: `antiNeedles`, `constraints`, `notes`.

Do **not** include: `expectedTools`, `forbiddenTools`, `argChecks`, `toolCountCeiling`, `repeats`, `runTimeoutMs`. Those describe runner-side asserts; they don't belong in a portable spec.

### Categories

- `coverage` — one capability, one hop. ("Use hover on this method, report the return type.")
- `multi-hop` — enumeration → inspection → judgment. The trajectory is meaningful.
- `negative-path` — restraint test. The right answer is "no, that doesn't exist" or "I won't keep going."

We may add `ablation` (paired with a baseline; capability disabled in `constraints`) once we have enough material to justify it.

### Grading rubric

Stick to `substring_any` or `substring_all`. If you find yourself wanting regex success matching, the prompt is probably too open-ended — tighten it instead.

`antiNeedles` are regex (case-insensitive by default). Use them to catch the **specific shape of fabrication** the prompt is vulnerable to — `Found \d+ references` on a non-existent class, `^\s*tadir\s*$` for the training-data hallucination, `Line:\s*\d+` for invented line numbers. Don't use them to invert the meaning of a present needle (rule 11).

### Test your rubric before you submit

Add a fixture entry to `grading/grade.test.mjs`:

```js
'<your-prompt-id>': {
  good: ['the canonical answer'],
  bad: ['a defensible-but-wrong answer', 'another wrong answer'],
},
```

Run:

```bash
node grading/grade.test.mjs
```

All tests must pass. If a `bad` answer accidentally passes the rubric, fix the rubric (more specific needles, or an antiNeedle) before opening the PR. This is the canary for rule-11 violations.

### Constraints

Most prompts inherit the defaults from `defaults.json` and don't need a `constraints` block. Add one only when:

- the prompt is a **restraint test** and a particular capability must be off (`forbiddenCapabilities`),
- the prompt **legitimately needs** a default-off capability (rare; argue for it in the PR).

Capability names come from [`CAPABILITIES.md`](CAPABILITIES.md). If your eval needs a term that isn't there, propose adding it in the same PR (or a preceding one).

## Review

A maintainer will:

- Run `grade.test.mjs` on the new fixture.
- Run the prompt through one or two agent stacks they have access to.
- Sanity-check the spec against `PROMPT_QUALITY.md`.

Common review feedback:

- "The answer identifier is in the prompt." → rephrase by purpose.
- "This needle would also match a wrong answer." → tighten.
- "This needs `antiNeedles`." → add the fabrication pattern.
- "Z-class target." → switch to a standard object, or document a substitution.

We err on the side of merging fewer, higher-quality prompts. Better six that mean something than sixty that don't.

## Code of conduct

Be kind. We are all here to make ABAP agents demonstrably better.
