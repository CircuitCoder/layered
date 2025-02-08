import { Post } from "./typings/Post";

const SSR = import.meta.env.SSR;

// TODO: regular cache invalidation
// TODO: optimistic loading
let cached: Post[] | null = null;
export async function getData(): Promise<Post[]> {
  // @ts-ignore
  if(SSR) {
    const fs = await import('node:fs/promises');
    return JSON.parse((await fs.readFile('./dist/client/data.json')).toString('utf-8')) as Post[];
  }

  if(cached === null) {
    const req = await fetch("/data.json");
    cached = await req.json();
  }
  return cached as Post[];
}