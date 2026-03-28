# Releasing

## Version & tag convention

- Version source of truth: `package.json` → `"version"`.
- Tags follow **`vX.Y.Z`** (e.g. `v1.0.6`). The tagged commit's `package.json` must match.
- `package-lock.json` must be in sync — run `npm install` after bumping.

## Pre-release checklist

```bash
npm ci
npm run build
npm test
npm pack --dry-run        # verify included files
npm run release:check     # version + build + test in one step
```

## Creating a release

1. Bump version:

   ```bash
   npm version patch   # or minor / major
   ```

2. Push commit and tag:

   ```bash
   git push origin main
   git push origin vX.Y.Z
   ```

3. GitHub Actions (`.github/workflows/release.yml`) builds and attaches **`deukpack-x.y.z.tgz`** to the GitHub Release.

## Installing from a release

```bash
npm install ./deukpack-x.y.z.tgz
```

Or from npm (when published):

```bash
npm install deukpack
```

## npm publish (optional)

If `NPM_TOKEN` is configured in repository secrets, the release workflow can publish automatically.  
Manual: `npm publish --access public`.

## CI

- **Push / PR**: `.github/workflows/ci.yml` — build, test, example smoke.
- **Manual dispatch**: `.github/workflows/build-release.yml` — produces a tarball artifact without tagging.

## Native addon

The optional C++ native addon is **not** built by default on `npm install`. Use `npm run build:native` if needed. It does not affect CLI or TypeScript functionality.
