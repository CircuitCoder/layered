import * as CONFIG from "./config";

import { apply as applyStatic } from "./static";

import { Post } from "./typings/Post";
import dataUnty from "../../data.json";
import { wait, nextTick } from "./utils";
import { renderLine } from "./font";
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
  ty: 'Tag',
  tag: string,
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

  // TODO(routing): register popstate event

  window.addEventListener('scroll', scroll);
}

/**
 * Animation
 */
async function transition(oldState: State, newState: State) {
  if(oldState.ty === 'Vacant') {
    // Trigger startup animation
    const cn = newState.ty === 'Home' ? 'banner' : 'header';
    const root = document.getElementById('root')!;
    root.classList.add(`initial`);
    root.classList.add(`${cn}-trigger`);
    root.classList.add(`${cn}`);
    root.style.display = '';
    root.getBoundingClientRect(); // Force re-render
    await nextTick();
    root.classList.remove(`${cn}-trigger`);
    await wait(1100);
    root.classList.remove(`initial`);
  }
}

function scroll() {
  const root = document.getElementById('root')!;
  if(window.scrollY <= 20 && state.ty === 'Home') {
    root.classList.add('banner');
    root.classList.remove('header');
  } else {
    root.classList.add('header');
    root.classList.remove('banner');
  }
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

  if(state.ty === 'Home')
    renderList(data);
}

/**
 * List rendering
 */

function renderList(posts: Post[]) {
  const list = document.getElementById('list')!;
  const titles = posts.map(p => renderLine(p.metadata.title_outline));
  list.replaceChildren(...titles);
}

document.addEventListener('DOMContentLoaded', bootstrap);