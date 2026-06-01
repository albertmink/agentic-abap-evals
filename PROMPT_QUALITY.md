# Prompt quality checklist

Use this when adding or revising a prompt under `prompts/`. The rules below are what make a benchmark trustworthy: prompts that are specific, rubrics that can't be gamed, answers that mean what they look like they mean.

## The question

1. **Read-only, idempotent, non-destructive.** No write, no edit, no destination state mutation.
2. **Independent.** Doesn't rely on a previous prompt having run, or on local files written during another eval.
3. **Phrased by purpose, not by keyword.** If the answer's class/method/identifier appears verbatim in the prompt, the agent can win with a quick text search and skip the navigation work we are trying to test. Use synonyms, role descriptions, or domain phrasing (e.g. "the AFF logging interface — the method that records informational entries" rather than "`add_info` on `if_aff_log`").
4. **Multi-hop where the goal is depth.** A coverage test for one capability (hover, find_references) can be one hop. Anything labelled "complex" should require enumeration → inspection → judgment, the kind of trajectory you would expect ~10–30 tool calls for.
5. **Stable target.** SAP-standard objects (`cl_aff_*`, `cl_abap_compiler`, `if_aff_log`) — not customer Z-classes that may change between systems or get refactored in newer releases. Stability beats novelty. If a customer object is the only viable entry point, document a substitution in the spec's `notes` field.
6. **Single verifiable answer.** No lists, no ranked outputs, no "describe" prompts. The answer should be one identifier, line number, type name, or boolean. If the answer naturally has multiple correct forms, *the prompt* must constrain output format ("reply only with the class name").

## The success rubric

7. **Substring needles must be specific to the right answer.** `ENDMETHOD` or `method ` will pass for *any* method-shaped output and gives a false-positive baseline. Prefer the actual identifier the agent should land on (`get_sy_message`, `cl_ddls_aff_object_handler`).
8. **For tasks with no known ground truth yet:** run the prompt once to discover the canonical answer, then tighten the needle. Don't ship a loose needle and forget.
9. **Loose needles are acceptable for negative-path prompts** (`"not found"`, `"no references"`, `"could not find"`) — there the answer space is the *category* of correct response.
10. **Use `antiNeedles` to catch lying.** For negative-path prompts, forbid patterns like `Found \d+ reference` or `Line:\s*\d+` — anything that would only appear if the agent fabricated content. For training-data-hallucination-prone prompts (DDIC tables in particular), forbid the common wrong answers (`^\s*tadir\s*$`, `^\s*trdir\s*$`).
11. **The needle must be unique to the correct answer, not on every plausible path.** If the same identifier appears in both the right answer *and* a defensible-but-wrong answer, substring grading silently passes wrong runs. Symptoms: rubric needs antiNeedles to *invert* the meaning of a found needle; iterating on grader rules without changing the prompt; pass rate moves only when you add escape valves. Either rewrite the question so the needle is unique to the correct answer (preferred), or accept that the question needs a multi-criterion judge — don't bolt regex layers on top.
12. **When you're firefighting the rubric, look at the prompt.** Multi-part questions ("which runs first AND who calls it") often have multiple-correct answers across reasoning layers. Split into separate prompts, each with one verifiable answer.

## Capability constraints (this repo's addition)

13. **Default constraints in [`defaults.json`](defaults.json) apply to every prompt.** Don't repeat them. Override a default only with a documented reason in `notes`.
14. **`forbiddenCapabilities` is for prompt-specific restraint tests.** `nonexistent-class` forbids `referenceSearch` because the test is "agent decides not to call it." Most prompts don't need this field.
15. **Capability names come from [`CAPABILITIES.md`](CAPABILITIES.md).** If your prompt needs a term that isn't there, propose adding it in the same PR.
16. **Don't put concrete tool names anywhere in the spec.** That is the runner's job to translate. Tool names date the spec to a particular agent stack and break portability.

## Hygiene

17. **One JSON file per prompt.** Filename = `id` field. Keep `description` short — one or two sentences saying what regression this prompt would catch.
18. **No timestamps, run counts, or other run-state in the prompt file.** Those belong in your runner's output, not in the spec.
19. **Tighten on every miscalibration.** When you see a prompt landing the right answer for the wrong reason (or vice versa), the prompt is teaching you the rubric is wrong. Update it immediately — don't accumulate creaky prompts.
20. **Validate every new spec by running it once against your own agent stack.** The PR description should include the final answer your agent produced and the system you tested against.

## Quick checklist before opening a PR

- [ ] Phrased by purpose; the answer identifier is not in the prompt
- [ ] `category` declared (`coverage`, `multi-hop`, or `negative-path`)
- [ ] Targets SAP-standard, stable objects (or documents a customer-object substitution)
- [ ] Single verifiable answer, with output format pinned in the prompt if needed
- [ ] `success.needles` are specific to the right answer (or category, for negative-path)
- [ ] The needle does **not** appear on plausible wrong-answer paths (rule 11)
- [ ] One question per prompt — split lifecycle/ordering questions from caller-location questions (rule 12)
- [ ] `antiNeedles` cover the specific shapes of fabrication this prompt is vulnerable to
- [ ] `constraints` only added if a capability needs prompt-specific override or a `forbiddenCapabilities` entry
- [ ] No tool names anywhere in the spec
- [ ] Fixture added to `grading/grade.test.mjs` with one good answer and two or three plausible-wrong answers
- [ ] `node grading/grade.test.mjs` passes
- [ ] Validated by running it once and pasting the trajectory into the PR
