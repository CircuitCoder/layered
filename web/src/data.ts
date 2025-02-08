import { Post } from "./typings/Post";

const SSR = import.meta.env.SSR;

// TODO: regular cache invalidation
// TODO: optimistic loading
export async function getDataInner(): Promise<Post[]> {
  // @ts-ignore
  if(SSR) {
    const fs = await import('node:fs/promises');
    return JSON.parse((await fs.readFile('./dist/client/data.json')).toString('utf-8')) as Post[];
  }

  const req = await fetch("/data.json");
  return await req.json();
}

const cached = getDataInner();
export async function getData(): Promise<Post[]> {
  return await cached;
}