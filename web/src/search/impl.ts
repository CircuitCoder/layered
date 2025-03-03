import { Metadata } from "../typings/Metadata";
import { Post } from "../typings/Post";

export type SearchPreviewSegment = ['ellipsis'] | ['text', number, number] | ['highlight', number, number];

export type SearchResult = {
  metadata: Metadata,
  preview: SearchPreviewSegment[],
  score: number,
}

function findAllIndices(text: string, kw: string): number[] {
  const indices = [];
  let start = 0;
  while(true) {
    const idx = text.indexOf(kw, start);
    if(idx === -1) break;
    indices.push(idx);
    start = idx + text.length;
  }
  return indices;
}

type Token = { start: number, end: number, score: number };

const MAX_WINDOW_WIDTH = 60;
const MAX_WINDOW_NUM = 3;
const START_END_BONUS = 1;
const SEARCH_SIDE_BEARING = 3;
type Window = {
  // [from, to)
  fromToken: number,
  toToken: number,
  score: number,
  tail: Window | null,
}

class WindowMemo {
  inner: Map<number, Window>[] = [];

  set(leftWindows: number, startToken: number, window: Window) {
    if(!this.inner[leftWindows]) this.inner[leftWindows] = new Map();
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
    while(rightPtr < tokens.length && tokens[rightPtr].end - token.start <= MAX_WINDOW_WIDTH) rightPtr++;
    // Corner case: the search term itself is too long
    if(rightPtr === idx) rightPtr = idx + 1;
    return rightPtr;
  });
}

function findBestWindowImpl(tokens: Token[], jumptbl: JumpTable, leftWindows: number, startToken: number, memo: WindowMemo): Window | null {
  if (leftWindows === 0) return null;
  if (startToken >= tokens.length) return null;

  const memoized = memo.get(leftWindows, startToken);
  if (memoized) return memoized;

  const end = jumptbl[startToken];
  const selfScore = tokens.slice(startToken, end).reduce((acc, token) => acc + token.score, 0);
  const next = findBestWindowImpl(tokens, jumptbl, leftWindows, startToken + 1, memo);
  const jumped = findBestWindowImpl(tokens, jumptbl, leftWindows - 1, end, memo);
  let bestWindow: Window;
  if(next && next.score > selfScore + (jumped?.score ?? 0)) bestWindow = next;
  else bestWindow = { fromToken: startToken, toToken: end, score: selfScore + (jumped?.score ?? 0), tail: jumped };

  memo.set(leftWindows, startToken, bestWindow);
  return bestWindow;
}

function findBestWindow(tokens: Token[]): Window {
  if (tokens.length === 0) throw new Error("No token to find best window");
  const memo = new WindowMemo();
  const jumptbl = genJumpTable(tokens);
  return findBestWindowImpl(tokens, jumptbl, MAX_WINDOW_NUM, 0, memo)!;
}

export default function perform(posts: Post[], query: string): SearchResult[] {
  const kws = query.toLowerCase().split(' ').filter(k => !!k);

  return posts.flatMap((post) => {
    const text = post.plain.toLowerCase();

    // TODO: change to weighted windows
    // TODO: also match tag, and give very high score
    let hits: Token[] = [
      // Implicit start & end token
      { start: 0, end: 0, score: START_END_BONUS },
      { start: text.length, end: text.length, score: START_END_BONUS },
    ];
    for(const kw of kws)
      hits = hits.concat(findAllIndices(text, kw).map(start => ({ start, end: start + kw.length, score: kw.length })));
    // No match, only implicit tokens
    if(hits.length === 2) return [];

    hits.sort((a, b) => a.start - b.start);
    let cur = findBestWindow(hits);

    // Serialize windows
    const regions: SearchPreviewSegment[] = [];
    while(true) {
      const region: ['text' | 'highlight', number, number][] = [];
      for(let i = cur.fromToken; i < cur.toToken; i++) {
        let lastEnd: number;
        if(i == cur.fromToken)
          lastEnd = Math.max(hits[cur.fromToken].start - SEARCH_SIDE_BEARING, 0);
        else lastEnd = hits[i - 1].end;
        region.push(['text', lastEnd, hits[i].start]);
        region.push(['highlight', hits[i].start, hits[i].end]);
      }
      const epilogueEnd = Math.min(hits[cur.toToken].end + SEARCH_SIDE_BEARING, text.length);
      region.push(['text', hits[cur.toToken].end, epilogueEnd]);
      // Filter out zero-length areas
      const filtered = region.filter(([_, start, end]) => start < end);
      if(filtered[0][1] > (regions[regions.length - 1]?.[2] ?? 0)) regions.push(['ellipsis']);
      regions.push(...filtered);

      if(cur.tail === null) break;
      cur = cur.tail;
    }
    if(regions[regions.length - 1]?.[2] !== text.length) regions.push(['ellipsis']);
    return [{
      metadata: post.metadata,
      preview: regions,
      score: cur.score,
    }];
  });
}
