import { apply as applyStatic } from "./static";

import { Post } from "./typings/Post";
import { wait, nextTick, getLinkInAnscenstor } from "./utils";
import { renderLine } from "./font";
import { jsx } from "./jsx";

import * as CONFIG from "./config";
import dataUnty from "../../data.json";
const data = dataUnty as Post[];

import { Temporal } from "@js-temporal/polyfill";

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
  window.addEventListener('click', e => {
    // Check if is internal URL
    let link = getLinkInAnscenstor(e.target);

    // TODO: detect unchanged
    
    if(!link) return;
    if(!link.startsWith('/')) {
      if(link.startsWith(document.location.origin))
        link = link.slice(document.location.origin.length);
      else return;
    }

    e.preventDefault();
    history.pushState(null, '', link);
    reflection(link, e.target);
  })

  window.addEventListener('popstate', () => {
    reflection(document.location.pathname);
  });
}

/**
 * Animation
 */
async function transition(oldState: State, newState: State) {
  const root = document.getElementById('root')!;
  const cn = updateClass(newState);

  if(oldState.ty === 'Vacant') {
    // Trigger startup animation
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
  updateClass(state);
}

function updateClass(state: State): string {
  const root = document.getElementById('root')!;
  if(window.scrollY === 0 && state.ty === 'Home') {
    root.classList.add('banner');
    root.classList.remove('header');
    return 'banner';
  } else {
    root.classList.add('header');
    root.classList.remove('banner');
    return 'header';
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

function reflection(path: String, activator: EventTarget | null = null) {
  // Commit exit animation
  const newState = parsePath(path);

  // TODO: Verify existence, or instead use 404

  transition(state, newState);
  state = newState;

  // Render list
  // TODO: hide list during debounce, match with transition duration
  if(state.ty === 'Home') {
    document.getElementById('list')!.classList.remove('hidden');
    renderList(data);
  } else document.getElementById('list')!.classList.add('hidden');

  // Render post
  if(state.ty === 'Post') {
    const slug = state.slug; // Workaround typechecker
    const post = data.find(p => p.metadata.id === slug)!;
    let renderedTitle: SVGSVGElement | null = null;
    if(activator !== null && activator instanceof HTMLElement && activator.parentElement?.classList.contains('entry-title')) {
      const sibling = activator.parentElement.querySelector('svg');
      if(sibling) renderedTitle = sibling as SVGSVGElement;
    }
    renderPost(post, renderedTitle);
  } else document.getElementById('post')!.classList.add('hidden');

  // TODO: cleanup to avoid scroll
}

/**
 * List rendering
 */

function renderList(posts: Post[]) {
  const list = document.getElementById('list')!;
  const titles = posts.map(p => renderEntry(p));
  list.replaceChildren(...titles);
}

function renderEntry(post: Post): HTMLElement {
  const dispTime = Temporal.Instant.from(post.metadata.update_time ?? post.metadata.publish_time);
  const dispDate = dispTime.toLocaleString(['zh-CN', 'en-US'], {
    dateStyle: 'long',
  });
  const updated = !!post.metadata.update_time;

  const [line, lineWidth] = renderLine(post.metadata.title_outline);
  return <div class="entry">
    <div class="entry-title" style={{
      '--full-width': lineWidth,
    }}>
      {line}
      <a class="entry-title-tangible" href={`/post/${post.metadata.id}`}>{post.metadata.title}</a>
    </div>
    <div class="entry-time">{dispDate}</div>
  </div>
}

/* Post rendering */
function renderPost(post: Post, renderedTitle: SVGSVGElement | null = null) {
  let title: SVGSVGElement;
  if(renderedTitle)
    title = postTitleEntry(renderedTitle);
  else {
    title = renderLine(post.metadata.title_outline)[0];
    title.classList.add('post-title');
  }

  const container = document.getElementById('post')!;
  container.appendChild(title);
}

function postTitleEntry(old: SVGSVGElement): SVGSVGElement {
  const oldLoc = old.getBoundingClientRect();
  const newTitle = old.cloneNode(true) as SVGSVGElement;
  newTitle.classList.remove('entry-title');
  newTitle.classList.add('post-title');

  // TODO: flip

  return newTitle;
}

document.addEventListener('DOMContentLoaded', bootstrap);