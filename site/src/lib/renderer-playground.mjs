import { OCF_RENDERER_COMMIT } from './renderer-version.mjs';
import { OCF_VALIDATOR_COMMIT } from './validator-version.mjs';

export function parseDocument(text) {
  let value;
  try {
    value = JSON.parse(text);
  } catch (err) {
    return { ok: false, message: `Invalid JSON: ${err.message}` };
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, message: 'Document must be a JSON object.' };
  }
  if (!Array.isArray(value.frames)) {
    return { ok: false, message: 'Document is missing a "frames" array.' };
  }
  return { ok: true, value };
}

export function clampFrameIndex(index, frameCount) {
  if (!Number.isFinite(frameCount) || frameCount <= 0) return 0;
  if (!Number.isFinite(index)) return 0;
  const i = Math.trunc(index);
  return Math.max(0, Math.min(i, frameCount - 1));
}

export function canRender(validationResult) {
  return (
    validationResult != null &&
    typeof validationResult === 'object' &&
    validationResult.valid === true
  );
}

/**
 * Sanitize an error message for safe display in the UI.
 * Strips local file paths, internal stack traces, and caps at 300 characters.
 */
export function sanitizeErrorMessage(err) {
  if (err == null) return 'Unknown error.';

  let raw;
  if (typeof err === 'string') {
    raw = err;
  } else if (typeof err.message === 'string') {
    raw = err.message;
  } else {
    return 'Unknown error.';
  }

  // Collapse newlines to spaces
  let msg = raw.replace(/[\r\n]+/g, ' ');

  // Strip absolute POSIX/Unix paths (e.g. /Users/foo/bar.js, /home/user/x)
  msg = msg.replace(/\/(?:[\w.-]+\/)+[\w.-]+/g, '<path>');

  // Strip Windows-style paths (e.g. C:\Users\foo\bar.js)
  msg = msg.replace(/[A-Za-z]:\\(?:[\w.-]+\\)*[\w.-]+/g, '<path>');

  // Strip file:// URIs
  msg = msg.replace(/file:\/\/[^\s)]+/g, '<path>');

  // Strip V8 stack trace lines: "    at FunctionName (file:line:col)" or "    at file:line:col"
  msg = msg.replace(/\s+at\s+(?:[\w.<>]+\s+\()?[^)]+\)?/g, '');

  // Collapse multiple spaces
  msg = msg.replace(/\s{2,}/g, ' ').trim();

  // Cap at 300 characters
  if (msg.length > 300) {
    msg = msg.slice(0, 297) + '...';
  }

  return msg || 'Unknown error.';
}

export function buildFeedbackMarkdown(input) {
  const {
    json = '',
    frameIndex = 0,
    validation = null,
    rendererCommit = OCF_RENDERER_COMMIT,
    validatorCommit = OCF_VALIDATOR_COMMIT,
  } = input;

  const rendererShort = rendererCommit.slice(0, 7);
  const validatorShort = validatorCommit.slice(0, 7);

  let validLine = 'n/a';
  if (validation && typeof validation === 'object') {
    const errs = Array.isArray(validation.errors) ? validation.errors.length : 0;
    const warns = Array.isArray(validation.warnings) ? validation.warnings.length : 0;
    validLine = validation.valid
      ? `valid (${errs} error(s), ${warns} warning(s))`
      : `invalid (${errs} error(s), ${warns} warning(s))`;
  }

  return [
    '## OCF Renderer Playground Feedback',
    '',
    `**Renderer:** ${rendererShort} (${rendererCommit})`,
    `**Validator:** ${validatorShort} (${validatorCommit})`,
    `**Frame:** ${frameIndex}`,
    `**Validation:** ${validLine}`,
    '',
    '### Document',
    '',
    '```json',
    json,
    '```',
    '',
  ].join('\n');
}
