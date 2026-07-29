// ─────────────────────────────────────────────────────────────────────
// The shipped-package corpus the corpus-clean legs iterate (the sibling
// smart repo checkout — primmel-packages/). One resolution, shared by
// every corpus leg (TODO.v2/13 item 3c — before this helper each leg
// carried its own machine-local absolute default):
//
//   1. PRIMMEL_PACKAGES (env) — CI and non-standard layouts;
//   2. the sibling checkout beside the primmel-ts repo, resolved
//      REPO-RELATIVE (<repos>/oimlsmart/smart/primmel-packages beside
//      <repos>/primmel/<this repo>) — the developer layout, no machine-
//      local absolute path;
//   3. absent both — CORPUS_SKIP carries the loud skip reason (the legs
//      pass it to node:test's skip option and log it themselves), never
//      silently green.
// ─────────────────────────────────────────────────────────────────────

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/** The primmel-ts repo root (test/helpers → test → primmel → packages). */
const REPO_ROOT = resolve(__dirname, '..', '..', '..', '..');

export const CORPUS =
  process.env.PRIMMEL_PACKAGES ??
  resolve(REPO_ROOT, '..', '..', 'oimlsmart', 'smart', 'primmel-packages');

export const CORPUS_AVAILABLE = existsSync(CORPUS);

/** node:test skip option: false when the corpus resolves, else the reason. */
export const CORPUS_SKIP: string | false = CORPUS_AVAILABLE
  ? false
  : `no primmel-packages corpus at ${CORPUS} — set PRIMMEL_PACKAGES to enable the corpus-clean leg`;
