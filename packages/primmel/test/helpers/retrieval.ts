// ─────────────────────────────────────────────────────────────────────
// The retrieval-export fixture package (primmel-ts#65): one tiny package
// exercising every unit kind and every provenance shape the projection
// normalizes — structured source blocks, derives-from refs (the §18.4
// fold), a multi-URN term source string, a section-only term, a
// producer-internal UUID anchor (in the doc-fragment AND the clause
// slot), a non-clause fragment anchor (#table-2), a provenance-free
// orphan, a match-all applicability entry (the facet's
// `app_<dim>_match` case), and ISO 24229 text blocks (ask 7: authored +
// via-converted alternates, kernel-id term addressing, and a block
// addressed at the unprojected instrument). The manifest deliberately
// declares version "2" against editions { 2021 2017 } — the
// edition-vs-model_version drift case the issue's ask 2 pins.
// ─────────────────────────────────────────────────────────────────────

import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function buildRetrievalFixturePackage(): string {
  const parent = mkdtempSync(join(tmpdir(), 'primmel-retrieval-'));
  const dir = join(parent, 'pkg');
  mkdirSync(dir);
  writeFileSync(
    join(dir, 'package.primmel'),
    `package {
  id test-retrieval
  kind rec
  title "Retrieval fixture package"
  version "2"
  editions { 2021 2017 }
  baseUrn "urn:test:r:9:2021"
  status current
  default_spelling eng-Latn
  supersedes { urn:test:r:9:2017 }
  description "A tiny retrieval-export fixture."
}`,
  );

  mkdirSync(join(dir, 'specification'));
  writeFileSync(
    join(dir, 'specification', 'requirements.prl'),
    `requirement_class /req/scope {
  name "Scope requirements"
}

requirement /req/scope/alpha {
  name "Alpha"
  statement "The widget shall frobnicate."
  guidance "Frobnicate gently."
  binds_to { family.parameters.x }
  applicability {
    accuracy_class: [A C]
  }
  limit {
    expression "ocl{family.parameters.x > 0}"
    uses { family.parameters.x }
  }
  dependencies { /req/scope/beta }
  verification { method examination description "By inspection." }
  ref derives-from "urn:test:r:9-1:2021#clause-5.2"
  ref derives-from "urn:test:r:9-1:2021#clause-5.2.1"
}

requirement /req/scope/beta {
  name "Beta"
  statement "The widget should beep."
  obligation should
  applicability {
    tech: [analogue digital] match all
  }
  source { doc "urn:test:r:9-1:2021#_eb46a3a3-b2c3-4d5e-8f90-a1b2c3d4e5f6" clause "" }
}

requirement /req/scope/gamma {
  name "Gamma"
  statement "The widget shall hum."
  source { doc "urn:test:r:9-1:2021" clause "_eb46a3a3-b2c3-4d5e-8f90-a1b2c3d4e5f6" }
}

requirement /req/scope/delta {
  name "Delta"
  statement "The widget shall match Table 2."
  ref derives-from "urn:test:r:9-1:2021#table-2"
}

requirement /req/orphan {
  name "Orphan"
  statement "The widget shall stand alone."
}`,
  );

  mkdirSync(join(dir, 'specification', 'conformance'));
  writeFileSync(
    join(dir, 'specification', 'conformance', 'tests.prl'),
    `conformance_test /conf/scope/alpha-frob {
  name "Alpha frobnication test"
  purpose "Verifies the widget frobnicates."
  method "Apply the frobnication procedure of the reference document."
  targets { /req/scope/alpha }
  reference { doc "urn:test:r:9-2:2021" clause "7.1" fragment "s3" }
}`,
  );

  writeFileSync(
    join(dir, 'terminology.prl'),
    `term frobnicator {
  label "frobnicator"
  definition "a device that frobnicates"
  section "3.2"
  source "urn:test:v:1:2022#clause-4.1 urn:test:r:9-1:2021#clause-3.2.1"
  language "en"
  alt { frobber }
  abbreviations { FB }
}

term orphan-term {
  label "orphan term"
  definition "a term with only a section for provenance"
  section "3.9"
}`,
  );

  mkdirSync(join(dir, 'model'));
  writeFileSync(
    join(dir, 'model', 'attributes.prl'),
    `attribute_definition widget_mass {
  symbol "M"
  name "widget mass"
  definition "Mass of the widget."
  quantity_kind mass
  unit "kg"
  value_type QuantityValue
  origin declared
  scope model
  category metrological
  ref derives-from "urn:test:r:9-1:2021#clause-6.1"
}`,
  );

  writeFileSync(
    join(dir, 'model', 'behaviors.prl'),
    `behavior beep-response {
  kind acoustic
  stimulus trigger
  response "The widget beeps when triggered."
  ref derives-from "urn:test:r:9-1:2021#clause-3.7.1"
}`,
  );

  writeFileSync(
    join(dir, 'model', 'characteristics.prl'),
    `verdict beep_level {
  symbol "B_L"
  behavior beep-response
  quantity { kind sound_pressure unit "dB" }
  derive "ocl{abs(b_l)}"
  inputs { b_l }
  ref derives-from "urn:test:r:9-3:2021#clause-2.1"
}`,
  );

  writeFileSync(
    join(dir, 'model', 'state.prl'),
    `state_machine WidgetOperational {
  kind operational
  initial off
  states {
    off
    ready
  }
  transition off -> ready action power_on
  transition ready -> off action power_off
}`,
  );

  writeFileSync(
    join(dir, 'model', 'instrument.prl'),
    `instrument Widget {
  extends MeasuringInstrumentModel
  definition "A widget."
  dimension tech {
    label "Technology"
    scope family
    description "Widget technology"
    values {
      analogue { label "Analogue" }
      digital { label "Digital" }
    }
  }
}`,
  );

  writeFileSync(
    join(dir, 'specification', 'calculations.prl'),
    `calculation frobIndex {
  name "frobIndex"
  identifier /calc/frob-index
  category metrological
  description "The frobnication index: F = x / x_ref."
  inputs {
    x : number { unit "v" description "Measured value" }
  }
  output : number { unit "v" name "frob_index" description "The index" }
  expression "ocl{x / x_ref}"
  ref derives-from "urn:test:r:9-3:2021#clause-2.2"
}

calculation lookupFrob {
  name "lookupFrob"
  type table_lookup
  label "Frob lookup"
  description "Looks up the frob tier."
  params { x tech }
  lookup { key tech variable x multiplier 1 }
}`,
  );

  writeFileSync(
    join(dir, 'specification', 'symbols.prl'),
    `symbol b_l {
  name "Beep level"
  definition "The beep level, in dB."
  type number
  unit "dB"
  kind observable
  quantity_kind sound_pressure
  origin derived
  formula {
    display "B_L = b / f"
    expression "(b - b0) / f"
    inputs { f }
  }
  ref derives-from "urn:test:r:9-3:2021#clause-2.1.5"
}`,
  );

  writeFileSync(
    join(dir, 'specification', 'constraints.prl'),
    `constraint widget_geometry {
  stereotype inv
  name "Widget geometry"
  check "ocl{model.parameters.x <= model.parameters.x_max}"
  violation_meaning "The widget exceeds its geometry envelope; the measurement is void."
  on_violation invalid
  ref derives-from "urn:test:r:9-1:2021#clause-3.6"
}`,
  );

  writeFileSync(
    join(dir, 'specification', 'tables.prl'),
    `table frob_tiers {
  description "Frob tier breakpoints per technology."
  columns {
    tech: string
    tier_min: number "v"
    tier_max: number "v"
  }
  data {
    "analogue" 0 50
    "digital" 0 200
  }
  ref derives-from "urn:test:r:9-1:2021#table-2"
}`,
  );

  writeFileSync(
    join(dir, 'specification', 'test-sequences.prl'),
    `test_sequence frob-then-beep {
  name "Frob then beep"
  description "The frobnication test establishes the baseline before the beep test."
  step 1 { test "/conf/scope/alpha-frob" role baseline }
  step 2 { phase "warm-up" depends_on 1 }
  source { doc "urn:test:r:9-2:2021" clause "2.10" }
}`,
  );

  writeFileSync(
    join(dir, 'specification', 'notes.prl'),
    `note frob-note {
  type CAUTION
  message "Frobnicate only under supervision."
}`,
  );

  // ISO 24229 alternates (ask 7): the default spelling's values stay
  // inline; text blocks carry the alternates, addressed
  // `<element-id>.<field>` — a requirement by its authored id, a term by
  // its KERNEL id (not the namespaced /term/ unit id), and one block
  // addressed at the instrument (registered with C89 but not projected
  // as a unit — the droppedTextBlocks case).
  writeFileSync(
    join(dir, 'texts.prl'),
    `text /req/scope/alpha.statement {
  spell fra-Latn "Le widget doit frobniquer."
  spell zho-Latn via BGN-PCGN:zho-Hans:Latn:1979 "该小部件应进行frobnicate。"
}

text frobnicator.definition {
  spell fra-Latn "un dispositif qui frobnique"
}

text Widget.definition {
  spell fra-Latn "Un widget."
}`,
  );

  return dir;
}
