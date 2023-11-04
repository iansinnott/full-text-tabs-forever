export const findRanges = (str: string, query: string) => {
  const ranges: [number, number][] = [];
  const s = str.toLowerCase();
  const queries = query
    .toLowerCase()
    .split(" ")
    .map((x) => x.trim())
    .filter((x) => x.length > 2);

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

  // @ts-expect-error TS does not have this type
  return new Highlight(...rs);
};
