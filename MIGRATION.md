# Migration: `@riboseinc/mmel` → `@primmel/primmel`

**Date:** 2026-07-03
**Status:** READY — package renamed; npm publish + GitHub transfer pending

## Summary

The `mmel` package is being renamed and rebranded:

| Before | After |
|---|---|
| npm: `@riboseinc/mmel` | npm: `@primmel/primmel` |
| GitHub: `github.com/metanorma/mmel-ts` | GitHub: `github.com/primmel/primmel` |
| Brand: "MMEL tools" | Brand: "Primmel — TypeScript tools" |
| Version: `0.1.0` | Version: `1.0.0` (Primmel is a new major version) |

## Why

Primmel is the **successor** to MMEL. The TypeScript package now
supports the five Primmel extensions (`form`, `subform`, `symbol`,
`calculation`, `state_machine`) in addition to all MMEL 0.1 constructs.

The rename aligns the package identity with the language identity.

## What changed in the package

### `package.json` updates

- `name`: `@riboseinc/mmel` → `@primmel/primmel`
- `version`: `0.1.0` → `1.0.0` (major version bump — Primmel is a new generation)
- `description`: added
- `repository`: `github.com/metanorma/mmel-ts` → `github.com/primmel/primmel`
- `homepage`: added
- `bugs`: added
- `keywords`: added (`primmel`, `mmel`, `compliance`, `ocl`, etc.)
- `publishConfig`: `access: public` (the `@primmel` scope is public)
- `contributors`: Ribose Inc. retained as contributor

### README updates

- Root README rewritten with Primmel branding, usage example, migration section
- Package README rewritten with full exports list + Primmel extensions table

### No code changes

The TypeScript source is unchanged. Imports within the package use
relative paths, not the package name. Existing consumers' imports work
without modification (only the package name in their `package.json` needs
updating).

## Migration for consumers

### Step 1 — Update package.json

```sh
npm uninstall @riboseinc/mmel
npm install @primmel/primmel
```

Or with yarn:

```sh
yarn remove @riboseinc/mmel
yarn add @primmel/primmel
```

### Step 2 — Update imports (no change needed)

The import paths are identical:

```ts
// Before
import { load, dump } from '@riboseinc/mmel'

// After
import { load, dump } from '@primmel/primmel'
```

### Step 3 — Verify

The new package supports everything from `@riboseinc/mmel@latest` plus
the five Primmel extension keywords. Existing code works unchanged.

## What's NOT in this commit (requires admin access)

- **GitHub repo transfer**: `github.com/metanorma/mmel-ts` → `github.com/primmel/primmel`
  - Requires owner permission on both source and target orgs
  - GitHub will redirect automatically after transfer
- **npm publish**: `npm publish` of `@primmel/primmel@1.0.0`
  - Requires `@primmel` scope ownership on npm
  - The `@primmel` scope must be created first

## Steps to complete the rename (after this PR merges)

1. **GitHub repo transfer**
   - Go to `github.com/metanorma/mmel-ts/settings`
   - "Danger Zone" → "Transfer"
   - Transfer to `primmel` org, new name `mmel`
   - Verify redirect from old URL works

2. **npm publish**
   - Create `@primmel` scope on npm (owner: primmel project)
   - `npm login` with appropriate credentials
   - From the mmel-ts repo: `cd packages/mmel && npm publish`
   - Verify `npm view @primmel/primmel`

3. **Sunset `@riboseinc/mmel`**
   - Publish a final version of `@riboseinc/mmel` that is a stub
     pointing to `@primmel/primmel`
   - Mark `@riboseinc/mmel` as deprecated on npm

4. **Update dependent repos**
   - `oimlsmart/smart` — replace `@riboseinc/mmel` with `@primmel/primmel`
     in `package.json` (currently the converter uses structural typing,
     so no import changes needed)

## Verification

- Code compiles cleanly via `tsc --noEmit`
- All existing types and parser/dumper/resolver entries work unchanged
- README correctly points to the new GitHub and npm locations
