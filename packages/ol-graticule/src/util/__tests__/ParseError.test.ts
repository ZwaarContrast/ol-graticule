import { describe, it, expect } from 'vitest';
import { ParseError } from '../ParseError.js';

describe('ParseError', () => {
  it('is an Error subclass', () => {
    const err = new ParseError('foo', 'bad');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ParseError);
  });

  it('exposes text and reason fields', () => {
    const err = new ParseError('input', 'because');
    expect(err.text).toBe('input');
    expect(err.reason).toBe('because');
  });

  it('formats message with reason and JSON-encoded input', () => {
    const err = new ParseError('a"b', 'reason');
    expect(err.message).toBe('ParseError: reason (input: "a\\"b")');
  });

  it('sets name to "ParseError"', () => {
    expect(new ParseError('x', 'y').name).toBe('ParseError');
  });

  it('can be caught with instanceof from a re-thrown error', () => {
    try {
      throw new ParseError('boom', 'kaboom');
    } catch (e) {
      expect(e).toBeInstanceOf(ParseError);
      if (e instanceof ParseError) {
        expect(e.text).toBe('boom');
      }
    }
  });
});
