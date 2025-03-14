import { Metadata } from "../typings/Metadata";
import { Post } from "../typings/Post";

export type SearchPreviewSegment =
  | ["ellipsis"]
  | ["text", number, number]
  | ["highlight", number, number];

export type SearchResult = {
  metadata: Metadata;
  plain: string;
  preview: SearchPreviewSegment[];
  score: number;
};

function findAllIndices(text: string, kw: string): number[] {
  const indices = [];
  let start = 0;
  while (true) {
    const idx = text.indexOf(kw, start);
    if (idx === -1) break;
    indices.push(idx);
    start = idx + kw.length;
  }
  return indices;
}

type Token = { start: number; end: number; score: number };

const MAX_WINDOW_WIDTH = 60;
const MAX_WINDOW_NUM = 3;
const START_END_BONUS = 1;
const SEARCH_SIDE_BEARING = 30;
const TITLE_SCORE_MULTIPLIER = 3;
type Window = {
  // [from, to)
  fromToken: number;
  toToken: number;
  score: number;
  tail: Window | null;
};

class WindowMemo {
  inner: Map<number, Window>[] = [];

  set(leftWindows: number, startToken: number, window: Window) {
    if (!this.inner[leftWindows]) this.inner[leftWindows] = new Map();
    this.inner[leftWindows].set(startToken, window);
  }

  get(leftWindows: number, startToken: number): Window | null {
    return this.inner[leftWindows]?.get(startToken) ?? null;
  }
}

type JumpTable = number[];
// JumpTable contains the index of the first token that ends after the current token starts
function genJumpTable(tokens: Token[]): JumpTable {
  let rightPtr = 0;
  return tokens.map((token, idx) => {
    while (
      rightPtr < tokens.length &&
      tokens[rightPtr].end - token.start <= MAX_WINDOW_WIDTH
    )
      rightPtr++;
    // Corner case: the search term itself is too long
    if (rightPtr === idx) rightPtr = idx + 1;
    return rightPtr;
  });
}

function findBestWindowImpl(
  tokens: Token[],
  jumptbl: JumpTable,
  leftWindows: number,
  startToken: number,
  memo: WindowMemo,
): Window | null {
  if (leftWindows === 0) return null;
  if (startToken >= tokens.length) return null;

  const memoized = memo.get(leftWindows, startToken);
  if (memoized) return memoized;

  const end = jumptbl[startToken];
  const selfScore = tokens
    .slice(startToken, end)
    .reduce((acc, token) => acc + token.score, 0);
  const next = findBestWindowImpl(
    tokens,
    jumptbl,
    leftWindows,
    startToken + 1,
    memo,
  );
  const jumped = findBestWindowImpl(
    tokens,
    jumptbl,
    leftWindows - 1,
    end,
    memo,
  );
  let bestWindow: Window;
  if (next && next.score > selfScore + (jumped?.score ?? 0)) bestWindow = next;
  else
    bestWindow = {
      fromToken: startToken,
      toToken: end,
      score: selfScore + (jumped?.score ?? 0),
      tail: jumped,
    };

  memo.set(leftWindows, startToken, bestWindow);
  return bestWindow;
}

function findBestWindow(tokens: Token[]): Window {
  if (tokens.length === 0) throw new Error("No token to find best window");
  const memo = new WindowMemo();
  const jumptbl = genJumpTable(tokens);
  console.log(tokens, jumptbl);
  return findBestWindowImpl(tokens, jumptbl, MAX_WINDOW_NUM, 0, memo)!;
}

function countOccurance(text: string, kw: string): number {
  return findAllIndices(text, kw).length;
}

export default function perform(posts: Post[], query: string): SearchResult[] {
  const kws = query
    .toLowerCase()
    .split(" ")
    .filter((k) => !!k);

  const result = posts.flatMap((post) => {
    const text = post.plain.toLowerCase();
    let titleScore = 0;

    // TODO: change to weighted windows
    // TODO: also match tag, and give very high score
    let hits: Token[] = [];
    for (const kw of kws) {
      hits = hits.concat(
        findAllIndices(text, kw).map((start) => ({
          start,
          end: start + kw.length,
          score: kw.length,
        })),
      );
      titleScore += countOccurance(post.metadata.title, kw) * TITLE_SCORE_MULTIPLIER;
    }
    // No match
    if (hits.length === 0 && titleScore === 0) return [];

    // Only title hit
    if (hits.length === 0) return [{ metadata: post.metadata, plain: post.plain, preview: [], score: titleScore }];

    // Extra bonus for front and end
    if(hits[0].start <= SEARCH_SIDE_BEARING) hits[0].score += START_END_BONUS;
    if(hits[hits.length - 1].end >= text.length - SEARCH_SIDE_BEARING) hits[hits.length - 1].score += START_END_BONUS;

    hits.sort((a, b) => a.start - b.start);
    let cur = findBestWindow(hits);

    // Serialize windows
    const regions: SearchPreviewSegment[] = [];
    while (true) {
      const region: ["text" | "highlight", number, number][] = [];
      for (let i = cur.fromToken; i < cur.toToken; i++) {
        let lastEnd: number;
        if (i == cur.fromToken)
          lastEnd = Math.max(
            hits[cur.fromToken].start - SEARCH_SIDE_BEARING,
            0,
          );
        else lastEnd = hits[i - 1].end;
        region.push(["text", lastEnd, hits[i].start]);
        region.push(["highlight", hits[i].start, hits[i].end]);
      }
      if (cur.toToken <= cur.fromToken) throw new Error("Sanity check");
      const epilogueEnd = Math.min(
        hits[cur.toToken - 1].end + SEARCH_SIDE_BEARING,
        text.length,
      );
      region.push(["text", hits[cur.toToken - 1].end, epilogueEnd]);

      // Filter out zero-length areas
      let filtered = region.filter(([_, start, end]) => start < end);
      if (filtered[0][1] > (regions[regions.length - 1]?.[2] ?? 0))
        regions.push(["ellipsis"]);
      else if(regions.length > 0) {
        let keIdx = filtered.findIndex(([type]) => type === "highlight");
        if(keIdx === -1) throw new Error('Unexpected missing keyword in search region');
        regions[regions.length - 1][2] = filtered[keIdx][1];
        filtered = filtered.slice(keIdx);
      }
      regions.push(...filtered);

      if (cur.tail === null) break;
      cur = cur.tail;
    }
    if (regions[regions.length - 1]?.[2] !== text.length)
      regions.push(["ellipsis"]);
    return [
      {
        metadata: post.metadata,
        plain: post.plain,
        preview: regions,
        score: cur.score,
      },
    ];
  });

  // Secondary key should be publish time, but since sort is stable, we can skip that key
  return result.sort((a, b) => b.score - a.score);
}
