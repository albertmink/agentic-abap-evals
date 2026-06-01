# Capabilities

A vendor-neutral vocabulary the prompt specs use to express what an agent is or is not allowed to do during a run. Runners enforce these by translating each capability term into their own concrete denylists (e.g. for Claude Code: `--disallowedTools <names>`). The grader does not enforce capabilities — it only sees the agent's final answer.

The split is deliberate: capability names belong to the spec because they survive across agent stacks; concrete tool names belong to the runner because they don't.

## Capability vocabulary

| capability | meaning | typical reason an ABAP eval might forbid it |
|---|---|---|
| `localFilesystemAccess` | reading or writing files on the runner's local disk | ABAP source lives as virtual files on the SAP system. A local `grep`/`find`/`cat` fallback by definition cannot find ABAP — any answer it produces is hallucinated. |
| `shellExecution` | running arbitrary OS commands | Same as above; also a generic exfiltration / hallucination vector. |
| `webSearch` | querying the open web | We want to measure the agent's ABAP grounding, not its ability to find a Stack Overflow post that quotes the answer. |
| `subAgents` | spawning sub-agents to delegate work | Keeps the trajectory single-agent so measurements compare like with like. |
| `destinationMutation` | writing to or executing on the SAP system | The suite is read-only. Any mutation is out of scope and unsafe to run against a shared system. |
| `referenceSearch` | finding callers / usages of an ABAP symbol | Used in restraint tests (`nonexistent-class`): the agent should reason from a search miss, not call reference-search on a target it knows does not exist. |

## How a spec uses them

Defaults apply to every prompt. They live in [`defaults.json`](defaults.json) at the repo root:

```json
{
  "constraints": {
    "localFilesystemAccess": false,
    "shellExecution": false,
    "webSearch": false,
    "subAgents": false,
    "destinationMutation": false
  }
}
```

A prompt's own `constraints` block is an *override and extension* layer. Override a default by re-stating the key with a new value (rarely needed). Extend by adding `forbiddenCapabilities` for prompt-specific bans:

```json
"constraints": {
  "forbiddenCapabilities": ["referenceSearch"]
}
```

The runner is expected to merge the two and refuse any tool whose capability matches a `false` (or appears in `forbiddenCapabilities`).

## Mapping to a real runner — example

For a Claude Code-based runner, the typical mapping looks like:

| capability | concrete tool names to deny |
|---|---|
| `localFilesystemAccess` | `Bash`, `Read`, `Grep`, `Glob`, `Edit`, `Write`, `NotebookEdit` |
| `shellExecution` | `Bash` |
| `webSearch` | `WebFetch`, `WebSearch` |
| `subAgents` | `Agent`, `Task`, `Skill` |
| `destinationMutation` | (whatever the runner's MCP server names them — e.g. `*_edit_source`, `*_run_*`) |
| `referenceSearch` | (whatever the runner's MCP server names it — e.g. `*_find_references`) |

Other runners draw the lines elsewhere. That is the point of this layer.

## Adding a capability

Adding a term to the vocabulary changes the spec contract — every existing prompt and every existing runner is implicitly affected. Use a PR with:

- The new capability name (one word, camelCase if compound).
- One sentence on what it means.
- One sentence on why an ABAP eval would forbid (or require) it — the use case must be concrete, not speculative.
- A test fixture: a prompt that demonstrably needs the term to express its constraint.

We expect to add terms slowly. The current six cover everything the showcase suite expresses.
