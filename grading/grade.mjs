// grade.mjs — canonical interpreter for prompt-spec rubrics.
//
// One job: given a spec and the agent's final-answer text, decide pass/fail
// and explain why. No tool-call inspection, no trajectory analysis — those
// are runner concerns. This grader is intentionally pure so every contributor
// and every agent vendor agrees on what a spec means.
//
// API:
//   import { grade } from './grade.mjs';
//   const result = grade(spec, answerText);
//   // → { pass: boolean, reasons: string[] }
//
// CLI:
//   node grade.mjs <spec.json> <answer.txt>
//   exits 0 on pass, 1 on fail; prints reasons to stderr.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Grade an agent's answer against a spec.
 * @param {object} spec — parsed prompt JSON (must have `success`; may have `antiNeedles`)
 * @param {string} answer — the agent's final reply text
 * @returns {{pass: boolean, reasons: string[]}}
 */
export function grade(spec, answer) {
  const reasons = [];
  if (!spec || typeof spec !== 'object') {
    return { pass: false, reasons: ['spec is not an object'] };
  }
  if (typeof answer !== 'string') {
    return { pass: false, reasons: ['answer is not a string'] };
  }
  if (!spec.success || typeof spec.success !== 'object') {
    return { pass: false, reasons: ['spec.success is missing'] };
  }

  const successOk = checkSuccess(spec.success, answer, reasons);
  const antiOk = checkAntiNeedles(spec.antiNeedles ?? [], answer, reasons);

  return { pass: successOk && antiOk, reasons };
}

function checkSuccess(success, answer, reasons) {
  const { type, needles, caseInsensitive } = success;
  if (!Array.isArray(needles) || needles.length === 0) {
    reasons.push('success.needles must be a non-empty array');
    return false;
  }
  const hay = caseInsensitive ? answer.toLowerCase() : answer;
  const norm = (n) => (caseInsensitive ? String(n).toLowerCase() : String(n));

  if (type === 'substring_any') {
    const hit = needles.find((n) => hay.includes(norm(n)));
    if (hit !== undefined) {
      reasons.push(`matched success needle: ${hit}`);
      return true;
    }
    reasons.push(`no success needle matched (expected any of: ${needles.join(', ')})`);
    return false;
  }

  if (type === 'substring_all') {
    const missing = needles.filter((n) => !hay.includes(norm(n)));
    if (missing.length === 0) {
      reasons.push(`matched all ${needles.length} success needles`);
      return true;
    }
    reasons.push(`missing required needles: ${missing.join(', ')}`);
    return false;
  }

  reasons.push(`unsupported success.type: ${type}`);
  return false;
}

function checkAntiNeedles(antiNeedles, answer, reasons) {
  if (!Array.isArray(antiNeedles) || antiNeedles.length === 0) return true;
  // antiNeedles are regex patterns. Default flag: 'i' (case-insensitive) — these
  // are fabrication-detectors, where casing is rarely the deciding factor.
  const hits = antiNeedles.filter((p) => {
    try {
      return new RegExp(p, 'i').test(answer);
    } catch {
      reasons.push(`invalid antiNeedle regex (treated as failed match): ${p}`);
      return false;
    }
  });
  if (hits.length === 0) return true;
  for (const h of hits) reasons.push(`antiNeedle matched (forbidden pattern present): ${h}`);
  return false;
}

// CLI entrypoint — only runs when invoked directly, not when imported.
if (import.meta.url === `file://${process.argv[1]}` || fileURLToPath(import.meta.url) === process.argv[1]) {
  const [specPath, answerPath] = process.argv.slice(2);
  if (!specPath || !answerPath) {
    process.stderr.write('usage: node grade.mjs <spec.json> <answer.txt>\n');
    process.exit(2);
  }
  const spec = JSON.parse(readFileSync(specPath, 'utf8'));
  const answer = readFileSync(answerPath, 'utf8');
  const { pass, reasons } = grade(spec, answer);
  process.stderr.write(reasons.map((r) => `  - ${r}`).join('\n') + '\n');
  process.stdout.write(pass ? 'PASS\n' : 'FAIL\n');
  process.exit(pass ? 0 : 1);
}
