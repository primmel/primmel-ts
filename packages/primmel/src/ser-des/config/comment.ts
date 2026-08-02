import type { Dumper, Parser } from '../types';
import { escapeString, unwrapBlock, tokenizePackage } from '../tokenize';
import type Comment from '../../types/Comment';

/**
 * The `comment` construct (TODO.editor/14) — a threaded review note:
 *
 *   comment C1 {
 *     on P1
 *     author "operator"
 *     timestamp "2026-08-02T02:00:00Z"
 *     text "review the actor assignment"
 *     reply_to C0        (optional)
 *     resolved true      (optional, default false)
 *   }
 */
export const parseComment: Parser = function (id, data) {
  const result: Comment = {
    id,
    on: '',
    author: '',
    timestamp: '',
    text: '',
    replyTo: null,
    resolved: false,
  };

  if (data !== '') {
    const t: Array<string> = tokenizePackage(data);
    let i = 0;
    while (i < t.length) {
      const command: string = t[i++];
      if (i < t.length) {
        if (command === 'on') {
          result.on = t[i++];
        } else if (command === 'author') {
          result.author = unwrapBlock(t[i++]);
        } else if (command === 'timestamp') {
          result.timestamp = unwrapBlock(t[i++]);
        } else if (command === 'text') {
          result.text = unwrapBlock(t[i++]);
        } else if (command === 'reply_to') {
          result.replyTo = t[i++];
        } else if (command === 'resolved') {
          result.resolved = t[i++] === 'true';
        } else {
          i++; // forward-compatible: skip unknown keyword value
        }
      } else {
        throw new Error(
          `Parsing error: comment. ID ${id}: Expecting value for ${command}`,
        );
      }
    }
  }

  return ctx => {
    ctx.comments[id] = result;
    return ctx;
  };
};

export const dumpComment: Dumper<Comment> = function (c) {
  let out = 'comment ' + c.id + ' {\n';
  out += '  on ' + c.on + '\n';
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
