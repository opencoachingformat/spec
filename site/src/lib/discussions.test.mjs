import assert from 'node:assert/strict';
import { buildDiscussionUrl, DEFAULT_FEEDBACK_STATE } from './discussions.mjs';

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

console.log('discussions helper tests');

test('buildDiscussionUrl: returns category URL when slug is provided', () => {
  const url = buildDiscussionUrl('renderer', { renderer: 'renderer-feedback' });
  assert.ok(url.includes('github.com/opencoachingformat/spec/discussions/categories/'), 'should include categories path');
  assert.ok(url.includes('renderer-feedback'), 'should include category slug');
});

test('buildDiscussionUrl: returns general discussions URL when category is empty', () => {
  const url = buildDiscussionUrl('editor', { editor: '' });
  assert.equal(url, 'https://github.com/opencoachingformat/spec/discussions');
});

test('buildDiscussionUrl: returns general discussions URL when category is missing', () => {
  const url = buildDiscussionUrl('validator', { renderer: 'renderer-feedback' });
  assert.equal(url, 'https://github.com/opencoachingformat/spec/discussions');
});

test('buildDiscussionUrl: URL-encodes category slug', () => {
  const url = buildDiscussionUrl('spec', { spec: 'spec discussion' });
  assert.ok(url.includes('spec%20discussion'), 'should encode spaces');
  assert.ok(!url.includes('spec discussion'), 'should not contain unencoded space');
});

test('buildDiscussionUrl: does not include user JSON in URL', () => {
  const url = buildDiscussionUrl('renderer', { renderer: 'feedback' });
  assert.ok(!url.includes('{'), 'should not contain JSON');
  assert.ok(!url.includes('"'), 'should not contain quotes');
});

test('buildDiscussionUrl: handles all module targets', () => {
  const specUrl = buildDiscussionUrl('spec', { spec: 'spec-feedback' });
  const validatorUrl = buildDiscussionUrl('validator', { validator: 'validator-feedback' });
  const rendererUrl = buildDiscussionUrl('renderer', { renderer: 'renderer-feedback' });
  const editorUrl = buildDiscussionUrl('editor', { editor: 'editor-feedback' });

  assert.ok(specUrl.includes('spec-feedback'));
  assert.ok(validatorUrl.includes('validator-feedback'));
  assert.ok(rendererUrl.includes('renderer-feedback'));
  assert.ok(editorUrl.includes('editor-feedback'));
});

test('buildDiscussionUrl: returns general URL when config is empty object', () => {
  const url = buildDiscussionUrl('renderer', {});
  assert.equal(url, 'https://github.com/opencoachingformat/spec/discussions');
});

test('buildDiscussionUrl: returns general URL when config is null', () => {
  const url = buildDiscussionUrl('renderer', null);
  assert.equal(url, 'https://github.com/opencoachingformat/spec/discussions');
});

test('DEFAULT_FEEDBACK_STATE: copyToClipboard is false by default', () => {
  assert.equal(DEFAULT_FEEDBACK_STATE.copyToClipboard, false);
});

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}

console.log(`\n${passed} test(s) passed`);
