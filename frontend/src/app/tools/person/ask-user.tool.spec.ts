import { describe, expect, it } from 'vitest';
import { checkAskUser } from './ask-user.tool';

describe('checkAskUser (TOOL-025)', () => {
  it('refuses a question of 200 characters', () => {
    expect(checkAskUser({ question: 'x'.repeat(200), answers: ['A', 'B'] })).toEqual({
      valid: false,
      message: 'The question must be 1 to 140 characters.',
    });
  });

  it('refuses fewer than 2 or more than 6 answers', () => {
    expect(checkAskUser({ question: 'Q?', answers: ['A'] }).valid).toBe(false);
    expect(
      checkAskUser({ question: 'Q?', answers: ['1', '2', '3', '4', '5', '6', '7'] }).valid,
    ).toBe(false);
  });

  it('refuses an answer longer than 40 characters', () => {
    expect(checkAskUser({ question: 'Q?', answers: ['A', 'b'.repeat(41)] }).valid).toBe(false);
  });

  it('adds "Don’t know" when it is not among the answers', () => {
    expect(checkAskUser({ question: 'Q?', answers: ['A', 'B'] })).toEqual({
      valid: true,
      answers: ['A', 'B', 'Don’t know'],
    });
  });

  it('keeps "Don’t know" once when it is already there', () => {
    expect(checkAskUser({ question: 'Q?', answers: ['A', 'Don’t know'] })).toEqual({
      valid: true,
      answers: ['A', 'Don’t know'],
    });
  });
});
