import { Post } from "../typings/Post";
import { SemiReactive } from "../utils";
import { default as impl, SearchResult } from "./impl";
import { Request, Response } from "./worker";

const posts = new SemiReactive<Post[]>();
const useWorker = typeof Worker !== 'undefined';
const worker = useWorker ? new Worker(new URL('./worker.ts', import.meta.url), {
  type: "module",
}) : null;

export function setPosts(p: Post[]) {
  if(worker) worker.postMessage({ ty: 'set-posts', posts: p } as Request);
  else posts.set(p);
}

let ticket = 0;
const searchContinuations = new Map<number, (results: SearchResult[]) => void>();
export async function search(query: string): Promise<SearchResult[]> {
  if(worker) return new Promise((resolve) => {
    const ident = ticket++;
    searchContinuations.set(ident, resolve);
    worker.postMessage({ ty: 'search', kw: query, ident } as Request);
  });
  else return impl(await posts.get(), query);
}

if(worker) worker.addEventListener('message', (e) => {
  const res = e.data as Response;
  if(res.ty === 'search-results') {
    const cont = searchContinuations.get(res.ident);
    if(cont) {
      cont(res.results);
      searchContinuations.delete(res.ident);
    }
  }
});
