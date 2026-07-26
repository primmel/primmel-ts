# Vendored ReqIF 1.0.1 XML schemas (task 27b, review Minor 3)

The XSD the ReqIF export's conformance check validates against, vendored
so the check no longer fetches the ROOT schema over plain HTTP at
validation time. The files are byte-identical to upstream (sha256
below); this README carries the provenance the files cannot (a header
comment inside the .xsd would break byte identity).

| File | Source URL | Retrieved | sha256 |
|---|---|---|---|
| `reqif.xsd` | http://www.omg.org/spec/ReqIF/20110401/reqif.xsd | 2026-07-26 | 9243f345540f25db3b53403da9ad9cd4744277ef01492ac3589937f533ba94c0 |
| `xml.xsd` | http://www.w3.org/2001/xml.xsd | 2026-07-26 | 61960fb3131e38022caad5360e2f33a3382578ab3c80cd58bd74320ede61b20c |
| `driver.xsd` | http://www.omg.org/spec/ReqIF/20110402/driver.xsd | 2026-07-26 | 4995bc97cf0a9b8462ca295006dd54d9a85fb820cf9fd6e134a51743fc44effd |

Usage (manual conformance check — no CI leg today):

```
xmllint --noout --schema packages/primmel/test/fixtures/reqif-xsd/reqif.xsd <document.reqif>
```

Known limit: `reqif.xsd` imports `driver.xsd` (the XHTML namespace for
`ATTRIBUTE-VALUE-XHTML` content), and `driver.xsd` includes the W3C
XHTML-1.1 modularization suite (~30 files under
`http://www.w3.org/TR/xhtml-modularization/SCHEMA/`). Those imports
still carry their upstream absolute `schemaLocation` URLs, so xmllint
resolves that subtree from the network at validation time — the
modularization suite is a 20-year-stable W3C artifact set, and vendoring
its full closure was rejected as disproportionate. The vendored
`reqif.xsd` is the pinned root schema: its bytes are the record of what
the export was validated against, independent of what omg.org serves
next time. The output documents' `xsi:schemaLocation` still points at
the canonical OMG URL, as the DIN DKE SPEC 99200 examples do.
