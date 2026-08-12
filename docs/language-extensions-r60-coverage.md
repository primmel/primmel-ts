# Primmel Language Extensions for OIML R 60 Draft Coverage

**Status:** Draft proposal
**Authored:** 2026-08-13
**Scope:** Five new constructs to bring canonical Primmel to full coverage of the
OIML R 60 working draft at `~/src/oimlsmart/20260810-load-cell-evaluation-report.prl`

## Background

The R 60 load-cell evaluation report draft is written in a UML-style "pseudo-
Primmel" that overlaps canonical Primmel syntactically but uses several
constructs canonical Primmel doesn't support. A literal translation to
canonical Primmel loses semantic content; the alternative is to extend
Primmel so the draft's notation parses natively.

This document specifies each missing construct with proposed syntax,
AST/type shape, parser/serializer/validator changes, and examples.
Implementations land as separate PRs against `primmel/primmel-ts` and
ship as kernel minor versions (1.6, 1.7, …).

## Extension order

The extensions are listed in dependency order. Each builds on the
previous one's parser/AST infrastructure.

1. **Parameterized types** — `ValueWithUnit(unit: "X")` and the general
   `T(args)` form. Highest blast radius; needed before the others can
   reuse the parameter syntax.
2. **Class-level references** — `ref [ doc, "clause" ]` and the canonical
   form. Smallest change; can land independently.
3. **Inline anonymous structs** — `field: { ... }` as a one-off type
   declaration. Reuses parameterized-type infrastructure.
4. **Struct-shaped conditionals** — `required_if: { field: Boolean }`
   and the general `required_when`/`required_if` family.
5. **Inline enum constraints** — `enum: ["V", "count"]` inside type
   parameters.

---

## Extension 1: Parameterized types

### Current state

Primmel types are bare identifiers (`String`, `Integer`, `DateTime`) or
qualified names (`Foo.Bar`). The kernel has no syntax for type
parameters — types are not generic.

### Draft notation

```
supply_voltage: ValueWithUnit(unit: "V")
rated_output:   ValueWithUnit(unit: {enum: ["V", "count"]})
cable_length:   ValueWithUnit(unit: "m")
temperature:    ValueWithUnit(unit: "degC")
```

Appears ~20 times across the draft. The pattern is `Type(arg: value, …)`
where args can be strings, numbers, or structured values.

### Why existing Primmel doesn't cover this

`quantity` blocks (existing Primmel) declare a named quantity type
separately from its use site:

```
quantity temperature { unit "degC" }
class Foo { temp: temperature { } }
```

That works for fixed units, but the draft's `ValueWithUnit(unit: "X")`
binds the unit at the use site — the same logical type (`ValueWithUnit`)
specialised per field. Mapping each `ValueWithUnit(unit: "X")` to a
separate `quantity X { }` declaration pollutes the namespace (one quantity
per unit) and loses the "this is the same kind of thing" relationship.

### Proposed syntax

```
field: TypeName(arg: value, arg2: value2)
```

Concrete examples:

```
class LoadCellSample#data {
  supply_voltage: ValueWithUnit(unit: "V") {
    definition "Power supply voltage applied to the load cell"
  }
  cable_length: ValueWithUnit(unit: "m") {
    definition "Cable length"
  }
}
```

Backward compatible: existing `field: TypeName` parses unchanged. The
parser only enters parameter mode when it sees `(` after the type name.

### AST/type changes

```ts
// src/types/Form.ts (extend FormField)
export interface FormField {
  // … existing fields …
  /** Type parameters, when the field's type is parameterized. Empty
   *  for plain `field: TypeName`. */
  typeParameters?: TypeParameter[];
}

export interface TypeParameter {
  name: string;
  value: TypeParameterValue;
}

export type TypeParameterValue =
  | { kind: 'string'; value: string }
  | { kind: 'number'; value: number }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'enum'; values: string[] }   // for `enum: ["V", "count"]`
  | { kind: 'identifier'; value: string };
```

### Parser changes

`src/ser-des/config/field-parser.ts` — after parsing the type name, peek
for `(`. If present, parse `(name: value, …)` as a parameter list.

The existing name-spec accumulator in `forEachAttribute` already
preserves the full `Type(arg: value, …)` string as part of `basic`. The
split happens in `parseDataAttribute`, which currently does:

```ts
const colonIndex = basic.indexOf(':');
result.type = basic.substr(colonIndex + 1, ...).trim();
```

After the change:

```ts
const colonIndex = basic.indexOf(':');
const typeSpec = basic.substr(colonIndex + 1).trim();
const paramMatch = typeSpec.match(/^(\w+)\s*\(([\s\S]*)\)$/);
if (paramMatch) {
  result.type = paramMatch[1];
  result.typeParameters = parseTypeParameters(paramMatch[2]);
} else {
  result.type = typeSpec;
}
```

`parseTypeParameters` is a small helper that tokenises `name: value, …`
using `tokenizePackage`.

### Serializer changes

`dumpDataAttribute` (`src/ser-des/config/data.ts`) — after writing the
type name, write `(name: value, …)` if `typeParameters` is present:

```ts
let typeSpec = attr.type;
if (attr.typeParameters && attr.typeParameters.length > 0) {
  typeSpec += '(' + attr.typeParameters.map(dumpTypeParameter).join(', ') + ')';
}
```

### Validator changes

No new validators. The parameter values are opaque to validation — they
flow through to type-specific consumers (forms, calculations).

### Examples

| Draft | Canonical (post-extension) |
|---|---|
| `supply_voltage: ValueWithUnit(unit: "V")` | unchanged |
| `rated_output: ValueWithUnit(unit: {enum: ["V", "count"]})` | unchanged (depends on Extension 5) |
| `temperature: ValueWithUnit(unit: "degC")` | unchanged |

### Alternatives considered

- **One quantity per unit** — declare `quantity voltage_v { unit "V" }`,
  `quantity cable_length_m { unit "m" }`, etc. Rejected: pollutes
  namespace, loses the type relationship.
- **Field-level unit attribute** — `field: Real { unit "V" }`. Existing
  Primmel supports this for `quantity` types. Rejected: doesn't capture
  the "ValueWithUnit" intent (the type itself is parameterized, not the
  field).
- **Macro expansion** — preprocess `ValueWithUnit(unit: "X")` to
  generate a per-use quantity. Rejected: hides intent, complicates
  tooling.

---

## Extension 2: Class-level references

### Current state

Primmel `class` bodies accept: `store`, `description`, `indexes`,
`helper`, `extends`, and attribute declarations. References (`ref`) are
only supported at attribute scope inside a field's `{ ... }` block.

### Draft notation

```
class ApplicantDocumentation {
  description "Documentation supplied with the test pattern by the applicant"
  ref [
    oiml-r60-3, "4.9.5"
  ]

  name: String { … }
  version: String { … }
}
```

The `ref [ doc, "clause" ]` form is non-canonical (Primmel uses
`ref <predicate> "<target>"`), but the intent — "this class is defined
at clause X of document Y" — is clear.

### Why existing Primmel doesn't cover this

The dataclass parser dispatches on the head keyword of each entry
(`store`, `description`, `indexes`, `helper`, `extends`, or
fall-through to attribute). `ref` at class scope falls through and is
parsed as a malformed attribute.

### Proposed syntax

Canonical Primmel already has a unified `ref` construct
(`ref <predicate> "<target>"` with optional `{ note }`). Extend the
dataclass parser to accept `ref` at class scope:

```
class ApplicantDocumentation#data {
  description { "Documentation supplied with the test pattern by the applicant" }
  ref cites "urn:oiml:pub:r:60-3:2021#clause-4.9.5"

  name: String { }
  version: String { }
}
```

The draft's bracket form `ref [ doc, "clause" ]` is **not** adopted —
the translation maps it to one or more canonical `ref cites "urn:..."`
lines. The bracket form remains a draft-only notation.

### AST/type changes

```ts
// src/types/data.ts (extend DataClass)
export interface DataClass {
  // … existing fields …
  /** Provenance: where this class is defined in source documents. */
  ref?: Reference[];
}
```

The `Reference` shape is reused from the existing type — class-level and
attribute-level refs have the same structure.

### Parser changes

`src/ser-des/config/data.ts` — `parseDataClass`'s visitor already
dispatches on the head keyword. Add a `ref` branch that calls the
existing `parseRef` helper:

```ts
if (head === 'ref') {
  // parseRef returns the ref and the next token index; the dataclass
  // visitor is invoked by forEachAttribute which doesn't expose peek(),
  // so we adapt by re-tokenising `details` (the post-ref content).
  result.ref ??= [];
  result.ref.push(parseRefFromBasic(details));
  return;
}
```

Because `forEachAttribute` passes the post-keyword content as `details`,
the existing ref parsing logic needs slight adaptation to consume from
a string rather than a token stream.

### Serializer changes

`dumpDataClass` — after the description/store/indexes block, emit one
line per ref:

```ts
for (const r of dataclass.ref ?? []) {
  out += dumpSourceRefAsRef(r, '  ', escapeString);
}
```

(`dumpSourceRefAsRef` already exists for forms/tables; reuse it.)

### Validator changes

One new validator: class-level refs should point to real documents.
Reuse the existing `checkFormReferences` pattern — extend the source-ref
validator to walk class-level refs.

### Examples

```
class LoadCellEvaluationReport#data {
  description { "Load Cell Evaluation Report" }
  ref cites "urn:oiml:pub:r:60-3:2021#clause-4"
  ref cites "urn:oiml:pub:r:60-3:2021#clause-4.9.4"
}
```

### Alternatives considered

- **Adopt the bracket form `ref [ doc, clause ]`** — rejected; the
  bracket form isn't as expressive (no predicate, can't carry a note).
- **Move class-level refs into the description text** — rejected; loses
  machine-readability.

---

## Extension 3: Inline anonymous structs

### Current state

Every Primmel type is either a primitive or a declared top-level
construct (`class X#data { … }`, `enum X { … }`). There's no syntax for
declaring a one-off struct inline at a field site.

### Draft notation

```
test_period: {
  begin: DateTime,
  end: DateTime
} {
  description "Period of tests"
}
```

The first `{ ... }` is an inline struct type; the second is the field's
metadata block.

### Why existing Primmel doesn't cover this

Without inline structs, the draft's author would have to declare
`TestPeriod` as a top-level class, then reference it:
`test_period: TestPeriod { … }`. That's the canonical translation, and
the current translator already does it (extracting to
`<Parent>_<field>_t`).

But the extracted form loses the "this is a one-off shape, not a
reusable type" intent. And it pollutes the namespace with
`ReportMetadata_test_period_t`, `LoadCellTypeInformation_required_if_t`,
etc.

### Proposed syntax

```
field: struct { field1: Type1; field2: Type2; … } { …meta… }
```

Or, accepting the draft's brace form directly:

```
test_period: {
  begin: DateTime
  end: DateTime
} {
  definition "Period of tests"
}
```

The parser detects inline struct when it sees `field: {` (the `{`
immediately follows `:`). The first `{ ... }` is the struct body; an
immediately following `{ ... }` is the field's metadata block.

### AST/type changes

```ts
// src/types/Form.ts (extend FormField)
export interface FormField {
  // … existing fields …
  /** Inline anonymous struct, when `type` is omitted and an inline body
   *  is provided. Mutually exclusive with `type`. */
  inlineStruct?: InlineStructField[];
}

export interface InlineStructField {
  name: string;
  type: string;
  cardinality?: string;
}
```

### Parser changes

`forEachAttribute` (in `parse-block.ts`) — when the token after `:` is
`{`, switch to inline-struct mode. Walk the brace body, parse each
`name: type` pair (no per-field metadata blocks in the inline form —
keep it simple), then handle the trailing meta block.

This is the largest single change in this doc. The parser needs a new
mode that recognises the inline-struct opener vs. the metadata-block
opener (both are `{`).

### Serializer changes

`dumpDataAttribute` — when `inlineStruct` is present, emit the brace
form instead of `type`:

```ts
if (attr.inlineStruct) {
  let spec = ' {\n';
  for (const f of attr.inlineStruct) {
    spec += `    ${f.name}: ${f.type}${f.cardinality ? '[' + f.cardinality + ']' : ''}\n`;
  }
  spec += '  }';
  // then the meta block follows
}
```

### Validator changes

Two new validators:
- Inline struct fields must have valid types (resolve against the
  class registry).
- Inline struct field names must be unique within the struct.

### Examples

```
class ReportMetadata#data {
  test_period: {
    begin: DateTime
    end: DateTime
  } {
    definition "Period of tests"
  }
}
```

### Alternatives considered

- **Extract to top-level class** (current translator behavior) — works
  but pollutes namespace. Acceptable when the struct is reused; not
  when it's a one-off.
- **TypeScript-style inline type** (`field: { begin: DateTime; end: DateTime }`)
  — same as proposed, semantically. The brace form is the natural fit
  for Primmel.

---

## Extension 4: Struct-shaped conditionals

### Current state

Primmel's `required_when` (on form fields) and `condition` (on
constraints) take a single OCL expression: `required_when ocl{…}`.

### Draft notation

```
required_if: {
  LoadCellTypeInformation_required_if: Boolean
}
```

The draft's `required_if` is a struct of boolean flags, each named
after a field in another class. The field is required when any of
those booleans is true.

The draft also uses `applicable_if` similarly — a struct of conditions
under which the field is applicable (test is run, etc.).

### Why existing Primmel doesn't cover this

`required_when ocl{ X || Y || Z }` is the canonical equivalent — but
only when the conditions are OCL expressions. The draft's authors wrote
struct-shaped conditions because:
1. The conditions reference fields by name, not by OCL expression.
2. Each condition has a separate Boolean flag that other parts of the
   model can set independently.
3. The author may not have known OCL.

### Proposed syntax

Two options:

**(a)** Adopt the struct form verbatim, with a new `required_if` keyword
on dataclass attributes:

```
cable_length: ValueWithUnit(unit: "m") {
  definition "Cable length"
  required_if {
    strain_gauge_4_wire: Boolean
    accuracy_class_in: Boolean
  }
}
```

The parser treats `required_if { field: Boolean, … }` as a list of
named conditions; the validator generates an implicit OCL expression
(`required_when ocl{ strain_gauge_4_wire || accuracy_class_in }`) for
downstream consumers.

**(b)** Translate to canonical `required_when ocl{…}` in the translator:

```
cable_length: ValueWithUnit(unit: "m") {
  definition "Cable length"
  required_when ocl{strain_gauge_4_wire || accuracy_class_in}
}
```

This needs no kernel change but loses the named-condition structure.

**Recommendation: (a)** — adopt struct form. The named-condition
structure is useful for tooling (the editor can render "required when:
strain_gauge_4_wire, accuracy_class_in" instead of a raw OCL
expression).

### AST/type changes

```ts
// src/types/Form.ts (extend FormField)
export interface FormField {
  // … existing fields …
  /** Named conditions under which this field is required. Mutually
   *  exclusive with `requiredWhen`. */
  requiredIf?: RequiredIfCondition[];
}

export interface RequiredIfCondition {
  /** Field path, e.g. "LoadCellTypeInformation.required_if.strain_gauge_4_wire". */
  field: string;
  /** Optional human-readable description of when this condition applies. */
  description?: string;
}
```

### Parser changes

`parseDataAttribute`'s body visitor — add a `required_if` branch that
parses a brace block of `name: Boolean` pairs into a `RequiredIfCondition[]`.

### Serializer changes

`dumpDataAttribute` — when `requiredIf` is present, emit the struct
form:

```
required_if {
  strain_gauge_4_wire: Boolean
  accuracy_class_in: Boolean
}
```

### Validator changes

- The conditions must reference real Boolean fields elsewhere in the
  model.
- Cross-check with `requiredWhen` (mutually exclusive on the same
  field).

### Downstream: `required_when` integration

The validator/serializer generates an equivalent OCL expression for
tools that only know `required_when`:

```
required_if { A: Boolean; B: Boolean }
  → required_when ocl{ A || B }
```

This keeps existing consumers (form generators, simulators) working
without modification.

### Examples

```
class LoadCellTypeFamilyInformation#data {
  cable_length: ValueWithUnit(unit: "m") {
    definition "Cable length"
    required_if {
      strain_gauge_4_wire: Boolean
    }
  }
}
```

### Alternatives considered

- **OCL-only (option b)** — works but degrades tooling UX (raw OCL is
  harder to render/edit than named conditions).
- **Externalize to a constraints file** — keep the data model clean,
  put conditions in a separate `constraints.prl`. Rejected: fragments
  the model; the conditions are intrinsic to the field.

---

## Extension 5: Inline enum constraints

### Current state

Primmel has top-level `enum X { … }` declarations. There's no syntax
for constraining a field's value to an inline enum at the use site.

### Draft notation

```
rated_output: ValueWithUnit(unit: {enum: ["V", "count"]})
```

The `enum: [...]` inside a type parameter constrains the parameter's
value to one of the listed strings.

### Why existing Primmel doesn't cover this

Existing Primmel would model this as a top-level `enum` and reference
it. The draft's inline form is shorthand for "this parameter accepts
one of these specific values, defined here at the use site."

### Proposed syntax

Accepted as part of Extension 1's parameter-value grammar. The
`TypeParameterValue` variant `{ kind: 'enum'; values: string[] }`
already in the proposed AST covers it. The parser detects `enum:`
inside a parameter value and parses the bracket list.

```
rated_output: ValueWithUnit(unit: {enum: ["V", "count"]}) {
  definition "Rated output"
}
```

### Parser changes

In `parseTypeParameters` (added by Extension 1), when a parameter value
starts with `{`, look for `enum:` followed by a bracket list. Parse the
list items as string literals.

### Serializer changes

`dumpTypeParameter` — emit `{enum: [...]}` for enum-typed values.

### Validator changes

- Enum values should be unique within a parameter.
- Cross-validate against any external enum registry if the parameter
  name matches a registered enum.

### Examples

Already shown in Extension 1's examples table.

---

## Migration plan

If the design is approved, implementation order:

| Phase | Extension | Effort estimate | Version |
|---|---|---|---|
| 1 | Extension 2 (class-level refs) | ~1 day | 1.6.0 |
| 2 | Extension 1 (parameterized types) | ~3 days | 1.7.0 |
| 3 | Extension 5 (inline enum constraints) | ~0.5 day | 1.7.0 (with #2) |
| 4 | Extension 3 (inline anonymous structs) | ~2 days | 1.8.0 |
| 5 | Extension 4 (struct conditionals) | ~2 days | 1.9.0 |

Each phase is independently shippable. The translator
(`studio/scripts/translate-draft.mjs`) updates as each extension lands,
dropping the corresponding TODO comments.

### Testing strategy

Per extension:
- Parser unit tests: positive (canonical syntax parses) + negative
  (malformed input throws cleanly).
- Serializer roundtrip tests: dump(load(text)) is idempotent.
- Validator tests: well-formed models validate clean; malformed models
  produce the expected issue codes.
- Cross-extension integration tests once all five land: load the full
  translated draft.

### Backward compatibility

All five extensions are additive — they introduce new syntax but don't
change existing construct semantics. Existing models parse unchanged
after each release.

The translator (in `studio/scripts/translate-draft.mjs`) is updated per
phase to drop the corresponding pattern's TODO comments and emit the
new canonical form. Until all phases land, the translator produces a
mix of canonical Primmel and TODO comments.

## Open questions

1. **`ValueWithUnit` as a built-in vs. user-defined?** The draft treats
   it as a generic type that anyone can use. Should Primmel ship a
   `ValueWithUnit` built-in, or expect each program to declare it?
   Recommend: user-defined (the OIML package declares it once; consumers
   specialise per field). Extension 1 enables the syntax either way.

2. **`required_if` vs. `applicable_if` vs. `tested_if`** — the draft
   uses multiple condition families. Should Primmel add a generic
   `condition_if(name) { … }` construct, or one keyword per family?
   Recommend: start with `required_if` (the most common); add others
   as separate proposals if needed.

3. **Inline struct vs. inline type alias** — should Primmel also allow
   `type X = { a: A; b: B }` for reusable inline types? Out of scope
   for this proposal but worth flagging.

4. **Bracket form vs. canonical ref form** — should the parser accept
   `ref [ doc, clause ]` as sugar for `ref cites "urn:..."`, or
   require the canonical form? Recommend: canonical only; the bracket
   form is a draft convention.
