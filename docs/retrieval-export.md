# The retrieval export (`primmel-retrieval/1`)

`primmel export retrieval <package-dir> [--out <file>]` — the canonical,
versioned serialization of a package's typed units for RAG and agent
consumers (primmel/primmel-ts#65). The module is
`packages/primmel/src/export/retrieval.ts`; this document is the
contract its header summarizes. One-way projection, never the kernel's
truth — the same doctrine as the ReqIF and RDF surfaces: the `.prl`
package stays the single source of truth; the export is generated,
never authored, never re-imported.

## The document

```jsonc
{
  "projection": "primmel-retrieval/1",
  "facet_version": "retrieval-facet/1",  // the per-unit facet shape version
  "package": {
    "id": "oiml-r60",
    "title": "OIML R 60:2021 — R 60 package",
    "kind": "rec",
    "edition": "2021",          // the publication edition the model corresponds to
    "model_version": "2021",    // the package's own version field
    "editions": ["2021", "2017", "2000", "1996"],
    "base_urn": "urn:oiml:pub:r:60:2021",
    "status": "current",
    "default_spelling": "eng-Latn",
    "spellings": ["eng-Latn"],
    "supersedes": ["urn:oiml:pub:r:60:2017"]
  },
  "source_hash": "sha256…",      // over every byte of the package directory
  "units": [ /* the typed units */ ]
}
```

The JSON serialization is byte-deterministic per package state: object
keys sorted recursively, two-space indent, trailing newline.

## The seven guarantees, and where each lives

### 1. Clause URNs first-class, always

Every unit's provenance is the document's **own clause numbering** plus
the **document identifier**:

```jsonc
"clause": {
  "doc": "urn:oiml:pub:r:60-1:2021",
  "clause": "3.6",
  "urn": "urn:oiml:pub:r:60-1:2021#clause-3.6"
}
```

`clauses` carries every edge (the first is the primary `clause`); the
sentence sub-address rides as `fragment` and on the URN
(`#clause-2.2/s1`). A producer-internal anchor is **never** the clause:
a metanorma UUID (`_eb46a3a3-…`) — wherever it arrives, doc-fragment
slot or clause slot — is demoted to the optional `anchor` extra, and
the URN degrades to the bare document rather than presenting an
uncitable token as provenance. A non-clause document fragment the
source genuinely names (a table anchor, `#table-4`) is citable and
diffable, so it stays on the URN as `anchor`.

The debt is counted, never hidden: `stats.anchorOnlyProvenance` (units
whose provenance carries no clause number at all) and
`stats.nonUrnDocRefs` (units citing a legacy non-URN doc token) surface
in the CLI summary.

### 2. Canonical edition semantics

Two distinct, stable fields, never borrowed from each other:

- **`edition`** — the *publication* edition the model corresponds to:
  the manifest's newest `editions` entry (the register is
  newest-first), falling back to the base URN's trailing year segment.
  Consumers steer on it ("answer from the current edition").
- **`model_version`** — the package's own `version` field. Consumers
  gate freshness on it.

The two coincide in value on some packages and diverge on others; both
are always present and always mean the same thing.

### 3. The pre-flattened retrieval facet

Every unit carries `facet` — **one flat scalar map** (string values
only, no nesting, no arrays), versioned independently of the projection
as `retrieval-facet/1` on the document's `facet_version`. Retrieval
indexes (Cloudflare Vectorize and peers) accept only scalar metadata
per vector; the facet is the canonical pre-flattened form, so a
consumer's ingestion is a *mapping*, never a re-derivation of the
package tree.

The key set (shape version `retrieval-facet/1`):

| key | value | |
|---|---|---|
| `unit_id` | the unit's stable id (`/req/class-a/mpe`) | per unit |
| `unit_hash` | the unit's `content_hash` | per unit |
| `block` | the unit kind (`requirement`, `term`, …) | per unit |
| `clause_anchor` | the primary edge's **document clause number** (`5.3.2`), `''` when the unit names no clause — never a producer UUID | per unit |
| `clause_title` | the unit's display name, its id as fallback | per unit |
| `app_<dimension>` | the applicability values, sorted, `\|`-joined (`A|C`) | per declared dimension |
| `app_<dimension>_match` | the declared match mode, only when not `any` (`all`, `exact`) | per declared dimension |
| `doc_id` | the package id (`oiml-r60`) | per package |
| `docidentifier` | the display label derived from the base URN (`OIML R 60:2021`), the package title as fallback | per package |
| `doctype` | the lower-case publication-type letter (`r`) | per package |
| `doc_number` | the document number, part suffix included (`60`, `60-1`) | per package |
| `edition` | the package block's canonical edition (ask 2 — not a URN re-parse) | per package |
| `model_version` | the package's own version | per package |
| `language` | the package's authored default spelling (ISO 24229, e.g. `eng-Latn`) | per package |
| `status` | the manifest status (`current`), when declared | per package |

The base-URN parse (`retrievalDocParts`) follows the deployed
consumer's grammar — `urn:oiml:pub:<type>:<number>[:<year>]`, type ∈
r/d/b/g/e — extended with the part suffix the publication URNs carry. A
base URN outside the register yields **empty** `doctype` / `doc_number`
and a title-fallback `docidentifier`, never an invented value (the
register mapping stays consumer-side).

Congruence with the deployed consumer's chunk wire schema (its
`ChunkMetaModel`): the overlapping keys carry the same names and
semantics. The schema's lane constants — `tier`, `corpus`, `producer`,
`text_ref`, `superseded_by` — are **deployment stamps, not package
content**: the consumer's adapter sets them per lane and the facet
deliberately never carries them. Three deliberate value choices: the
facet's `language` is the authored ISO 24229 spelling code (the lanes
stamp a constant two-letter code today; the adapter maps), the facet's
`clause_anchor` is `''` for clause-less units (the model lane's
`"model"` fallback marker is the lane's own choice, applied at its
adapter), and `edition` is the package block's field rather than a
re-parse of the base URN.

**The facet is a derived projection, excluded from the content_hash
input.** The digest covers the unit's authored content; the facet
re-derives from that content (plus the package block) deterministically
— `unit_hash` inside the facet reads the computed digest, so the
currency signal survives the flattening. Shape changes (a key renamed,
removed, or re-typed) bump `retrieval-facet/1`; additive keys within a
version are legal — indexes ignore what they do not read.

### 4. Stable unit ids + content digests

**Stability tier: STABLE PUBLIC IDENTIFIER.** Unit ids are the
package's own authored identifiers:

| kind | id | source |
|---|---|---|
| `requirement`, `conformance_test` | as authored (`/req/class-a/mpe`, `/conf/…`) | the construct id |
| `term`, `attribute`, `behavior`, `symbol`, `constraint`, `characteristic`, `table`, `sequence`, `note` | `/〈kind〉/〈id〉` | the construct id, namespaced |
| `calculation` | the declared `identifier` (`/calc/mpe`), else `/calculation/〈id〉` | the canonical identifier path |
| `formula` | `/calculation/〈id〉` | a calculation carrying an engine rule type |
| `state_machine` | `/state-machine/〈entityName〉` | the bound entity's name |
| `dimension` | `/dimension/〈id〉` | the classification dimension id |

An id moves only when the package re-authors the identifier. A rename
of display text (`name`, `label`, `statement`, `definition`) never
moves an id. Consumers key retrieval, citation, and freshness gates on
these ids; the kernel keeps them stable across refactors of the
projection itself.

Beside the id rides **`content_hash`**: sha256 over the unit's
canonical JSON content — every unit field except `content_hash`,
`passport`, and `facet` (the derived projections), serialized with keys
sorted recursively and compact separators in UTF-8 (the form every JSON
stack reproduces:
`json.dumps(c, sort_keys=True, separators=(",", ":"),
ensure_ascii=False)`; `canonicalJson` in the module). **Identity = id;
currency = digest.** A rename moves the digest, never the id — so a
display-text change no longer masquerades as an identity change, and a
content change never hides behind a stable id.

### 5. Semantic edition diff as a data API

The model diff (`primmel diff [--json]`, `src/model-diff.ts`) is the
data API: per-element added/removed/changed/moved keyed by the same
package-authored ids the retrieval units carry, with the clause-drift
table (the edition-to-edition clause mapping — renumbered / re-cited /
de-cited rows with their citing elements) and the changed-aspect
classification. Every changed entry carries **`fields`** — the
changed-field list: the differing field names within the changed
aspects, refined through plain-object values, so "R 60's creep
requirement tightened from X to Y in the 2021 edition" answers from the
data (`fields: ["limit.expression"]`), not a reading marathon.

The shape is congruent with the Metanorma-side semantic diff
(`Mko::Diff`, metanorma-mko#1 — `{ from, to, added, removed, changed:
[{ …, fields: [...] }] }` over stable-id-paired units): same change-set
vocabulary, same `fields` key, same hash-skips-unchanged pairing
discipline. Primmel's additions are the tier annotation, the moved
class (an anchor-only re-anchor is not a content change), and the
clause-drift table; Mko's `rows(+N)` table-row annotation has no
equivalent — arrays compare whole and the field names the array.

Refinement rules: plain-object values recurse (`limit.expression`,
`limit.accepts`, `spelling:fra-Latn.value` for the ISO 24229 content
sets — value vs `via` named separately); arrays and scalars compare
whole; present-vs-absent names the field itself. Provenance compares
edition-stripped (the expected re-citation stays invisible) and names
the channel a citation moved on — `source` / `sourceRef` /
`sourceRefs` / `reference`; channels the parser aliases (an authored
`source { … }` block lands in `source` *and* `sourceRefs`) report once
when they move identically. The human report renders the list inline:
`~ [secondary/requirements] /req/metrological/mpe — limit (fields:
limit.expression)`.

### 6. The machine passport

Every unit carries `passport` — the compact digest an agent (an MCP
server) carries and verifies without loading the package:

```jsonc
"passport": {
  "v": 1,
  "kind": "requirement",
  "id": "/req/class-a/mpe",
  "text": "For Class A load cells, the maximum permissible error shall not exceed…",
  "expression": "ocl{group.parameters.mpe = lookupMPE(load, …)}",
  "units": [],
  "applicability": "accuracy_class=A",
  "acceptance": "",
  "provenance": ["urn:oiml:pub:r:60-1:2021#table-4"],
  "content_hash": "sha256…"
}
```

`passportCanonical` renders the canonical string form; re-hashing it
(`retrievalDigest`) is the verification. Every passport field is always
present (empty string / empty list when the unit declares nothing), so
the canonical form has one shape per passport version.

### 7. Language-tagged variants

Every unit carries **`language`** — the package's `default_spelling`
(ISO 24229, e.g. `eng-Latn`), the tag of the *inline* prose values
(`name` / `statement` / `definition`). When the package ships ISO 24229
`text` blocks (the per-spelling alternate content sets), the unit
carries **`variants`**: the alternates resolved onto the unit, keyed by
the addressed field path, each entry `{ spelling, via?, value }` in
authored order:

```jsonc
"language": "eng-Latn",
"variants": {
  "statement": [
    { "spelling": "fra-Latn", "value": "La valeur de la plus grande charge …" },
    { "spelling": "zho-Latn", "via": "BGN-PCGN:zho-Hans:Latn:1979", "value": "…" }
  ]
}
```

Resolution follows the **same address rule as the C89 linter**: the
addressed element is the longest dot-boundary prefix of the address
registered in the package (element ids may carry dots —
`r144-3/sec-3.4`), the remainder is the path into the element's
structure (the nested `<path…>.<field>` form keys whole:
`fields.runs.fields.indication.label`). The match is on the **kernel
element id**, not the namespaced unit id — a term's variants address
`frobnicator`, and the projection attaches them to `/term/frobnicator`.
`resolveTextAddress` is exported for consumers building their own
indexes.

Both fields are **authored content and participate in the
`content_hash`** — a translation change moves the unit's digest like
any other content change (the freshness gate sees it; identity still
never moves). A `text` block addressed at an element the projection
does not ship as a unit (a form, a subject, an instrument) is counted
in `stats.droppedTextBlocks` — never silently lost, and never
misattached to a shorter-prefix element that happens to be projected.

## The bundle freshness signal

`source_hash` is sha256 over every file of the package directory —
sorted walk, `.DS_Store` skipped, relative path + NUL + the file's own
sha256 + LF. This is **the same algorithm the deployed consumer runs**
(oimlsmart/smart `browser/scripts/derive-model-plane.ts`), so the
consumer's pins (`standard → { source_hash, node_count }`) key on this
export without translation. The hash is deliberately byte-sensitive:
any package change — a re-authored constraint, a re-cited clause, a
payload byte — moves it. Content-free reordering moves `source_hash`
but no unit's `content_hash`; that split is the point.

## Versioning

- **`projection`** (`primmel-retrieval/1`) versions the document shape.
  A field renamed, removed, or re-typed bumps the version and is a
  re-index signal for every consumer; additive fields within a version
  are legal (consumers ignore what they do not read).
- **`facet_version`** (`retrieval-facet/1`) versions the per-unit facet
  key set on the same rule (the facet is the derived projection —
  excluded from the content_hash input; its shape versions separately).
- **`passport.v`** versions the passport shape on the same rule.

## Congruence with the deployed consumer

The export is the upstream canonical form of the content the OIML SMART
estate's model plane ships today
(`browser/public/data/model-plane/*.json` → oimlsmart/rag
`model_plane.py`). Deliberately identical: the unit ids, the
`clause: { doc, clause, urn }` shape, the sha256 currency signals, the
`source_hash` algorithm, the `edition`/`model_version` split. Deliberate
divergences: the document block nests under `package` (the plane's
bundle carries `label`/`base_urn` top-level); the kind vocabulary is
the kernel's honest one (`formula` for a rule-typed calculation,
matching the consumer's calculations/formulas split; `characteristic`
for a verdict, matching the plane's characteristics.yaml projection);
and the digest input is the compact canonical JSON above (the
consumer's D1 `content_hash` uses Python's default separators over a
differently-shaped node — byte-parity was never possible, the semantic
is the same).

The language-level half of these guarantees — aliases, typed
applicability, resolvable refs, lineage edges, units-typed quantities,
verdict structure, the impact graph — is primmel/spec#18; this export
consumes the language as it stands and cross-references rather than
duplicates those asks.
