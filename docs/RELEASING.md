# Releasing a new schema version

This repo publishes a new schema version and rebuilds the docs site automatically
whenever a `vX.Y.Z` tag is pushed (see `.github/workflows/release-spec.yml`).

## One-time setup (repo admin only)

1. **Create the dispatch PAT secret.**
   - Generate a fine-grained Personal Access Token with `repository_dispatch`
     write access (i.e. "Contents: write" or "Administration" scope, depending
     on token type) scoped to `opencoachingformat/ocf-validator`.
   - In `opencoachingformat/spec` → Settings → Secrets and variables → Actions,
     add a new repository secret named `OCF_VALIDATOR_DISPATCH_TOKEN` with that
     token as the value.

2. **Enable GitHub Pages.**
   - In `opencoachingformat/spec` → Settings → Pages, set Source to
     "Deploy from a branch", branch `gh-pages`, folder `/ (root)`.
   - The first workflow run creates the `gh-pages` branch automatically; you
     may need to re-visit this settings page after the first successful run
     to select the branch if it wasn't available yet.

3. **Custom domain DNS.**
   - The workflow writes a `CNAME` file containing `opencoachingformat.org`
     into the published site on every release.
   - This requires DNS for `opencoachingformat.org` to already point at
     GitHub Pages (an `ALIAS`/`ANAME` or `A` records per GitHub's
     [Pages custom domain docs](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site)).
     This DNS setup is external to this repo and not managed by the workflow.

## Cutting a release

```bash
git tag v1.1.0
git push origin v1.1.0
```

This triggers the workflow, which:
1. Builds the Astro docs site (specification + schema pages).
2. Publishes `schema/v1.json` to `https://opencoachingformat.org/v1.1.0/ocf-action-v1.json`
   (this URL is permanent — never delete or overwrite a version folder).
3. Deploys the docs site + versioned schema to the `gh-pages` branch.
4. Sends a `repository_dispatch` (`spec_released`) to `opencoachingformat/ocf-validator`
   with `{"version": "v1.1.0"}` in the payload (the key must be `version` —
   `ocf-validator`'s `sync-from-spec.yml` reads `client_payload.version`).
