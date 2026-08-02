import type { Dumper, Parser, Resolver } from '../types';
import { escapeString, unwrapBlock, tokenizePackage } from '../tokenize';
import type Comment from '../../types/Comment';

/** The parsed form carries the legacy `_feedback` (the ids that
 *  respond TO this comment — the v2 direction) until the resolver
 *  inverts it into v3 `replyTo` links. */
export type ResolvableComment = Comment & { _feedback?: string[] };

/**
 * The `comment` construct (TODO.editor/14, /21) — a threaded review
 * note. The v3 form:
 *
 *   comment C1 {
 *     on P1
 *     author "operator"
 *     timestamp "2026-08-02T02:00:00Z"
 *     text "review the actor assignment"
 *     reply_to C0        (optional)
 *     resolved true      (optional, default false)
 *   }
 *
 * The legacy (MMEL v2) spellings parse into the same shape:
 *   username → author · message → text · bare `resolved` → true ·
 *   `feedback { X }` — the v2 direction (X responds TO this comment)
 *   — inverted by the resolver into X.replyTo = this id.
 */
export const parseComment: Parser = function (id, data) {
  const result: ResolvableComment = {
    id,
    on: '',
    author: '',
    timestamp: '',
    text: '',
    replyTo: null,
    resolved: false,
    _feedback: [],
  };

  if (data !== '') {
    const t: Array<string> = tokenizePackage(data);
    let i = 0;
    while (i < t.length) {
      const command: string = t[i++];
      if (command === 'on') {
        result.on = t[i++];
      } else if (command === 'author' || command === 'username') {
        result.author = unwrapBlock(t[i++]);
      } else if (command === 'timestamp') {
        result.timestamp = unwrapBlock(t[i++]);
      } else if (command === 'text' || command === 'message') {
        result.text = unwrapBlock(t[i++]);
      } else if (command === 'reply_to') {
        result.replyTo = t[i++];
      } else if (command === 'feedback') {
        // The v2 direction: these comments respond TO this one.
        result._feedback = tokenizePackage(unwrapBlock(t[i++]));
      } else if (command === 'resolved') {
        // v3: `resolved true`; legacy: the bare flag.
        if (i < t.length && (t[i] === 'true' || t[i] === 'false')) {
          result.resolved = t[i++] === 'true';
        } else {
          result.resolved = true;
        }
      } else {
        i++; // forward-compatible: skip unknown keyword value
      }
    }
  }

  return ctx => {
    ctx.comments[id] = result as never;
    return ctx;
  };
};

/** Invert the legacy feedback chains: a comment whose id appears in
 *  another's `feedback { … }` gains that host as its replyTo (unless
 *  it already declares one). Runs against ctx.comments — every
 *  comment is parsed before any resolver runs. */
export const resolveComment: Resolver<Comment, ResolvableComment> =
  function (ctx, unresolved) {
    let replyTo = unresolved.replyTo;
    if (!replyTo) {
      for (const [hostId, host] of Object.entries(ctx.comments)) {
        const feedback = (host as ResolvableComment)._feedback ?? [];
        if (feedback.includes(unresolved.id)) {
          replyTo = hostId;
          break;
        }
      }
    }
    return {
      id: unresolved.id,
      on: unresolved.on,
      author: unresolved.author,
      timestamp: unresolved.timestamp,
      text: unresolved.text,
      replyTo: replyTo ?? null,
      resolved: unresolved.resolved,
    };
  };

export const dumpComment: Dumper<Comment> = function (c) {
  let out = 'comment ' + c.id + ' {\n';
  if (c.on) {
    out += '  on ' + c.on + '\n';
  }
  out += '  author "' + escapeString(c.author) + '"\n';
  out += '  timestamp "' + escapeString(c.timestamp) + '"\n';
  out += '  text "' + escapeString(c.text) + '"\n';
  if (c.replyTo !== null) {
    out += '  reply_to ' + c.replyTo + '\n';
  }
  if (c.resolved) {
    out += '  resolved true\n';
  }
  return out + '}\n';
};
