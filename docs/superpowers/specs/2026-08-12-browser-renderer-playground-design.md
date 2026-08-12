# Browser Renderer Playground for the OCF Website

**Status:** Approved design
**Date:** 2026-08-12

## Goal

Add a browser-only renderer playground to the Astro-based OCF specification website. Users can edit or paste OCF JSON, validate it with the existing client-side validator, render valid documents in the current Three.js tactical-print renderer, navigate frames, download a PNG, and optionally prepare feedback for GitHub Discussions.

The renderer output and public API are explicitly experimental and not final.

## Placement and scope

Add a dedicated page at `/playground/renderer` in the spec website. Keep the existing validator playground available and unchanged as a focused validation tool. The new page combines validation and rendering without requiring an account, upload, backend, or persistent storage.

The initial scope is tactical-print rendering only. `coaching_animation` remains unavailable and must not be presented as implemented.

## Browser-only data flow

1. Astro serves the page and its bundled client code.
2. The user edits JSON or loads an included example.
3. JSON parsing happens locally.
4. The pinned browser validator validates the parsed document locally.
5. Rendering is enabled only for valid JSON documents; validation errors are shown before rendering.
6. The renderer builds a scene and renders the selected frame to a local canvas.
7. Frame navigation rerenders the selected frame without uploading the document.
8. PNG export uses the local canvas and does not transmit the image.

The page must state that no data leaves the browser. No localStorage, analytics payload, server endpoint, or automatic persistence is added in this feature.

## Renderer and validator integration

The site build consumes a fixed renderer commit, not a floating branch and not an unpublished npm version. The build process must:

- accept one explicit renderer commit SHA as configuration;
- obtain the renderer source at that SHA;
- install/build the renderer with its declared dependencies;
- expose a browser-compatible bundle and the renderer version/commit to the page;
- fail the site build if the pinned renderer cannot be built;
- keep the validator commit pin and renderer commit pin visible in the page's technical metadata.

The renderer bundle must remain browser-safe. No Node-only CLI or filesystem module may be shipped to the browser. Three.js is loaded through the site build, not from a runtime dependency on the renderer repository's `node_modules` directory.

The page may use the same pinned validator browser URL mechanism already used by `site/src/pages/playground.astro`. The renderer pin is separate and must be updated deliberately.

## User interface

### Desktop

Use the Astro site's existing `Base` layout, typography, color variables, buttons, borders, and spacing. Do not introduce a parallel visual system.

The primary workspace is a two-column layout:

- left: JSON editor with example selector, `Validate`, `Render`, and `Reset` actions;
- right: canvas preview with current frame indicator and previous/next frame controls;
- validation status below the actions or above the preview, with distinct valid, warning, invalid, and runtime-error states.

The page shows a persistent experimental notice near the title:

> Experimental renderer — this preview and its API are not final and may change.

### Mobile

At the existing Astro responsive breakpoint, switch to one column:

1. notice and document/example controls;
2. editor;
3. validation result;
4. render/feedback actions;
5. canvas preview;
6. frame navigation.

Controls must be usable by touch, with no hover-only behavior. The canvas scales to the viewport width while preserving its aspect ratio. The feedback dialog uses the full viewport on small screens and keeps its primary actions reachable without horizontal overflow.

## Feedback flow

Feedback is centralized in the spec repository's GitHub Discussions. The UI must support module targets for `spec`, `validator`, `renderer`, and future `editor`, while allowing the category mapping to be configured independently of the UI.

The feedback action opens a review dialog before navigating away. The dialog:

- explains what will be included;
- shows the generated Markdown bundle in a read-only, selectable field;
- shows the JSON inclusion explicitly;
- shows the selected frame and validator result;
- shows the renderer and validator commit pins;
- offers a module/category selector;
- has clipboard copying disabled by default;
- offers `Copy feedback & open GitHub Discussions` only after explicit opt-in to clipboard use;
- offers `Open GitHub Discussions without copying` as a separate action;
- keeps the bundle available for manual copying if Clipboard API permission is denied or unavailable;
- does not silently include a PNG in the clipboard bundle.

The generated Markdown contains the user JSON, validation result, selected frame, renderer/validator versions, and a short environment note. PNG export is a separate explicit `Download PNG` action; users can attach it manually to the discussion.

The GitHub Discussions category mapping is configuration-driven. If a configured module category is unavailable, the UI falls back to the general discussions URL and clearly tells the user that they may need to choose the category manually.

## Error handling

- Invalid JSON: show a parse error with no render attempt.
- Valid JSON with schema/semantic errors: show validator errors and keep Render disabled.
- Valid document with renderer runtime failure: show a readable renderer error and preserve the editor contents.
- Invalid frame index: clamp to the valid frame range and show the current frame number.
- Clipboard denial: do not fail the feedback flow; show the Markdown bundle and manual-copy instructions.
- GitHub navigation failure or unavailable category: preserve the bundle and provide the general Discussions link.
- Any error must not expose local file paths, browser secrets, or unrelated document data.

## Examples

The page provides a selector populated from the site's generated OCF examples. It must include the existing spec examples and the renderer's current tactical-print examples when their fixture documents are available to the site build. Loading an example replaces the editor contents only after the user confirms if they have unsaved edits.

## Testing

- Astro build succeeds with a pinned renderer commit and pinned validator commit.
- Browser test verifies the page loads with an example, validates successfully, renders a canvas, and navigates between frames.
- Browser test verifies invalid JSON and validator-invalid documents cannot render.
- Browser test verifies the experimental notice is visible.
- Browser test verifies mobile layout has no horizontal overflow and all primary controls remain reachable.
- Browser test verifies feedback dialog defaults to no clipboard copy, exposes the Markdown bundle, and offers both clipboard and no-copy actions.
- Browser test verifies clipboard denial leaves the manual-copy bundle visible.
- Existing validator playground and site accessibility checks remain passing.

## Out of scope

- User accounts, server-side storage, analytics, or document sharing links;
- collaborative editing;
- animation mode or timeline controls;
- automatic GitHub issue/discussion creation or API authentication;
- automatic image upload;
- final renderer visual language or API stability;
- replacing the standalone validator playground;
- enabling `coaching_animation`.
