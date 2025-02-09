import { Post } from "./typings/Post";
import DATA_URL from "./data.json?url";

const SSR = import.meta.env.SSR;

// TODO: regular cache invalidation
// TODO: optimistic loading
export async function getDataInner(): Promise<Post[]> {
  if(SSR) return (await import('./data.json')).default;
  const req = await fetch(DATA_URL);
  return await req.json();
}

const cached = getDataInner();
export async function getData(): Promise<Post[]> {
  return await cached;
}