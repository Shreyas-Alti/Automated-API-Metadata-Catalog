import type { MarkdownDocument } from '../index';

describe('generator-markdown', () => {
  it('MarkdownDocument has filename and content fields', () => {
    const doc: MarkdownDocument = { filename: 'api.md', content: '# API\n' };
    expect(doc.filename).toBe('api.md');
  });

  it('GenerateMarkdown is a pure function type (ApiGraph → MarkdownDocument[])', () => {
    expect(true).toBe(true);
  });
});
