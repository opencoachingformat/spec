const SPEC_DISCUSSIONS_URL = 'https://github.com/opencoachingformat/spec/discussions';

export const DEFAULT_FEEDBACK_STATE = {
  copyToClipboard: false,
};

export function buildDiscussionUrl(module, categoryConfig) {
  if (!categoryConfig || typeof categoryConfig !== 'object') {
    return SPEC_DISCUSSIONS_URL;
  }

  const slug = categoryConfig[module];
  if (!slug || typeof slug !== 'string' || slug.trim() === '') {
    return SPEC_DISCUSSIONS_URL;
  }

  const encoded = encodeURIComponent(slug);
  return `https://github.com/opencoachingformat/spec/discussions/categories/${encoded}`;
}
