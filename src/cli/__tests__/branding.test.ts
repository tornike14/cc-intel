import { describe, it, expect } from 'vitest';
import { ASCII_LOGO, HELP_HEADER, HELP_FOOTER, TAGLINE, SUBTITLE } from '../branding.js';

describe('branding', () => {
  it('ASCII_LOGO fits within 80 columns', () => {
    const lines = ASCII_LOGO.split('\n');
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(80);
    }
  });

  it('ASCII_LOGO has at least 5 non-empty lines', () => {
    const nonEmpty = ASCII_LOGO.split('\n').filter((l) => l.trim().length > 0);
    expect(nonEmpty.length).toBeGreaterThanOrEqual(5);
  });

  it('HELP_HEADER includes logo and tagline', () => {
    expect(HELP_HEADER).toContain(ASCII_LOGO);
    expect(HELP_HEADER).toContain(TAGLINE);
    expect(HELP_HEADER).toContain(SUBTITLE);
  });

  it('HELP_FOOTER includes documentation link', () => {
    expect(HELP_FOOTER).toContain('https://github.com/tornike14/cc-intel');
  });
});
