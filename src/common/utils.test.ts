import { describe, it, expect } from "bun:test";

import { getArticleFragments, segment, sanitizeHtmlAllowMark } from "./utils";

describe("getArticleFragments", () => {
  it("should handle longform, multi-paragraph text", () => {
    const longText = `# Introduction

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

## Section 1

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

### Subsection 1.1

Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.`;

    const fragments = getArticleFragments(longText);
    expect(fragments.length).toBeGreaterThan(1);
    expect(fragments[0]).toBe(
      "# Introduction Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat."
    );
    expect(fragments[1]).toBe(
      "## Section 1 Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."
    );
    expect(fragments[2]).toBe(
      "### Subsection 1.1 Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo."
    );
  });

  it("should handle short text below minFragmentLength", () => {
    const shortText = "This is a short text.";
    const fragments = getArticleFragments(shortText);
    expect(fragments).toHaveLength(1);
    expect(fragments[0]).toBe(shortText);
  });

  it("should handle empty input", () => {
    const fragments = getArticleFragments("");
    expect(fragments).toHaveLength(0);
  });

  it("should handle input with only headings", () => {
    const headingsOnly = `# Heading 1
## Heading 2
### Heading 3`;
    const fragments = getArticleFragments(headingsOnly);
    expect(fragments).toHaveLength(3);
    expect(fragments[0]).toBe("# Heading 1");
    expect(fragments[1]).toBe("## Heading 2");
    expect(fragments[2]).toBe("### Heading 3");
  });

  it("should handle input with very long paragraphs", () => {
    const longParagraph = "Lorem ipsum ".repeat(100);
    const fragments = getArticleFragments(longParagraph);
    expect(fragments.length).toBe(1);
    expect(fragments[0].length).toBeGreaterThan(100);
  });

  it("should respect custom minFragmentLength", () => {
    const text = `Short para 1.

Slightly longer paragraph 2.

Even longer paragraph 3 with more content.`;

    const fragments = getArticleFragments(text);
    expect(fragments[0]).toBe(
      "Short para 1. Slightly longer paragraph 2. Even longer paragraph 3 with more content."
    );
  });
});

describe("getArticleFragments with plain text", () => {
  it("should handle a single long paragraph", () => {
    const text =
      "This is a long paragraph that should be treated as a single fragment. It contains multiple sentences and goes on for a while to ensure it exceeds the minimum fragment length of 100 characters. The content is not particularly meaningful, but it serves the purpose of this test case.";
    const fragments = getArticleFragments(text);
    expect(fragments).toHaveLength(1);
    expect(fragments[0]).toBe(text);
  });

  it("should split long text into multiple fragments", () => {
    const text =
      "First paragraph that is long enough to be its own fragment. It contains multiple sentences to exceed the minimum length of 100 characters.\n\nSecond paragraph that is also long enough to be a separate fragment. It also has multiple sentences and exceeds 100 characters.\n\nThird paragraph, again long enough to be distinct and over 100 characters in length.";
    const fragments = getArticleFragments(text);
    expect(fragments).toHaveLength(3);
    expect(fragments[0]).toContain("First paragraph");
    expect(fragments[1]).toContain("Second paragraph");
    expect(fragments[2]).toContain("Third paragraph");
  });

  it("should combine short paragraphs", () => {
    const text =
      "Short para 1.\n\nAnother short one.\n\nYet another.\n\nStill short.\n\nNeed more text to reach 100 characters. This should do it, creating a single fragment.";
    const fragments = getArticleFragments(text);
    expect(fragments).toHaveLength(1);
    expect(fragments[0]).toContain("Short para 1.");
    expect(fragments[0]).toContain("Need more text to reach 100 characters.");
  });

  it("should handle text with varying paragraph lengths", () => {
    const text =
      "Short intro.\n\nThis is a much longer paragraph that should be its own fragment because it exceeds the minimum length of 100 characters. It contains multiple sentences to ensure it's long enough.\n\nAnother short paragraph.\n\nYet another long paragraph that should be separate. It also contains multiple sentences and exceeds the minimum length of 100 characters to be its own fragment.";
    const fragments = getArticleFragments(text);
    expect(fragments).toHaveLength(2);
    expect(fragments[0]).toContain("This is a much longer paragraph");
    expect(fragments[1]).toContain("Yet another long paragraph");
  });

  it("should handle text with line breaks but no paragraphs", () => {
    const text =
      "This is a text\nwith line breaks\nbut no paragraph\nbreaks. It should\nbe treated as one\nfragment. We need to add more text to ensure it exceeds 100 characters and becomes a valid fragment.";
    const fragments = getArticleFragments(text);
    expect(fragments).toHaveLength(1);
    expect(fragments[0]).toBe(
      "This is a text with line breaks but no paragraph breaks. It should be treated as one fragment. We need to add more text to ensure it exceeds 100 characters and becomes a valid fragment."
    );
  });
});

describe("segment", () => {
  it("should not affect normal English text", () => {
    const text = "This is a normal English sentence.";
    expect(segment(text)).toBe(text);
  });

  it("should handle empty string", () => {
    expect(segment("")).toBe("");
  });

  it("should handle text with numbers and punctuation", () => {
    const text = "Hello, world! This is test #123.";
    expect(segment(text)).toBe(text);
  });

  it("should segment text with non-Latin characters", () => {
    const text = "こんにちは世界";
    const segmented = segment(text);
    expect(segmented).toBe("こんにちは 世界");
  });

  it("should handle mixed Latin and non-Latin text", () => {
    const text = "Hello こんにちは world 世界";
    const segmented = segment(text);
    expect(segmented).toBe("Hello こんにちは world 世界");
  });

  it("should handle mixed Latin and Mandarin Chinese text", () => {
    const text = "Hello 你好世界我是一个人工智能助手 world 这是一个测试";
    const segmented = segment(text);
    expect(segmented).toBe("Hello 你好 世界 我是 一个 人工 智能 助手 world 这 是 一个 测试");
  });

  it("should handle chinese with punctuation", () => {
    const text =
      "你好，世界！这是一个测试句子，用于检查中文文本的分段功能。我们希望确保即使在有标点符号的情况下，文本也能正确分段。";
    const segmented = segment(text);
    expect(segmented).toBe(
      "你好 ， 世界 ！ 这 是 一个 测试 句子 ， 用于 检查 中文 文本 的 分段 功能 。 我们 希望 确保 即使 在 有 标点 符号 的 情况 下 ， 文本 也能 正确 分段 。"
    );
  });
});

describe("sanitizeHtmlAllowMark", () => {
  it("should preserve mark tags while removing all other HTML tags", () => {
    const html = '<div>Text with <mark>highlighted</mark> and <b>bold</b> and <i>italic</i> parts</div>';
    const sanitized = sanitizeHtmlAllowMark(html);
    expect(sanitized).toBe('Text with <mark>highlighted</mark> and bold and italic parts');
  });

  it("should strip attributes from mark tags", () => {
    const html = 'Text with <mark class="highlight" style="background-color: yellow;">attributes</mark>';
    const sanitized = sanitizeHtmlAllowMark(html);
    expect(sanitized).toBe('Text with <mark>attributes</mark>');
  });

  it("should handle empty input", () => {
    expect(sanitizeHtmlAllowMark("")).toBe("");
    expect(sanitizeHtmlAllowMark(null as any)).toBe("");
    expect(sanitizeHtmlAllowMark(undefined as any)).toBe("");
  });

  it("should remove script tags and their content", () => {
    const html = 'Text <script>alert("xss")</script> with scripts';
    const sanitized = sanitizeHtmlAllowMark(html);
    expect(sanitized).toBe('Text  with scripts');
  });

  it("should remove style tags and their content", () => {
    const html = 'Text <style>.dangerous { color: red; }</style> with styles';
    const sanitized = sanitizeHtmlAllowMark(html);
    expect(sanitized).toBe('Text  with styles');
  });

  it("should handle complex nested HTML while preserving mark tags", () => {
    const html = `
      <div class="container">
        <h1>Title</h1>
        <p>Paragraph with <mark>highlighted</mark> text and <span class="danger">dangerous</span> content</p>
        <script>document.write('xss');</script>
        <ul>
          <li>Item 1 with <mark>highlight</mark></li>
          <li>Item 2</li>
        </ul>
      </div>
    `;
    const sanitized = sanitizeHtmlAllowMark(html);
    expect(sanitized).toContain('<mark>highlighted</mark>');
    expect(sanitized).toContain('<mark>highlight</mark>');
    expect(sanitized).not.toContain('<div');
    expect(sanitized).not.toContain('<h1>');
    expect(sanitized).not.toContain('<p>');
    expect(sanitized).not.toContain('<script>');
    expect(sanitized).not.toContain('<span>');
    expect(sanitized).not.toContain('class=');
  });

  it("should normalize mark tag case", () => {
    const html = 'Text with <MARK>uppercase</MARK> and <Mark>mixed case</mArk> tags';
    const sanitized = sanitizeHtmlAllowMark(html);
    expect(sanitized).toBe('Text with <mark>uppercase</mark> and <mark>mixed case</mark> tags');
  });
});
