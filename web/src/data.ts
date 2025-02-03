import { Post } from "./typings/Post";

import dataUnty from "../../data.json";
export const data = dataUnty as Post[];

export async function getData(): Promise<Post[]> {
  return data;
}