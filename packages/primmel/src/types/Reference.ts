export default interface Reference {
  id: string;
  document: string;
  clause: string;
  /** Human-readable document title. */
  title?: string;
}
