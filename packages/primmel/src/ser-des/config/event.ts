import EventNode, {
  EndEvent,
  SignalCatchEvent,
  StartEvent,
  TimerEvent,
} from '../../types/events';
import { escapeString, unwrapBlock, tokenizePackage } from '../tokenize';
import { Dumper, Parser } from '../types';

export const parseEndEvent: Parser = function (id, data) {
  const result: EndEvent = {
    id: id,
    eventType: 'end',
  };
  if (data !== '') {
    const t: string[] = tokenizePackage(data);
    if (t.length > 0) {
      throw new Error(
        `Parsing error: end_event. ID ${id}: Expecting empty body`,
      );
    }
  }
  return ctx => {
    ctx.events[id] = result;
    return ctx;
  };
};

export const parseSignalCatchEvent: Parser = function (id, data) {
  const result: SignalCatchEvent = {
    id: id,
    eventType: 'signalcatch',
    signal: '',
  };

  if (data !== '') {
    const t: string[] = tokenizePackage(data);
    let i = 0;
    while (i < t.length) {
      const command: string = t[i++];
      if (i < t.length) {
        if (command === 'catch') {
          result.signal = unwrapBlock(t[i++]);
        } else {
          i++; // forward-compatible: skip unknown keyword value
        }
      } else {
        throw new Error(
          `Parsing error: Signal Catch Event. ID ${id}: Expecting value for ${command}`,
        );
      }
    }
  }
  return ctx => {
    ctx.events[id] = result;
    return ctx;
  };
};

export const parseStartEvent: Parser = function (id, data) {
  const result: StartEvent = {
    id: id,
    eventType: 'start',
  };

  if (data !== '') {
    const t: string[] = tokenizePackage(data);
    if (t.length > 0) {
      throw new Error(
        `Parsing error: end_event. ID ${id}: Expecting empty body`,
      );
    }
  }
  return ctx => {
    ctx.events[id] = result;
    return ctx;
  };
};

export const parseTimerEvent: Parser = function (id, data) {
  const result: TimerEvent = {
    id: id,
    eventType: 'timer',
    type: '',
    para: '',
  };

  if (data !== '') {
    const t: string[] = tokenizePackage(data);
    let i = 0;
    while (i < t.length) {
      const command: string = t[i++];
      if (i < t.length) {
        if (command === 'type') {
          result.type = t[i++];
        } else if (command === 'para') {
          result.para = unwrapBlock(t[i++]);
        } else {
          i++; // forward-compatible: skip unknown keyword value
        }
      } else {
        throw new Error(
          `Parsing error: Timer Event. ID ${id}: Expecting value for ${command}`,
        );
      }
    }
  }
  return ctx => {
    ctx.events[id] = result;
    return ctx;
  };
};

export const dumpEvent: Dumper<EventNode> = function (event) {
  if (event.eventType === 'start') {
    return dumpStartEvent(event as StartEvent);
  }
  if (event.eventType === 'end') {
    return dumpEndEvent(event as EndEvent);
  }
  if (event.eventType === 'signalcatch') {
    return dumpSignalCatchEvent(event as SignalCatchEvent);
  }
  if (event.eventType === 'timer') {
    return dumpTimerEvent(event as TimerEvent);
  }
  return '';
};

function dumpEndEvent(end: EndEvent): string {
  return 'end_event ' + end.id + ' {\n}\n';
}

function dumpSignalCatchEvent(sc: SignalCatchEvent): string {
  let out: string = 'signal_catch_event ' + sc.id + ' {\n';
  if (sc.signal !== '') {
    out += '  catch "' + escapeString(sc.signal) + '"\n';
  }
  out += '}\n';
  return out;
}

function dumpStartEvent(s: StartEvent): string {
  return 'start_event ' + s.id + ' {\n}\n';
}

function dumpTimerEvent(te: TimerEvent): string {
  let out: string = 'timer_event ' + te.id + ' {\n';
  if (te.type !== '') {
    out += '  type ' + te.type + '\n';
  }
  if (te.para !== '') {
    out += '  para "' + escapeString(te.para) + '"\n';
  }
  out += '}\n';
  return out;
}
