import { Post } from "../typings/Post"
import { SemiReactive } from "../utils";
import { default as search, SearchResult } from "./impl";

export type Request = {
  ty: 'set-posts',
  posts: Post[],
} | {
  ty: 'search',
  kw: string,
  ident: number,
};

export type Response = {
  ty: 'search-results',
  results: SearchResult[],
  ident: number,
}

let posts = new SemiReactive<Post[]>();
async function handle(req: Request) {
  if(req.ty === 'set-posts') posts.set(req.posts);
  else if (req.ty === 'search') {
    const p = await posts.get();
    const result = search(p, req.kw);
    postMessage({ ty: 'search-results', results: result, ident: req.ident } as Response);
  }
}

onmessage = (e) => {
  handle(e.data);
}
