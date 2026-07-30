# primmel-ts — the Primmel language kernel

The toolchain for **Primmel**, the executable modelling language every
OIML SMART model is written in (a strict superset of Primmel v2):
parser and serializer for `.prl` packages, the linter (`primmel check`
— 99+ rules, C1–C99), the map-profile coverage calculus, and the model
diff (`primmel diff`).

> **Where am I?** This repo is the language kernel of the **OIML SMART
> platform** (`oimlsmart/smart`), which consumes it through a
> `PRIMMEL_TS` symlink so every platform gate runs against the live
> kernel. The full system map — every component, what it owns, and its
> proof command — is one hop away:
> [`docs/architecture/for-agents.md`](https://github.com/oimlsmart/smart/blob/rt-instrument-model/docs/architecture/for-agents.md).

## Prove it works

```bash
yarn install
yarn test           # 1062 tests, including corpus legs over the smart repo's 26 packages
yarn workspace @primmel/primmel run build   # rebuild the dist after any kernel merge
```

## Layout

- `packages/primmel/src/` — the language: ser-des codecs, the check
  rules, the coverage calculus, the diff, the types (each module's
  header carries its doctrine).
- `packages/primmel/test/` — the suites (unit + corpus legs; the corpus
  pins the smart repo's package count).

## Read next

- The primmel volume of the published docs site
  (`primmel/primmel-oiml-smart`).
- The platform's conventions: `AGENTS.d/` in `oimlsmart/smart`.
