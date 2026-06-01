// grade.test.mjs — sanity checks for the grader and rubric examples.
//
// Two purposes:
//   1. Confirm grade.mjs's logic on synthetic specs.
//   2. Confirm each shipped prompt rubric distinguishes a known-good answer
//      from plausible-wrong answers — catches rule-11 violations in the
//      PROMPT_QUALITY guide before a spec ships.
//
// Run: node grading/grade.test.mjs   (exits 0 on success, 1 on failure)

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { grade } from './grade.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const promptsDir = join(__dirname, '..', 'prompts');

let failed = 0;
function test(name, fn) {
  try {
    fn();
    process.stdout.write(`  ok  ${name}\n`);
  } catch (e) {
    failed++;
    process.stdout.write(`  FAIL  ${name}\n        ${e.message}\n`);
  }
}
function assertEq(a, b, msg = '') {
  if (a !== b) throw new Error(`${msg} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// ───────────────────────────── grader logic ─────────────────────────────

process.stdout.write('grader logic\n');

test('substring_any matches when any needle is present', () => {
  const spec = { success: { type: 'substring_any', needles: ['foo', 'bar'], caseInsensitive: false } };
  assertEq(grade(spec, 'the answer is bar').pass, true);
});

test('substring_any fails when no needle is present', () => {
  const spec = { success: { type: 'substring_any', needles: ['foo', 'bar'], caseInsensitive: false } };
  assertEq(grade(spec, 'the answer is baz').pass, false);
});

test('caseInsensitive folds both sides', () => {
  const spec = { success: { type: 'substring_any', needles: ['FOO'], caseInsensitive: true } };
  assertEq(grade(spec, 'the answer is foo').pass, true);
});

test('caseInsensitive false is strict', () => {
  const spec = { success: { type: 'substring_any', needles: ['FOO'], caseInsensitive: false } };
  assertEq(grade(spec, 'the answer is foo').pass, false);
});

test('substring_all requires every needle', () => {
  const spec = { success: { type: 'substring_all', needles: ['a', 'b', 'c'], caseInsensitive: false } };
  assertEq(grade(spec, 'a b c').pass, true);
  assertEq(grade(spec, 'a b').pass, false);
});

test('antiNeedles fail an otherwise-passing answer', () => {
  const spec = {
    success: { type: 'substring_any', needles: ['ok'], caseInsensitive: false },
    antiNeedles: ['Found \\d+ reference'],
  };
  assertEq(grade(spec, 'ok and Found 12 references').pass, false);
  assertEq(grade(spec, 'ok and nothing else').pass, true);
});

test('antiNeedle regex is case-insensitive by default', () => {
  const spec = {
    success: { type: 'substring_any', needles: ['ok'], caseInsensitive: false },
    antiNeedles: ['line:\\s*\\d+'],
  };
  assertEq(grade(spec, 'ok at Line: 42').pass, false);
});

test('unsupported success.type fails cleanly', () => {
  const spec = { success: { type: 'regex_match', needles: ['foo'] } };
  const r = grade(spec, 'foo');
  assertEq(r.pass, false);
  assert(r.reasons.some((x) => x.includes('unsupported')), 'reason mentions unsupported');
});

test('missing spec.success fails cleanly', () => {
  assertEq(grade({}, 'foo').pass, false);
});

// ──────────────────────── rubric self-check on shipped specs ────────────────────────

// For each shipped prompt, exercise the rubric with a known-good answer
// (must pass) and one or more known-wrong answers (must fail). This is what
// catches rule-11 violations: a needle that lands on a defensible-but-wrong
// answer would silently turn a wrong run into a pass, and we'd never know.
const fixtures = {
  'aff-handler-intermediate-parent': {
    good: ['cl_aff_object_handler_withsubs'],
    bad: ['cl_aff_object_handler', 'cl_some_other_class', 'I am not sure'],
  },
  'aff-handler-no-deserialize': {
    good: ['cl_ddls_aff_object_handler', 'CL_AOBJ_AFF_OBJECT_HANDLER'],
    bad: ['cl_aff_object_handler', 'none of them override it', 'cl_aff_log'],
  },
  'atc-check-call-order': {
    good: ['cl_ci_tests', 'CL_CI_CHECK_VALIDATOR'],
    bad: ['cl_ci_test_root', 'cl_ycm_cc_check_api_usage', 'cl_aff_log'],
  },
  'db-table-from-exists-method': {
    good: ['seoclass', 'SEOCLASS'],
    // antiNeedles forbid bare TADIR / TRDIR — typical training-data hallucinations.
    bad: ['tadir', 'TRDIR', 'reposrc'],
  },
  'longest-method-large': {
    good: ['method get_all_single_refs at lines 22944 to 25481'],
    bad: ['get_all_single_refs', '22944 25481', 'some_other_method 1 999'],
  },
  'nonexistent-class': {
    good: ['the class does not exist', 'no matches found', "doesn't exist in the system"],
    bad: ['Found 3 references', 'Line: 42 in cl_some_class'],
  },
};

process.stdout.write('\nshipped prompt rubrics\n');

const promptFiles = readdirSync(promptsDir).filter((f) => f.endsWith('.json'));
for (const file of promptFiles) {
  const id = file.replace(/\.json$/, '');
  const spec = JSON.parse(readFileSync(join(promptsDir, file), 'utf8'));
  const fix = fixtures[id];
  if (!fix) {
    test(`${id} has fixtures`, () => {
      throw new Error(`no fixtures for ${id} — add to grade.test.mjs`);
    });
    continue;
  }
  for (const g of fix.good) {
    test(`${id}: good answer passes — "${g.slice(0, 50)}"`, () => {
      const r = grade(spec, g);
      assert(r.pass, `expected pass; reasons: ${r.reasons.join('; ')}`);
    });
  }
  for (const b of fix.bad) {
    test(`${id}: bad answer fails — "${b.slice(0, 50)}"`, () => {
      const r = grade(spec, b);
      assert(!r.pass, `expected fail but passed; reasons: ${r.reasons.join('; ')}`);
    });
  }
}

process.stdout.write(`\n${failed === 0 ? 'all tests passed' : `${failed} test(s) failed`}\n`);
process.exit(failed === 0 ? 0 : 1);
