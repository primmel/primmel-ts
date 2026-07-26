import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load, dump } from '../src/ser-des/index';
import { dumpPackage } from '../src/ser-des/config/packageManifest';
import { checkSpellingCodes } from '../src/check';
import {
  parseSpellingCode,
  parseConversionCode,
  isSpellingCode,
  isConversionCode,
  conversionCodeEquals,
} from '../src/spelling';

describe('spelling codes (ISO 24229 — TODO.roadmap/25)', () => {
  it('parses language-script codes', () => {
    assert.deepEqual(parseSpellingCode('eng-Latn'), {
      language: 'eng',
      script: 'Latn',
    });
    assert.deepEqual(parseSpellingCode('uzb-Arab-AF'), {
      language: 'uzb',
      script: 'Arab',
      country: 'AF',
    });
    assert.deepEqual(parseSpellingCode('ind-Latn-pre1972'), {
      language: 'ind',
      script: 'Latn',
      extension: 'pre1972',
    });
    assert.deepEqual(parseSpellingCode('zho-Hani-CN-simplified'), {
      language: 'zho',
      script: 'Hani',
      country: 'CN',
      extension: 'simplified',
    });
  });

  it('rejects a bare language code — the script is mandatory', () => {
    const r = parseSpellingCode('eng');
    assert.equal(typeof r, 'string');
    assert.match(r, /script segment missing/);
    assert.equal(isSpellingCode('ara'), false);
  });

  it('rejects malformed segments', () => {
    assert.equal(typeof parseSpellingCode('EN-Latn'), 'string');
    assert.equal(typeof parseSpellingCode('eng-latn'), 'string');
    assert.equal(typeof parseSpellingCode('eng-Latn-1x'), 'string');
    assert.equal(typeof parseSpellingCode('eng-Latn-Pre1972'), 'string');
    assert.equal(typeof parseSpellingCode('eng'), 'string');
    assert.equal(
      typeof parseSpellingCode('eng-Latn-AF-pre1972-extra'),
      'string',
    );
    assert.equal(typeof parseSpellingCode(''), 'string');
  });

  it('parses conversion system codes', () => {
    assert.deepEqual(parseConversionCode('BGN-PCGN:zho-Hans:Latn:1979'), {
      titular: 'BGN-PCGN',
      source: 'zho-Hans',
      target: 'Latn',
      identifying: '1979',
    });
    // registered abbreviation: the source spelling's script omitted
    assert.deepEqual(parseConversionCode('UN:ara:Latn:2017'), {
      titular: 'UN',
      source: 'ara',
      target: 'Latn',
      identifying: '2017',
    });
    assert.equal(isConversionCode('ISO:Cyrl:Latn:9-1995'), true);
    assert.equal(isConversionCode('zz-x:eng-Latn:Cyrl:1'), true);
  });

  it('rejects malformed conversion codes', () => {
    assert.equal(typeof parseConversionCode('UN:ara:2017'), 'string');
    assert.equal(
      typeof parseConversionCode('UN:ara:Latn:2017:extra'),
      'string',
    );
    assert.equal(typeof parseConversionCode(':ara:Latn:2017'), 'string');
    assert.equal(typeof parseConversionCode('UN:ara:latn:2017'), 'string');
  });

  it('compares conversion codes case-insensitively', () => {
    assert.equal(
      conversionCodeEquals('iso:cyrl:latn:9-1995', 'ISO:Cyrl:Latn:9-1995'),
      true,
    );
  });
});

describe('text keyword (ISO 24229 content sets)', () => {
  it('parses a text block with spell facets', () => {
    const src = `
      text /req/metrological/measuring-range-max.statement {
        spell fra-Latn "La valeur de la plus grande charge"
        spell zho-Latn via BGN-PCGN:zho-Hans:Latn:1979 "zai he zui da zhi"
      }
    `;
    const s = load(src);
    assert.equal(s.texts.length, 1);
    const t = s.texts[0];
    assert.equal(t.id, '/req/metrological/measuring-range-max.statement');
    assert.equal(t.entries.length, 2);
    assert.deepEqual(t.entries[0], {
      spelling: 'fra-Latn',
      value: 'La valeur de la plus grande charge',
    });
    assert.deepEqual(t.entries[1], {
      spelling: 'zho-Latn',
      via: 'BGN-PCGN:zho-Hans:Latn:1979',
      value: 'zai he zui da zhi',
    });
  });

  it('merges split text blocks for one path into one content set', () => {
    const src = `
      text some-element.name { spell fra-Latn "Un" }
      text some-element.name { spell deu-Latn "Eins" }
    `;
    const s = load(src);
    assert.equal(s.texts.length, 1);
    assert.equal(s.texts[0].entries.length, 2);
  });

  it('dumps a text block round-trip', () => {
    const src = `text some-element.name {
  spell fra-Latn "Un « guillemet »"
  spell zho-Latn via BGN-PCGN:zho-Hans:Latn:1979 "yi"
}
`;
    const s = load(src);
    const out = dump(s);
    assert.match(out, /text some-element\.name \{/);
    assert.match(out, /spell fra-Latn "Un « guillemet »"/);
    assert.match(out, /spell zho-Latn via BGN-PCGN:zho-Hans:Latn:1979 "yi"/);
    // byte-stable: dump(load(dump(load(src)))) ≡ dump(load(src))
    assert.equal(dump(load(out)), out);
  });

  it('rejects a malformed spell facet', () => {
    assert.throws(
      () => load('text e.name { spell fra-Latn }'),
      /expects a quoted value|Expecting/,
    );
    assert.throws(
      () => load('text e.name { note "x" }'),
      /unknown facet "note"/,
    );
  });

  it('handles values with escaped quotes', () => {
    const src = 'text e.statement { spell fra-Latn "dire \\"bonjour\\" ici" }';
    const s = load(src);
    assert.equal(s.texts[0].entries[0].value, 'dire "bonjour" ici');
    const out = dump(s);
    assert.match(out, /spell fra-Latn "dire \\"bonjour\\" ici"/);
  });
});

describe('package default_spelling / spellings facets', () => {
  it('parses and dumps the multilinguality manifest facets', () => {
    const src = `
      package {
        id oiml-r60
        title "R 60"
        version "2021"
        editions { 2021 }
        baseUrn "urn:oiml:pub:r:60:2021"
        description "d"
        default_spelling eng-Latn
        spellings { eng-Latn fra-Latn }
      }
    `;
    const s = load(src);
    assert.equal(s.packageManifest?.defaultSpelling, 'eng-Latn');
    assert.deepEqual(s.packageManifest?.spellings, ['eng-Latn', 'fra-Latn']);
    const out = dumpPackage(s.packageManifest!);
    assert.match(out, /default_spelling eng-Latn/);
    assert.match(out, /spellings \{ eng-Latn fra-Latn \}/);
    // and the dump re-parses to the same facets
    const s2 = load(out);
    assert.equal(s2.packageManifest?.defaultSpelling, 'eng-Latn');
    assert.deepEqual(s2.packageManifest?.spellings, ['eng-Latn', 'fra-Latn']);
  });
});

describe('C89 spelling-code-wellformed', () => {
  const PKG = `
    package {
      id p
      title "p"
      version "1"
      editions { 1 }
      baseUrn "urn:x:p"
      description "d"
      default_spelling eng-Latn
    }
    requirement /req/a {
      name "A"
      statement "A shall hold."
    }
  `;
  const errs = (src: string) =>
    checkSpellingCodes(load(src)).filter(i => i.severity === 'error');

  it('passes a clean package (no text blocks)', () => {
    assert.deepEqual(errs(PKG), []);
  });

  it('passes a well-formed text block', () => {
    const s = load(`${PKG}
      text /req/a.statement {
        spell fra-Latn "A s'applique."
        spell zho-Latn via BGN-PCGN:zho-Hans:Latn:1979 "yi"
      }
    `);
    const issues = checkSpellingCodes(s).filter(i => i.severity === 'error');
    assert.deepEqual(issues, []);
  });

  it('flags a bare-language default_spelling', () => {
    const bad = PKG.replace(
      'default_spelling eng-Latn',
      'default_spelling eng',
    );
    const issues = errs(bad);
    assert.equal(issues.length, 1);
    assert.match(issues[0].message, /default_spelling "eng"/);
    assert.match(issues[0].message, /script/);
  });

  it('flags a malformed spell code', () => {
    const issues = errs(`${PKG}
      text /req/a.statement { spell fra "Le A" }
    `);
    assert.equal(issues.length, 1);
    assert.match(issues[0].message, /spelling code "fra"/);
  });

  it('flags a duplicate code within one content set', () => {
    const issues = errs(`${PKG}
      text /req/a.statement { spell fra-Latn "Un" }
      text /req/a.statement { spell fra-Latn "Deux" }
    `);
    assert.equal(issues.length, 1);
    assert.match(issues[0].message, /duplicate "fra-Latn"/);
  });

  it('flags the default spelling authored in a text block', () => {
    const issues = errs(`${PKG}
      text /req/a.statement { spell eng-Latn "A shall hold." }
    `);
    assert.equal(issues.length, 1);
    assert.match(issues[0].message, /default spelling/);
  });

  it('flags an unresolvable address or non-prose field', () => {
    const noEl = errs(`${PKG}
      text /req/nope.statement { spell fra-Latn "x" }
    `);
    assert.equal(noEl.length, 1);
    assert.match(noEl[0].message, /no element "\/req\/nope"/);
    const noField = errs(`${PKG}
      text /req/a.binds_to { spell fra-Latn "x" }
    `);
    assert.equal(noField.length, 1);
    assert.match(noField[0].message, /not a prose field/);
  });

  it('flags a malformed via and warns on zz- user-assigned codes', () => {
    const bad = errs(`${PKG}
      text /req/a.statement { spell zho-Latn via BGN-PCGN:zho-Hans:Latn "yi" }
    `);
    assert.equal(bad.length, 1);
    assert.match(bad[0].message, /via "BGN-PCGN:zho-Hans:Latn"/);
    const zz = checkSpellingCodes(
      load(`${PKG}
        text /req/a.statement { spell zho-Latn via zz-mine:eng-Latn:Hani:1 "yi" }
      `),
    );
    assert.equal(zz.length, 1);
    assert.equal(zz[0].severity, 'warning');
    assert.match(zz[0].message, /user-assigned/);
  });

  it('flags default_spelling missing from the declared spellings set', () => {
    const bad = PKG.replace(
      'default_spelling eng-Latn',
      'default_spelling eng-Latn\n      spellings { fra-Latn }',
    );
    const issues = errs(bad);
    assert.equal(issues.length, 1);
    assert.match(issues[0].message, /not in the declared spellings set/);
  });
});
