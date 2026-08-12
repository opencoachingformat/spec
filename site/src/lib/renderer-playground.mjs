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
