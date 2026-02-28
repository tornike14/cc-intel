import { describe, it, expect } from 'vitest';
import { encodeProjectPath } from '../session-discovery.js';

describe('encodeProjectPath', () => {
  it('encodes Unix absolute path', () => {
    expect(encodeProjectPath('/Users/foo/myproject')).toBe('-Users-foo-myproject');
  });

  it('encodes macOS path with leading slash', () => {
    expect(encodeProjectPath('/Users/nizhara/Desktop/cc-intel')).toBe(
      '-Users-nizhara-Desktop-cc-intel',
    );
  });

  it('encodes Linux home path', () => {
    expect(encodeProjectPath('/home/olduser/project-a')).toBe('-home-olduser-project-a');
  });

  it('encodes Windows path with drive letter', () => {
    expect(encodeProjectPath('C:\\Users\\foo\\myproject')).toBe('C--Users-foo-myproject');
  });

  it('encodes Windows path with different drive letter', () => {
    expect(encodeProjectPath('D:\\git\\MyRepo')).toBe('D--git-MyRepo');
  });

  it('handles Windows drive root', () => {
    expect(encodeProjectPath('Z:\\')).toBe('Z--');
  });

  it('handles forward slashes on Windows-style paths', () => {
    // git rev-parse on Windows may return forward slashes
    expect(encodeProjectPath('C:/Users/foo/myproject')).toBe('C--Users-foo-myproject');
  });
});
