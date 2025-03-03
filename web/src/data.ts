import { Post } from "./typings/Post";
import DATA_URL from "./assets/data.json?url";
import { setPosts } from "./search/wrapper";

const SSR = import.meta.env.SSR;

export async function getDataInner(): Promise<Post[]> {
  if (SSR) return (await import("./assets/data.json")).default;
  const req = await fetch(DATA_URL);
  return await req.json();
}

// Optimistically loads data
const cached = getDataInner();
export async function getData(): Promise<Post[]> {
  return await cached;
}

// set posts for search engine
cached.then((posts) => {
  setPosts(posts);
});
