import { Post } from "./typings/Post";

// TODO: regular cache invalidation
// TODO: optimistic loading
let cached: Post[] | null = null;
export async function getData(): Promise<Post[]> {
  if(cached === null) {
    const req = await fetch("/data.json");
    cached = await req.json();
  }
  return cached as Post[];
}