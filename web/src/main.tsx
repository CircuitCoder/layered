import { apply as applyStatic } from "./static";

import { Post as PostData } from "./typings/Post";
import { getData } from "./data";
import { wait, nextTick, getLinkInAnscenstor, randomWithin } from "./utils";
import { relayoutLine, renderLine } from "./font";
import { jsx } from "./jsx";
import * as Icons from "./icons";

import { Temporal } from "@js-temporal/polyfill";
import 'giscus';

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
type Locale = 'zh-CN' | 'en-US';

let preferredLocale: Locale = 'zh-CN'; // TODO: parse from URL
let onTop = true;

function bootstrap() {
  applyStatic();

  // TODO(ssr): Recover current state

  // Bootstrap init animation
  reflection(document.location.pathname);

  // Listen on scroll sentinel
  const sentinel = document.getElementById('scroll-sentinel')!;
  const observer = new IntersectionObserver(ents => {
    onTop = ents[0].isIntersecting;
    updateBannerClass();
  });
  observer.observe(sentinel);

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
  const root = document.getElementById('root')!;
  root.style.setProperty('--scroll', window.scrollY.toString());
}

function updateBannerClass(given?: State): string {
  const used = given ?? state;
  const root = document.getElementById('root')!;
  const targetClass = onTop && used.ty === 'Home' ? 'banner' : 'header';
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
    const slug = decodeURIComponent(state.slug); // decode, also workaround typechecker
    const post = data.find(p => p.metadata.id === slug)!;
    let renderedTitle: SVGSVGElement | null = null;
    if(activator !== null && activator instanceof HTMLElement && activator.parentElement?.classList.contains('entry-title')) {
      const sibling = activator.parentElement.querySelector('svg');
      if(sibling) renderedTitle = sibling as SVGSVGElement;
    }
    rendered = new Post(post, renderedTitle);
  }

  // TODO: title
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
    const dispTime = Temporal.Instant.from(post.metadata.publish_time);
    const dispDate = dispTime.toLocaleString(preferredLocale, {
      dateStyle: 'medium',
    });
    const updated = !!post.metadata.update_time && post.metadata.update_time !== post.metadata.publish_time;

    const line = renderLine(post.metadata.title_outline);

    // Get available space
    const viewportWidth = window.innerWidth;
    let titleWidth: number;
    if(viewportWidth > 500) titleWidth = Math.max(viewportWidth - 120, 400);
    else titleWidth = viewportWidth - 80;

    relayoutLine(line, titleWidth / 24); // TODO: don't hard-code

    return <div class="entry">
      <div class="entry-title" style={{
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
  observer: IntersectionObserver;

  constructor(post: PostData, renderedTitle: SVGSVGElement | null) {
    const title = renderLine(post.metadata.title_outline);

    // Get available space
    const viewportWidth = window.innerWidth;
    let titleWidth: number;
    if(viewportWidth > 800) titleWidth = Math.min(viewportWidth - 300, 900);
    else if(viewportWidth > 500) titleWidth = viewportWidth - 120;
    else titleWidth = viewportWidth - 80;

    const titleLayout = relayoutLine(title, titleWidth / 48, true);
    title.classList.add('post-title');
    // title.style.setProperty('--full-width', titleWidth.toString());

    renderedTitle?.style.setProperty('opacity', '0');

    const content = document.createElement('div');
    content.classList.add('post-content');
    content.innerHTML = post.html;

    const publishTime = Temporal.Instant.from(post.metadata.publish_time);
    const publishTimeStr = publishTime.toLocaleString(preferredLocale, {
      dateStyle: 'short',
      timeStyle: 'short',
    });

    let updatedTimeStr: string | null = null;
    if(post.metadata.update_time && post.metadata.update_time !== post.metadata.publish_time) {
      const updatedTime = Temporal.Instant.from(post.metadata.update_time);
      updatedTimeStr = updatedTime.toLocaleString(preferredLocale, {
        dateStyle: 'short',
        timeStyle: 'short',
      });
    }

    function genMetadata(cn: string, additional: Element[]): Element {
      return (
        <div class={cn}>
          {...additional}
          <div class="post-metadata-line post-metadata-published">
            { Icons.Event.cloneNode(true) }
            { publishTimeStr }
          </div>
          {
            updatedTimeStr && <div class="post-metadata-line post-metadata-updated">
              { Icons.EventEdit.cloneNode(true) }
              { updatedTimeStr }
            </div>
          }
          <div class="post-metadata-line post-metadata-tags">
            { Icons.Tag.cloneNode(true) }
            { post.metadata.tags.map(tag => <a href={`/tag/${tag}`} class="post-metadata-tag">
              {tag}
            </a>) }
          </div>
        </div>
      );
    };

    const metadata = genMetadata('post-metadata', []);
    const auxTitle = renderLine(post.metadata.title_outline);

    // Get available space
    let auxTitleWidth: number;
    if(viewportWidth > 800) auxTitleWidth = 160;
    else auxTitleWidth = viewportWidth - 260;

    relayoutLine(auxTitle, auxTitleWidth/ 16); // TODO: don't hard-code

    const auxMetadata = genMetadata('post-metadata-aux', [
      auxTitle
    ]);

    const darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const discusTheme = darkMode ? 'dark_dimmed' : 'light';

    const contentWrapper = 
      <div class="post-content-wrapper">
        {metadata}
        {content}
        <div class="post-comments">
          <giscus-widget
              repo="CircuitCoder/layered"
              repoid="R_kgDOGW5ewA"
              category="Comments"
              categoryid="DIC_kwDOGW5ewM4Cmogr"
              mapping="specific"
              term={post.metadata.title}
              strict="1"
              reactionsenabled="1"
              emitmetadata="1"
              inputposition="top"
              theme={discusTheme} // TODO: change me when introducing dark mode override
              lang={preferredLocale}
              loading="lazy"
          ></giscus-widget>
        </div>
      </div>;

    this.element = <div class="post">
      {title}
      {auxMetadata}
      {contentWrapper}
    </div>;

    this.element.style.setProperty('--title-line-cnt', titleLayout.lineCnt.toString());
    document.getElementById('root')!.appendChild(this.element);

    Post.applyTitleVariation(title, renderedTitle);
    if(!renderedTitle) Post.applyTitleFreeAnimation(title, true);
    contentWrapper.animate([
      {
        opacity: 0,
        transform: 'translateY(-10px)',
      }, {}
    ], {
      delay: 200,
      duration: 200,
      easing: 'ease-out',
      fill: 'both',
    })

    this.observer = new IntersectionObserver(ents => {
      for(const ent of ents) {
        if(ent.isIntersecting)
          this.element.classList.remove('post-docked');
        else 
          this.element.classList.add('post-docked');
      }
    });
    this.observer.observe(metadata);

    // TODO: giscus backlink
    // TODO: opengraph
  }

  async exit() {
    const el = this.element;
    el.classList.add('post-exiting');
    freezeScroll(el);
    const title = el.querySelector('.post-title') as SVGSVGElement;
    const titleRemoved = Post.applyTitleFreeAnimation(title, false);
    const content = el.querySelector('.post-content-wrapper') as HTMLElement;
    const contentRemoved = content.animate([
      {},
      {
        opacity: 0,
        transform: 'translateY(10px)',
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
    let lastLine = 0;

    const uncommittedX = new Map<HTMLElement | SVGElement, number>();
    function commit(delta: number) {
      for(const [grp, x] of uncommittedX)
        grp.style.setProperty('--var-offset-x', (x + delta).toString() + 'px');
      uncommittedX.clear();
    }

    for(const grp of grps) {
      const curLine = parseInt(grp.style.getPropertyValue('--grp-line'));
      if(curLine !== lastLine) {
        commit(-pastXVar / 2);
        pastXVar = 0;
        lastLine = curLine;
      }

      const scale = randomWithin(0.9, 1.2);
      grp.style.setProperty('--var-scale', scale.toString());
      grp.style.setProperty('--var-offset-y', randomWithin(-0.1, 0.1) + 'px');
      uncommittedX.set(grp, pastXVar);

      const grpWidth = parseFloat(grp.style.getPropertyValue('--grp-approx-width'));

      pastXVar += grpWidth * (scale - 1);
    };
    commit(-pastXVar / 2);

    if(deltas) {
      grps.forEach((grp, i) => {
        grp.animate([
          {
            transform: `
              translate(${deltas[i].dx}px, ${deltas[i].dy}px)
              translateY(calc(var(--grp-line)* var(--line-height) + var(--baseline-y)))
              scale(var(--size))
              translateX(var(--grp-line-xdiff, var(--grp-xdiff)))
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
      });
    }
  }

  private static async applyTitleFreeAnimation(title: SVGSVGElement, entry: boolean) {
    const strokes = Array.from(title.querySelectorAll('g.var-group path')) as SVGPathElement[];
    let minX: number | null = null;
    const promises = strokes.map((stroke, _i) => {
      const bbox = stroke.getBoundingClientRect();
      const parentBbox = stroke.parentElement!.getBoundingClientRect();
      const inGrpXdiff = stroke.parentElement!.style.getPropertyValue('--in-grp-xdiff');
      const grpXdiff = stroke.parentElement!.parentElement!.style.getPropertyValue('--grp-xdiff');
      const dist = (bbox.x - parentBbox.x) + (parseFloat(inGrpXdiff) + parseFloat(grpXdiff)) * 48;

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