import ConformanceTest from '../../types/ConformanceTest';
import { escapeString, unwrapBlock, tokenizePackage } from '../tokenize';
import { forEachEntry, unwrapped } from '../parse-block';
import { Dumper, Parser } from '../types';

export const parseConformanceTest: Parser = function (id, data) {
  const result: ConformanceTest = {
    id,
    name: '',
    type: '',
    reference: '',
    targets: [],
    procedure: [],
    measurements: [],
  };

  forEachEntry(
    data,
    (keyword, value) => {
      if (keyword === 'name') {
        result.name = unwrapped(value);
      } else if (keyword === 'type') {
        result.type = value();
      } else if (keyword === 'reference') {
        const refValue = value();
        result.reference = refValue.startsWith('{')
          ? unwrapBlock(refValue).trim()
          : refValue;
      } else if (keyword === 'targets') {
        result.targets = tokenizePackage(value());
      } else if (keyword === 'procedure') {
        const block = value();
        const tokens = tokenizePackage(block);
        let i = 0;
        while (i < tokens.length) {
          const order = parseInt(tokens[i], 10);
          if (!isNaN(order) && i + 1 < tokens.length) {
            const action = unwrapped(() => tokens[i + 1]);
            result.procedure.push({ order, action });
            i += 2;
          } else {
            i++;
          }
        }
      } else if (keyword === 'validate_measurement') {
        const block = value();
        const tokens = tokenizePackage(block);
        for (const t of tokens) {
          if (t.startsWith('"')) {
            result.measurements.push(unwrapBlock(t));
          }
        }
      } else {
        return false;
      }
      return true;
    },
    { construct: 'conformance_test', id },
  );

  return ctx => {
    ctx.conformanceTests[id] = result;
    return ctx;
  };
};

export const dumpConformanceTest: Dumper<ConformanceTest> = function (ct) {
  let out = 'conformance_test ' + ct.id + ' {\n';
  if (ct.name) {
    out += '  name "' + escapeString(ct.name) + '"\n';
  }
  if (ct.type) {
    out += '  type ' + ct.type + '\n';
  }
  if (ct.reference) {
    out += '  reference ' + ct.reference + '\n';
  }
  if (ct.targets.length > 0) {
    out += '  targets {\n';
    for (const t of ct.targets) {
      out += '    ' + t + '\n';
    }
    out += '  }\n';
  }
  if (ct.procedure.length > 0) {
    out += '  procedure {\n';
    for (const step of ct.procedure) {
      out += '    ' + step.order + ' "' + escapeString(step.action) + '"\n';
    }
    out += '  }\n';
  }
  if (ct.measurements.length > 0) {
    out += '  validate_measurement {\n';
    for (const m of ct.measurements) {
      out += '    "' + escapeString(m) + '"\n';
    }
    out += '  }\n';
  }
  out += '}\n';
  return out;
};
