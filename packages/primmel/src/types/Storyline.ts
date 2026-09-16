// ─────────────────────────────────────────────────────────────────────
// The demo world and the storyline (smart TODO.roadmap/40 batch 4; the
// packages-as-SSOT epic) — the sample-data demo seeds as native
// constructs (today a verbatim codec-exclusion payload):
//
//   demo_world r60_demo {                  # one per package — file-level
//     standard oiml-r60                    # metadata + the participant
//     description "…"                      # registry
//     participants {
//       operated_schemes {                 # OPEN section blocks — the
//         scheme-example { … }             # grammar does NOT enumerate
//       }                                  # section names (they are
//       organizations { … }                # program-content)
//     }
//   }
//
//   storyline ex1_acme_lc500 {             # one per flow
//     name "EX1/Example TL — ACME LC-500i"
//     id_prefix sample-ex1
//     party { laboratory lab_example authority ia_example }
//     subject {
//       manufacturer mfr-acme { company "ACME" city "…" }
//       family fam-acme-lc500 { family_designation "LC-500i series" }
//       model mod-acme-lc500-i { … }
//       sample smp-ex1-1 { … }
//     }
//     record application app-ex1 { status SUBMITTED … }
//     record test_request tr-ex1 { … }
//     record test_report trep-ex1 { … }
//     record evaluation eval-ex1 { … }
//     record certificate cert-ex1 { … }    # absent on uncertified flows
//     note "…"                             # the per-flow provenance,
//                                          # native at last (repeatable)
//   }
//
// THE DELIBERATE NON-UNIFICATION (the dossier's hazard 6): storyline
// subjects are NOT expressed via the kernel `instance` construct —
// instance's C17/C18 scope/version-pin discipline (definition_versions,
// chain levels) is heavier than demo seeds carry, and the sample-data
// compiler consumes the flat manufacturer/family/model/sample records
// directly. Storyline records stay DOCUMENTARY: field-level checking
// (the schema's per-slot required discipline) is app-side — the kernel
// checks only the shape legs of C129.
//
// The legacy flow shapes (r129's legacyEvaluation/legacyTestReport)
// retire to sources/attic/ in Phase 3 — these constructs cover the
// modern flow shape only.
// ─────────────────────────────────────────────────────────────────────

/** A demo-record scalar (the quantity.ts dumpScalarToken conventions:
 *  numbers bare, whitespace/brace-carrying strings quoted). */
export type RecordScalar = string | number;

/** A demo-record field value: a scalar or a braced list of scalars. */
export type RecordValue = RecordScalar | RecordScalar[];

/** One record-shaped entry of a demo_world participants section. */
export interface ParticipantsEntry {
  id: string;
  /** The field map, in authored order. */
  fields: Record<string, RecordValue>;
}

/** One OPEN participants section (operated_schemes, organizations, … —
 *  the section names are program content, not grammar). */
export interface ParticipantsSection {
  id: string;
  entries: ParticipantsEntry[];
}

/** demo_world <id> — one per package: the file-level metadata and the
 *  participant registry the storylines' parties resolve against. */
export interface DemoWorld {
  id: string;
  /** The package id this world seeds ('' = undeclared). */
  standard: string;
  description: string;
  participants: ParticipantsSection[];
}

/** The storyline's party binding (the laboratory + authority pair). */
export interface StorylineParty {
  laboratory: string;
  authority: string;
}

/** One subject-plane entry (manufacturer / family / group / model /
 *  sample — the slot kinds are open, the same open-record doctrine as
 *  the participants sections). */
export interface StorylineSubjectEntry {
  kind: string;
  id: string;
  fields: Record<string, RecordValue>;
}

/** One workflow record (application, test_request, test_report,
 *  evaluation, certificate, …) — `record <store> <id> { … }`. */
export interface StorylineRecord {
  /** The record's store (entity-class store name; resolves at check
   *  time, C129 — per-register gated). */
  store: string;
  id: string;
  fields: Record<string, RecordValue>;
}

/** storyline <id> — one per flow: the narrative spine plus the flat
 *  demo records. */
export default interface Storyline {
  id: string;
  name: string;
  /** The id-minting prefix (^[a-z0-9-]+$ — C129). */
  idPrefix: string;
  party: StorylineParty;
  subject: StorylineSubjectEntry[];
  records: StorylineRecord[];
  /** The per-flow provenance notes (repeatable). */
  notes: string[];
}
