/**
 * A review comment (TODO.editor/14) — a threaded authoring note on any
 * element: text, author, timestamp, the parent element (`on`), an
 * optional parent comment (`replyTo`), and the resolved flag.
 *
 * Comments are authoring scratch — review coordination while the model
 * is being built — never certification evidence. The audit posture is
 * that they carry provenance (author + timestamp) and delete really
 * deletes.
 */
export default interface Comment {
  id: string;
  /** The element the thread hangs on (any model element id). */
  on: string;
  author: string;
  /** ISO-8601 timestamp. */
  timestamp: string;
  text: string;
  /** The parent comment for a reply (null = thread root). */
  replyTo: string | null;
  resolved: boolean;
}
