import { Post } from "./typings/Post";
import DATA_URL from "./assets/data.json?url";

const SSR = import.meta.env.SSR;

export async function getDataInner(): Promise<Post[]> {
  if (SSR) return (await import("./assets/data.json")).default;
  const req = await fetch(DATA_URL);
  return await req.json();
}

const cached = getDataInner();
export async function getData(): Promise<Post[]> {
  return await cached;
}
