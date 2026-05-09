/** Thrown by `LabelFormatter.parse*` and `GridSystem.parseCoordinate` when input is unparseable. */
export class ParseError extends Error {
  readonly text: string;
  readonly reason: string;

  constructor(text: string, reason: string) {
    super(`ParseError: ${reason} (input: ${JSON.stringify(text)})`);
    this.name = 'ParseError';
    this.text = text;
    this.reason = reason;
  }
}
