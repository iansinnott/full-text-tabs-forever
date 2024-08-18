import { describe, it, expect } from "bun:test";

import { getArticleFragments } from "./utils";

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
