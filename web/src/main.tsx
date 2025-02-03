import { apply, apply as applyStatic } from "./static";

import { Post } from "./typings/Post";
import { wait, nextTick, getLinkInAnscenstor, randomWithin } from "./utils";
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

  if(oldState.ty === 'Post') {
    // Exit post
    applyPostTitleFreeAnimation(document.querySelector('.post-title') as SVGSVGElement, false);
  }
}

function scroll() {
  updateClass(state);
}

function updateClass(state: State): string {
  const root = document.getElementById('root')!;
  root.style.setProperty('--scroll', window.scrollY.toString());
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
    document.getElementById('post')!.classList.remove('hidden');
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
  const title = renderLine(post.metadata.title_outline);
  title[0].classList.add('post-title');

  title[0].style.setProperty('--full-width', title[1].toString());
  const container = document.getElementById('post')!;
  container.appendChild(title[0]);

  applyPostTitleVariation(title[0], renderedTitle);
  if(!renderedTitle) applyPostTitleFreeAnimation(title[0], true);
  renderedTitle?.style.setProperty('opacity', '0');

  const content = document.createElement('div');
  content.classList.add('post-content');
  content.innerHTML = post.html;
  content.animate([
    {
      opacity: 0,
      transform: 'translateY(5px)',
    }, {}
  ], {
    delay: 200,
    duration: 200,
    easing: 'ease-out',
    fill: 'both',
  })
  container.appendChild(<div class="post-content-wrapper">{content}</div>);
}

function applyPostTitleFreeAnimation(title: SVGSVGElement, entry: boolean) {
  const strokes = Array.from(title.querySelectorAll('g.var-group path')) as SVGPathElement[];
  let minX: number | null = null;
  strokes.forEach((stroke, i) => {
    const bbox = stroke.getBoundingClientRect();
    let dist = 0;
    if(minX === null)
      minX = bbox.x;
    else dist = Math.max(bbox.x - minX, 0);

    const offsetX = entry ? randomWithin(-1, .7): randomWithin(-0.2, 0.5);
    const offsetY = entry ? randomWithin(-1, .7): randomWithin(-0.2, 0.5);
    const scale = entry ? randomWithin(1, 1.1) : randomWithin(0.9, 1);

    const freeKeyframe = {
      transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
      opacity: 0,
    };

    const keyframes = entry ? [freeKeyframe, {}] : [{}, freeKeyframe];
    stroke.animate(keyframes, {
      delay: dist * (entry ? 1.2 : 0.5),
      duration: entry ? 500 : 200,
      easing: entry ? 'cubic-bezier(0, 0, 0, 1)' : 'cubic-bezier(1, 0, 1, 1)',
      fill: 'both',
    });
  });
}

function applyPostTitleVariation(title: SVGSVGElement, ref: SVGElement | null = null) {
  // Query location prior to applying variation

  let deltas: { dx: number, dy: number, scale: number }[] | null = null;
  const grps = Array.from(title.querySelectorAll("g.var-group") as NodeListOf<HTMLElement | SVGElement>);
  if(ref !== null) {
    const refGrps = ref?.querySelectorAll("g.var-group") as NodeListOf<HTMLElement | SVGElement>;
    deltas = grps.map((grp, i) => {
      const r = refGrps[i];

      // TODO: do not hard code scale

      // It's really hard to figure out the relative position
      // when considering overarching scaling
      // So we pre-set the target FLIP scale and then ask
      // what's the delta
      grp.style.setProperty('--var-scale', '0.5');
      const curLoc = grp.getBoundingClientRect();
      const refLoc = r.getBoundingClientRect();
      return {
        dx: refLoc.x - curLoc.x,
        dy: refLoc.y - curLoc.y,
        scale: 0.5,
      }
    });
  }

  let pastXVar = 0;

  grps.forEach((grp, i) => {
    const scale = randomWithin(0.9, 1.2);
    grp.style.setProperty('--var-scale', scale.toString());
    grp.style.setProperty('--var-offset-x', pastXVar + 'px');
    grp.style.setProperty('--var-offset-y', randomWithin(-0.1, 0.1) + 'px');

    const grpWidth = parseFloat(grp.style.getPropertyValue('--grp-approx-width'));
    const grpXdiff = parseFloat(grp.style.getPropertyValue('--grp-xdiff'));

    pastXVar += grpWidth * (scale - 1);

    if(deltas) {
      grp.animate([
        {
          transform: `
            translate(${deltas[i].dx}px, ${deltas[i].dy}px)
            scale(var(--size))
            translateX(var(--grp-xdiff))
            scale(${deltas[i].scale})
          `,
        },
        {},
      ], {
        delay: grpXdiff * 50,
        duration: 300,
        easing: 'cubic-bezier(0, 0, 0, 1)',
        fill: 'both',
      });
    }
  });
}

document.addEventListener('DOMContentLoaded', bootstrap);