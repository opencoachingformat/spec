import assert from 'node:assert/strict';
import {
  parseDocument,
  clampFrameIndex,
  canRender,
  buildFeedbackMarkdown,
} from './renderer-playground.mjs';
import { OCF_RENDERER_COMMIT } from './renderer-version.mjs';
import { OCF_VALIDATOR_COMMIT } from './validator-version.mjs';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL: ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

console.log('renderer-playground helper tests');

test('parseDocument: valid JSON with frames', () => {
  const result = parseDocument('{"frames":[{"id":"f1"}]}');
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.frames, [{ id: 'f1' }]);
});

test('parseDocument: invalid JSON returns error', () => {
  const result = parseDocument('{bad json');
  assert.equal(result.ok, false);
  assert.match(result.message, /Invalid JSON/);
});

test('parseDocument: empty string returns error', () => {
  const result = parseDocument('');
  assert.equal(result.ok, false);
});

test('parseDocument: JSON array returns error', () => {
  const result = parseDocument('[1,2,3]');
  assert.equal(result.ok, false);
  assert.match(result.message, /JSON object/);
});

test('parseDocument: null returns error', () => {
  const result = parseDocument('null');
  assert.equal(result.ok, false);
});

test('parseDocument: object without frames returns error', () => {
  const result = parseDocument('{"meta":{}}');
  assert.equal(result.ok, false);
  assert.match(result.message, /frames/);
});

test('parseDocument: empty frames array is valid', () => {
  const result = parseDocument('{"frames":[]}');
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.frames, []);
});

test('clampFrameIndex: zero index with normal count', () => {
  assert.equal(clampFrameIndex(0, 5), 0);
});

test('clampFrameIndex: middle index', () => {
  assert.equal(clampFrameIndex(2, 5), 2);
});

test('clampFrameIndex: last valid index', () => {
  assert.equal(clampFrameIndex(4, 5), 4);
});

test('clampFrameIndex: out of range high clamps to max', () => {
  assert.equal(clampFrameIndex(10, 5), 4);
});

test('clampFrameIndex: negative clamps to 0', () => {
  assert.equal(clampFrameIndex(-1, 5), 0);
});

test('clampFrameIndex: NaN clamps to 0', () => {
  assert.equal(clampFrameIndex(NaN, 5), 0);
});

test('clampFrameIndex: zero frame count returns 0', () => {
  assert.equal(clampFrameIndex(0, 0), 0);
});

test('clampFrameIndex: negative frame count returns 0', () => {
  assert.equal(clampFrameIndex(3, -1), 0);
});

test('clampFrameIndex: single frame', () => {
  assert.equal(clampFrameIndex(0, 1), 0);
  assert.equal(clampFrameIndex(1, 1), 0);
  assert.equal(clampFrameIndex(-1, 1), 0);
});

test('clampFrameIndex: float index truncated', () => {
  assert.equal(clampFrameIndex(2.7, 5), 2);
});

test('canRender: valid result returns true', () => {
  assert.equal(canRender({ valid: true, errors: [], warnings: [] }), true);
});

test('canRender: invalid result returns false', () => {
  assert.equal(canRender({ valid: false, errors: [{ code: 'E1' }], warnings: [] }), false);
});

test('canRender: null returns false', () => {
  assert.equal(canRender(null), false);
});

test('canRender: undefined returns false', () => {
  assert.equal(canRender(undefined), false);
});

test('canRender: valid with warnings still true', () => {
  assert.equal(canRender({ valid: true, errors: [], warnings: [{ code: 'W1' }] }), true);
});

test('canRender: missing valid property returns false', () => {
  assert.equal(canRender({ errors: [] }), false);
});

test('buildFeedbackMarkdown: includes JSON in fenced block', () => {
  const md = buildFeedbackMarkdown({
    json: '{"frames":[]}',
    frameIndex: 0,
    validation: { valid: true, errors: [], warnings: [] },
    rendererCommit: 'abc1234567890',
    validatorCommit: 'def9876543210',
  });
  assert.ok(md.includes('```json'), 'missing fenced code block');
  assert.ok(md.includes('{"frames":[]}'), 'missing JSON content');
  assert.ok(md.includes('```'), 'missing closing fence');
});

test('buildFeedbackMarkdown: includes frame index', () => {
  const md = buildFeedbackMarkdown({
    json: '{}',
    frameIndex: 2,
    validation: { valid: true, errors: [], warnings: [] },
    rendererCommit: 'abc123',
    validatorCommit: 'def456',
  });
  assert.match(md, /\*\*Frame:\*\*\s*2/);
});

test('buildFeedbackMarkdown: includes renderer SHA', () => {
  const md = buildFeedbackMarkdown({
    json: '{}',
    frameIndex: 0,
    validation: { valid: true, errors: [], warnings: [] },
    rendererCommit: OCF_RENDERER_COMMIT,
    validatorCommit: OCF_VALIDATOR_COMMIT,
  });
  assert.ok(md.includes(OCF_RENDERER_COMMIT.slice(0, 7)), 'missing renderer short SHA');
});

test('buildFeedbackMarkdown: includes validator SHA', () => {
  const md = buildFeedbackMarkdown({
    json: '{}',
    frameIndex: 0,
    validation: { valid: true, errors: [], warnings: [] },
    rendererCommit: OCF_RENDERER_COMMIT,
    validatorCommit: OCF_VALIDATOR_COMMIT,
  });
  assert.ok(md.includes(OCF_VALIDATOR_COMMIT.slice(0, 7)), 'missing validator short SHA');
});

test('buildFeedbackMarkdown: includes validation result', () => {
  const md = buildFeedbackMarkdown({
    json: '{}',
    frameIndex: 0,
    validation: { valid: false, errors: [{ code: 'E1' }], warnings: [{ code: 'W1' }] },
    rendererCommit: 'abc',
    validatorCommit: 'def',
  });
  assert.ok(md.includes('invalid'), 'should show invalid');
  assert.ok(md.includes('1 error(s)'), 'should show error count');
  assert.ok(md.includes('1 warning(s)'), 'should show warning count');
});

test('buildFeedbackMarkdown: uses pinned commits by default', () => {
  const md = buildFeedbackMarkdown({
    json: '{}',
    frameIndex: 0,
    validation: { valid: true, errors: [], warnings: [] },
  });
  assert.ok(md.includes(OCF_RENDERER_COMMIT), 'missing pinned renderer commit');
  assert.ok(md.includes(OCF_VALIDATOR_COMMIT), 'missing pinned validator commit');
});

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}

console.log(`\n${passed} test(s) passed`);
