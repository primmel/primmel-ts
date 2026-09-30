#!/usr/bin/env ruby
# frozen_string_literal: true

# The CDDAL round-trip bridge: the interop counterpart's side of the
# conformance leg (conformance/runner/cddal-leg.mts). Parses one CDDAL
# document with the reference implementation (opencdd-ruby), reports the
# built entities as JSON, and re-serializes the database so the leg can
# assert identifier and assignment preservation on both forms.
#
#   ruby cddal-roundtrip.rb <file.cddal>
#
# Output (one JSON object on stdout):
#   { "classes":   [ { "code": "...", "superclass": "..." } ],
#     "serialized": "..." }

require "opencdd"
require "json"

path = ARGV[0] or abort "usage: cddal-roundtrip.rb <file.cddal>"

db = Opencdd::Cddal.parse(File.read(path))

classes = db.classes.map do |c|
  {
    "code" => c.code.to_s,
    "superclass" => c.superclass_irdi.to_s,
  }
end

puts JSON.generate({
  "classes" => classes,
  "serialized" => Opencdd::Cddal.serialize(db),
})
