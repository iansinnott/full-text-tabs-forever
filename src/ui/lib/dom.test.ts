import { expect, test } from "bun:test";
import { findRanges } from "./dom";

test("findRanges", () => {
  const testCases = [
    { input: "hello world", search: "hello", expected: [[0, 5]] },
    { input: "hey there you", search: "you", expected: [[10, 13]] },
    { input: "hey there you", search: "there", expected: [[4, 9]] },
    {
      input: "recently trying sqlite in the browser using a vfs",
      search: "sqlite",
      expected: [[16, 22]],
    },
    {
      input: "recently trying sqlite in the browser using a vfs",
      search: "browser",
      expected: [[30, 37]],
    },
    {
      input: "recently trying sqlite in the browser using a vfs",
      search: "sqlite browser",
      expected: [
        [16, 22],
        [30, 37],
      ],
    },
  ];

  for (const { input, search, expected } of testCases) {
    const ranges = findRanges(input, search);
    console.log("input", JSON.stringify(input), "ranges", ranges);
    expect(ranges).toEqual(expected as [number, number][]);
  }
});
