import * as CONFIG from "./config";

import { apply as applyStatic } from "./static";

import { Post } from "./typings/Post";
import dataUnty from "../../data.json";
const data = dataUnty as Post[];

/**
 * Application bootstrap
 */
type State = {
  ty: 'Vacant',
} | {
  ty: 'Home',
} | {
  ty: 'Post',
  slug: string,
} | {
  ty: 'About',
} | {
  ty: 'NotFound',
};

let state: State = { ty: 'Vacant' };

function bootstrap() {
  applyStatic();

  // TODO(ssr): Recover current state

  // Bootstrap init animation
  reflection(document.location.pathname);
}

/**
 * Animation
 */
function transition(oldState: State, newState: State) {
  // Do nothing now
}

/**
 * URL -> state reflection
 */
function parsePath(path: String): State {
  const postMatch = path.match(/^\/post\/([^\/]+)$/);
  if (path === '/')
    return { ty: 'Home' };
  else if (path === '/about')
    return { ty: 'About' };
  else if(postMatch !== null)
    return { ty: 'Post', slug: postMatch[1] };
  else
    return { ty: 'NotFound' };
}

function reflection(path: String) {
  // Commit exit animation
  const newState = parsePath(path);
  transition(state, newState);
  state = newState;
}

document.addEventListener('DOMContentLoaded', bootstrap);