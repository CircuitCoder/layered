import { apply as applyStatic } from "./static";

import { Post as PostData } from "./typings/Post";
import { getData } from "./data";
import { wait, nextTick, getLinkInAnscenstor, randomWithin } from "./utils";
import { renderLine } from "./font";
import { jsx } from "./jsx";
import * as Icons from "./icons";

import * as CONFIG from "./config";

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

interface RenderedEntity {
  element: HTMLElement,
  exit(): Promise<void>,
}

let state: State = { ty: 'Vacant' };
let rendered: RenderedEntity | null = null;

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
async function startup(cn: string) {
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

function scroll() {
  updateBannerClass(state);
}

function updateBannerClass(state: State): string {
  const root = document.getElementById('root')!;
  root.style.setProperty('--scroll', window.scrollY.toString());
  const targetClass = window.scrollY === 0 && state.ty === 'Home' ? 'banner' : 'header';
  if(root.classList.contains(targetClass)) return targetClass;

  // Also remove initial. All banner state changes during initial immediately halts the startup animation
  root.classList.remove('banner', 'header', 'initial');
  root.classList.add(targetClass);
  return targetClass;
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

async function reflection(path: String, activator: EventTarget | null = null) {
  // Commit exit animation
  const newState = parsePath(path);
  const oldState = state;

  state = newState;

  // TODO: Verify existence, or instead use 404

  // TODO: delay startup animiation class detection after content is rendered, s.t. scroll is correctly reflected
  // Or give a min-height 101vh during startup to see if the stored scroll is not a top
  const cn = updateBannerClass(newState);
  if(oldState.ty === 'Vacant') startup(cn);

  if(rendered !== null) {
    rendered.exit();
    rendered = null;
  }

  window.scrollTo(0, 0);

  // All transitions require fetching all data, so we wait on that
  const data = await getData();

  // Render list
  // TODO: hide list during debounce, match with transition duration
  if(state.ty === 'Home')
    rendered = new List(data, cn === 'banner' && oldState.ty === 'Vacant');

  // Render post
  if(state.ty === 'Post') {
    const slug = state.slug; // Workaround typechecker
    const post = data.find(p => p.metadata.id === slug)!;
    let renderedTitle: SVGSVGElement | null = null;
    if(activator !== null && activator instanceof HTMLElement && activator.parentElement?.classList.contains('entry-title')) {
      const sibling = activator.parentElement.querySelector('svg');
      if(sibling) renderedTitle = sibling as SVGSVGElement;
    }
    rendered = new Post(post, renderedTitle);
  }
}

function freezeScroll(el: HTMLElement) {
  const scrollY = window.scrollY;
  el.style.setProperty('position', 'fixed');
  el.style.setProperty('top', `-${scrollY}px`);
  // Override --scroll variable
  el.style.setProperty('--scroll', `${scrollY}`);
}

/**
 * List rendering
 */
class List implements RenderedEntity {
  element: HTMLElement;

  constructor(posts: PostData[], initialHome: boolean) {
    const entries = posts.map(p => List.renderEntry(p));
    const list = <div class="list">{...entries}</div>
    this.element = list;

    document.getElementById('root')!.appendChild(list);

    list.animate([{
      transform: 'translateY(-20px)',
      opacity: 0,
    }, {}], {
      delay: initialHome ? 700 : 200,
      duration: 200,
      easing: 'ease-out',
      fill: 'backwards',
    });
  }

  private static renderEntry(post: PostData): HTMLElement {
    const dispTime = Temporal.Instant.from(post.metadata.update_time ?? post.metadata.publish_time);
    const dispDate = dispTime.toLocaleString(['zh-CN', 'en-US'], {
      dateStyle: 'long',
    });
    const updated = !!post.metadata.update_time && post.metadata.update_time !== post.metadata.publish_time;

    const [line, lineWidth] = renderLine(post.metadata.title_outline);
    return <div class="entry">
      <div class="entry-title" style={{
        '--full-width': lineWidth,
      }}>
        {line}
        <a class="entry-title-tangible" href={`/post/${post.metadata.id}`}>{post.metadata.title}</a>
      </div>
      <div class="entry-time">{ dispDate }{ updated && Icons.Edit.cloneNode(true) }</div>
    </div>
  }

  async exit() {
    const el = this.element;
    freezeScroll(el);
    return el.animate([{}, {
      transform: 'translateY(20px)',
      opacity: 0,
    }], {
      duration: 200,
      easing: 'ease-in',
      fill: 'backwards',
    }).finished.then(() => el.remove());
  }
}

/* Post rendering */
class Post implements RenderedEntity {
  element: HTMLElement;

  constructor(post: PostData, renderedTitle: SVGSVGElement | null) {
    const [title, titleWidth] = renderLine(post.metadata.title_outline);
    title.classList.add('post-title');
    title.style.setProperty('--full-width', titleWidth.toString());

    renderedTitle?.style.setProperty('opacity', '0');

    const content = document.createElement('div');
    content.classList.add('post-content');
    content.innerHTML = post.html;

    this.element = <div class="post">
      {title}
      <div class="post-content-wrapper">{content}</div>
    </div>;

    document.getElementById('root')!.appendChild(this.element);

    Post.applyTitleVariation(title, renderedTitle);
    if(!renderedTitle) Post.applyTitleFreeAnimation(title, true);
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
  }

  async exit() {
    const el = this.element;
    freezeScroll(el);
    const title = el.querySelector('.post-title') as SVGSVGElement;
    const titleRemoved = Post.applyTitleFreeAnimation(title, false);
    const content = el.querySelector('.post-content') as HTMLElement;
    const contentRemoved = content.animate([
      {},
      {
        opacity: 0,
        transform: 'translateY(5px)',
      }
    ], {
      duration: 200,
      easing: 'ease-in',
      fill: 'both',
    });

    await Promise.all([titleRemoved, contentRemoved]);
    el.remove();
  }

  private static applyTitleVariation(title: SVGSVGElement, ref: SVGElement | null = null) {
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

        // Also, temporarily override scroll
        grp.style.setProperty('--var-scale', '0.5');
        grp.style.setProperty('--scroll', '0');
        const curLoc = grp.getBoundingClientRect();
        const refLoc = r.getBoundingClientRect();
        grp.style.removeProperty('--scroll');
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
          delay: i * 50,
          duration: 200,
          easing: 'cubic-bezier(0, 0, 0, 1)',
          fill: 'both',
        });
      }
    });
  }

  private static async applyTitleFreeAnimation(title: SVGSVGElement, entry: boolean) {
    const strokes = Array.from(title.querySelectorAll('g.var-group path')) as SVGPathElement[];
    let minX: number | null = null;
    const promises = strokes.map((stroke, _i) => {
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
      return stroke.animate(keyframes, {
        delay: dist * (entry ? 1.2 : 0.5),
        duration: entry ? 500 : 200,
        easing: entry ? 'cubic-bezier(0, 0, 0, 1)' : 'cubic-bezier(1, 0, 1, 1)',
        fill: 'both',
      }).finished;
    });

    await Promise.all(promises);
  }
}

document.addEventListener('DOMContentLoaded', bootstrap);