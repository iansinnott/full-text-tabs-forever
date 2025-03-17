import { MIN_QUERY_LENGTH } from "./constants";

export const findRanges = (str: string, query: string) => {
  const ranges: [number, number][] = [];
  const s = str.toLowerCase();
  const queries = query
    .toLowerCase()
    .split(" ")
    .map((x) => x.trim())
    .filter((x) => x.length >= MIN_QUERY_LENGTH);

  for (const q of queries) {
    let i = 0;
    while (i < s.length) {
      const idx = s.indexOf(q, i);
      if (idx === -1) {
        break;
      }
      ranges.push([idx, idx + q.length]);
      i = idx + q.length;
    }
  }
  return ranges;
};

/**
 * Highlight functionality is not used as of this commit. It was used when
 * sqlite fts wasn't available to provide highlighting via the SNIPPET function.
 * Since then we've moved to pg fts and can use the pg_headline function,
 * however it still maybe useful to have highlighting for other functionality.
 */
export const makeHighlights = (nodes: Node[], query: string) => {
  const rs: Range[] = [];
  for (const node of nodes) {
    if (node.nodeType !== Node.TEXT_NODE) {
      console.warn("Tried to highlight non-text node", node);
      continue;
    }

    const text = node.textContent || "";
    const xs = findRanges(text, query);
    for (const [qstart, qend] of xs) {
      const r = new Range();
      r.setStart(node, qstart);
      r.setEnd(node, qend);
      rs.push(r);
    }
  }

  return new Highlight(...rs);
};

export const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (typeof e.target?.result === "string") {
        resolve(e.target.result);
      } else {
        reject(new Error("Failed to read file as text"));
      }
    };
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
};

export const pickFile = (accept?: string): Promise<File> => {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    if (accept) input.accept = accept;
    input.style.display = "none";
    document.body.appendChild(input);

    input.onchange = (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (file) {
        resolve(file);
      } else {
        reject(new Error("No file selected"));
      }
      document.body.removeChild(input);
    };

    input.click();
  });
};
