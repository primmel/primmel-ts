// ─────────────────────────────────────────────────────────────────────
// ISO 24229 spelling codes (TODO.roadmap/25, doctrine ch. 10) — the
// SYNTAX layer. Primmel tags every human-readable string with a spelling
// code; BCP 47 is not used.
//
//   spelling system code  = ISO 639-3 alpha-3 language + ISO 15924 script
//                           (MANDATORY — a bare language code is an error)
//                           [+ ISO 3166-1 alpha-2 country]
//                           [+ extension]           e.g. eng-Latn,
//                           uzb-Arab-AF, ind-Latn-pre1972
//   conversion system code = titular : source-spelling : target-script :
//                           identifying                  e.g.
//                           BGN-PCGN:zho-Hans:Latn:1979
//
// This module validates the SHAPE only — resolution against the ISO
// 24229 register (does this language/script/country/conversion system
// exist) is the consumer's register discipline (the OIML SMART platform
// runs it as a linker rule against a vendored, pinned register snapshot;
// primmel-ts stays register-free, exactly as it stays YAML-free).
//
// Case: language codes are lower-case, script codes title-case, country
// codes upper-case by convention; conversion codes compare
// case-insensitively per the register (ISO:Cyrl:Latn:9-1995 ≡
// iso:cyrl:latn:9-1995). The validators below accept the canonical
// casing and report everything else, so authored codes are uniform.
// ─────────────────────────────────────────────────────────────────────

/** ISO 639-3 alpha-3 language code (terminological). */
const LANGUAGE = /^[a-z]{3}$/;
/** ISO 15924 script code (title case — `Latn`, `Cyrl`, `Hani`). */
const SCRIPT = /^[A-Z][a-z]{3}$/;
/** ISO 3166-1 alpha-2 country code (upper case). */
const COUNTRY = /^[A-Z]{2}$/;
/** Spelling extension (orthography variant — `pre1972`). */
const EXTENSION = /^[a-z][a-z0-9]*$/;

export interface ParsedSpellingCode {
  language: string;
  script: string;
  country?: string;
  extension?: string;
}

/**
 * Parse a spelling system code. Returns the parsed parts, or a string
 * describing the first syntax violation. The script element is
 * mandatory: a bare `ara` is not a spelling system (doctrine §10.7).
 */
export function parseSpellingCode(code: string): ParsedSpellingCode | string {
  const segments = code.split('-');
  if (segments.length === 1 && /^[a-z]{3}$/.test(segments[0])) {
    return `script segment missing — a bare language code ("${code}") is not a spelling system; add the ISO 15924 script (e.g. ${code}-Latn)`;
  }
  if (segments.length < 2 || segments.length > 4) {
    return `a spelling code is <language>-<script>[-<country>][-<extension>] (2–4 segments), got "${code}"`;
  }
  const [language, script, ...rest] = segments;
  if (!LANGUAGE.test(language)) {
    return `language segment "${language}" is not an ISO 639-3 alpha-3 code (three lower-case letters)`;
  }
  if (!SCRIPT.test(script)) {
    if (/^[a-z]{3}$/.test(script) && rest.length === 0) {
      return `script segment missing — a bare language code ("${code}") is not a spelling system; add the ISO 15924 script (e.g. ${code}-Latn)`;
    }
    return `script segment "${script}" is not an ISO 15924 script code (title-case four letters, e.g. Latn)`;
  }
  const parsed: ParsedSpellingCode = { language, script };
  if (rest.length > 0) {
    const first = rest[0];
    if (COUNTRY.test(first)) {
      parsed.country = first;
      if (rest.length > 1) {
        if (!EXTENSION.test(rest[1])) {
          return `extension segment "${rest[1]}" is malformed (lower-case alnum, e.g. pre1972)`;
        }
        parsed.extension = rest[1];
      }
    } else if (EXTENSION.test(first)) {
      if (rest.length > 1) {
        return `country segment must precede the extension ("${code}")`;
      }
      parsed.extension = first;
    } else {
      return `segment "${first}" is neither an ISO 3166-1 alpha-2 country (two upper-case letters) nor an extension (lower-case alnum)`;
    }
  }
  return parsed;
}

/** A spelling code parses (see parseSpellingCode for the diagnostics). */
export function isSpellingCode(code: string): boolean {
  return typeof parseSpellingCode(code) !== 'string';
}

/**
 * A conversion system code: four colon-separated segments —
 * titular (managing authority; `Var` when none is identifiable, a `zz-`
 * prefix for user-assigned codes) : source spelling : target script :
 * identifying segment (version/year). The source spelling is an ISO
 * 639-3 language with an optional ISO 15924 script; registered
 * abbreviations may omit the language's default script
 * (`UN:ara:Latn:2017` for `UN:ara-Arab:Latn:2017`) or name the script
 * alone for language-agnostic systems (`ISO:Cyrl:Latn:9-1995`).
 */
export function parseConversionCode(
  code: string,
):
  | { titular: string; source: string; target: string; identifying: string }
  | string {
  const segments = code.split(':');
  if (segments.length !== 4) {
    return `a conversion system code is <titular>:<source>:<target>:<identifying> (4 colon-separated segments), got "${code}"`;
  }
  const [titular, source, target, identifying] = segments;
  if (!/^[A-Za-z][A-Za-z0-9-]*$/.test(titular)) {
    return `titular segment "${titular}" is malformed (authority token, e.g. UN, ISO, ALA-LC, BGN-PCGN, Var, zz-…)`;
  }
  const sourceSegments = source.split('-');
  const sourceOk =
    // bare script (language-agnostic system, the registered abbreviation)
    (sourceSegments.length === 1 && SCRIPT.test(sourceSegments[0])) ||
    // language, or language-script
    (sourceSegments.length >= 1 &&
      sourceSegments.length <= 2 &&
      LANGUAGE.test(sourceSegments[0]) &&
      (sourceSegments.length === 1 || SCRIPT.test(sourceSegments[1])));
  if (!sourceOk) {
    return `source segment "${source}" is not a spelling (ISO 639-3 language with optional ISO 15924 script, or a bare script)`;
  }
  if (!SCRIPT.test(target)) {
    return `target segment "${target}" is not an ISO 15924 script code (e.g. Latn)`;
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9.-]*$/.test(identifying)) {
    return `identifying segment "${identifying}" is malformed (version/year token, e.g. 1979, 9-1995)`;
  }
  return { titular, source, target, identifying };
}

/** A conversion system code parses (see parseConversionCode). */
export function isConversionCode(code: string): boolean {
  return typeof parseConversionCode(code) !== 'string';
}

/** Case-insensitive equality of conversion codes (register semantics). */
export function conversionCodeEquals(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}
