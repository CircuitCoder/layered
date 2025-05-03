import { apply as applyStatic, arrow } from "./static";

import { Post as PostData } from "./typings/Post";
import { getData } from "./data";
import {
  wait,
  nextTick,
  getLinkInAnscenstor,
  randomWithin,
  Debouncer,
} from "./utils";
import {
  render as renderLine,
  materialize as materializeLine,
  getStrokeDist,
  RenderDimensions,
} from "./font";
import { jsx, clone as cloneNode } from "./jsx";
import { search } from "./search/wrapper";
import * as Icons from "./icons";
import * as CONFIG from "./config";

import { Temporal } from "@js-temporal/polyfill";
import "giscus";
import { TitleResp } from "./typings/TitleResp";
import { SearchResult } from "./search/impl";
import { Metadata } from "./typings/Metadata";
import { ISetConfigMessage } from "giscus";

/**
 * Application bootstrap
 */
type State =
  | {
      ty: "Vacant";
    }
  | {
      ty: "Home";
    }
  | {
      ty: "Post";
      slug: string;
    }
  | {
      ty: "Tag";
      tag: string;
    }
  | {
      ty: "About";
    }
  | {
      ty: "Search";
    }
  | {
      ty: "NotFound";
    };

const AUTO_POST_PREVIEW_LENGTH = 100;

interface RenderedEntity {
  element: HTMLElement;
  exit(): Promise<void>;
}

const SSR = import.meta.env.SSR;
const DEBUG_ANIMATION_SLOWDOWN: number = 1;

let state: State = { ty: "Vacant" };
let rendered: RenderedEntity | null = null;
type Locale = "zh-CN" | "en-US";

let preferredLocale: Locale = "zh-CN"; // TODO: parse from URL
let onTop = true;

export function reset() {
  state = { ty: "Vacant" };
  rendered = null;
  preferredLocale = "zh-CN";
  onTop = true;
}

function registerDOM(key: string, value: any) {
  document.getElementById(key)!.replaceWith(value);
}

export async function bootstrap(
  register: (key: string, value: any) => void = registerDOM,
  initPath: string = document.location.pathname,
) {
  applyStatic(register);

  // Render
  await reflection(initPath, null, register);

  // SSR ends here
  if (SSR) return;

  // Listen on scroll sentinel
  const sentinel = document.getElementById("scroll-sentinel")!;
  const observer = new IntersectionObserver((ents) => {
    onTop = ents[0].isIntersecting;
    updateBannerClass();
  });
  observer.observe(sentinel);

  window.addEventListener("scroll", scroll);
  window.addEventListener("click", (e) => {
    // Check if is internal URL
    let link = getLinkInAnscenstor(e.target);

    if (!link) return;
    if (!link.startsWith("/")) {
      if (link.startsWith(document.location.origin))
        link = link.slice(document.location.origin.length);
      else return;
    }
    const pathEnd = link.indexOf("#");
    if (pathEnd !== -1) link = link.slice(0, pathEnd);

    // TODO: detect unchanged
    // TODO: potentially navigate to hash

    e.preventDefault();
    history.pushState(null, "", link);
    reflection(link, e.target);
  });

  window.addEventListener("popstate", () => {
    reflection(document.location.pathname);
  });
}

/**
 * Animation
 */
async function startup(cn: string) {
  const root = document.getElementById("root")!;

  root.classList.add(`initial`);
  root.classList.add(`${cn}-trigger`);
  root.classList.add(`${cn}`);
  document.body.style.display = "";
  root.getBoundingClientRect(); // Force re-render
  await nextTick();
  root.classList.remove(`${cn}-trigger`);
  await wait(1100);
  root.classList.remove(`initial`);
}

function scroll() {
  const root = document.getElementById("root")!;
  root.style.setProperty("--scroll", window.scrollY.toString());
}

function updateBannerClass(given?: State): string {
  const used = given ?? state;
  const root = document.getElementById("root")!;
  const bannerMode = used.ty === "About" || (onTop && used.ty === "Home");
  const targetClass = bannerMode ? "banner" : "header";
  if (root.classList.contains(targetClass)) return targetClass;

  // Also remove initial. All banner state changes during initial immediately halts the startup animation
  root.classList.remove("banner", "header", "initial");
  root.classList.add(targetClass);
  return targetClass;
}

/**
 * URL -> state reflection
 */

function parsePath(path: String): State {
  const postMatch = path.match(/^\/post\/([^\/]+)$/);
  const tagMatch = path.match(/^\/tag\/([^\/]+)$/);
  if (path === "/") return { ty: "Home" };
  else if (path === "/search") return { ty: "Search" };
  else if (path === "/about") return { ty: "About" };
  else if (postMatch !== null) return { ty: "Post", slug: decodeURIComponent(postMatch[1]) };
  else if (tagMatch !== null) return { ty: "Tag", tag: decodeURIComponent(tagMatch[1]) };
  else return { ty: "NotFound" };
}

async function reflection(
  path: string,
  activator: EventTarget | null = null,
  register?: (key: string, value: any) => void,
) {
  // Commit exit animation
  const newState = parsePath(path);
  const oldState = state;

  state = newState;

  // TODO: Verify existence, or instead use 404

  if (rendered !== null && !SSR) rendered.exit();
  rendered = null;

  let cn: string = "banner";
  if (!SSR) {
    window.scrollTo(0, 0);
    await nextTick();

    // TODO: delay startup animiation class detection after content is rendered, s.t. scroll is correctly reflected
    // Or give a min-height 101vh during startup to see if the stored scroll is not a top
    cn = updateBannerClass(newState);
    if (oldState.ty === "Vacant") startup(cn);

    const root = document.getElementById("root")!;
    root.setAttribute("data-view", newState.ty.toLowerCase());
  }

  const prerendered =
    !SSR && document.getElementById("root")!.hasAttribute("data-prerendered");
  if (prerendered) {
    try {
      await transitionRehydrate(cn === "banner" && oldState.ty === "Vacant");
      resetPrerenderedGiscusTheme();
      document.getElementById("root")!.removeAttribute("data-prerendered");
      return;
    } catch (e) {
      console.error(e);
      console.log(
        "Fallback to normal rendering, removing pre-rendered element",
      );
      document.querySelector(".prerendered")?.remove();
    }
  }
  await transitionRender(
    activator,
    cn === "banner" && oldState.ty === "Vacant",
    register,
    path,
  );
}

async function transitionRender(
  activator: EventTarget | null,
  slowEntry: boolean,
  register?: (key: string, value: any) => void,
  path?: string,
) {
  // All transitions require fetching all data, so we wait on that

  // FIXME: also fetch data for search
  const data = await getData();

  // The default title
  let title: string = "分层 - Layered";
  let backlink: string | null = null;
  let desc: string = "喵喵的博客";

  // Render list
  // TODO: hide list during debounce, match with transition duration
  if (state.ty === "Home") rendered = new List(data.filter(e => !e.metadata.hidden), register);
  else if (state.ty === "Search") rendered = new Search(register);
  // Render post
  else if (state.ty === "Post") {
    const slug = state.slug; // workaround typechecker
    const post = data.find((p) => p.metadata.id === slug)!;
    title = post.metadata.title + " | 分层 - Layered";
    backlink = CONFIG.BASE + "/post/" + slug;
    rendered = new Post(post, register);
    desc =
      post.plain.length > 300 ? post.plain.slice(0, 300) + "..." : post.plain;
  }
  else if (state.ty === "Tag") {
    const tag = state.tag;
    title = `标签：${tag} | 分层 - Layered`;
    backlink = CONFIG.BASE + "/tag/" + tag;
    const filtered = data.filter(e => !e.metadata.hidden && e.metadata.tags.includes(tag));
    desc = `共 ${filtered.length} 篇文章`;
    rendered = new List(
      filtered,
      register,
      () => <div class="tag-header">
        {cloneNode(Icons.Tag)}
        <span class="tag-name">{tag}</span>
      </div>,
      ["tag-list"],
    );
  }

  // Init about components
  else if (state.ty === "About") {
    rendered = new About(false, register);
    title = "关于 | 分层 - Layered";
    backlink = CONFIG.BASE + "/about";
  }

  if (!rendered) throw new Error("Not rendered!");
  if (SSR) register!("rendered", rendered?.element);
  else {
    document.getElementById("root")!.appendChild(rendered.element);

    if (state.ty === "Home") (rendered as List).entry(slowEntry);
    else if (state.ty === "Search") (rendered as Search).entry(slowEntry);
    else if (state.ty === "Post") {
      let renderedTitle: SVGSVGElement | null = null;
      if (
        activator !== null &&
        activator instanceof HTMLElement &&
        activator.parentElement?.classList.contains("entry-title")
      ) {
        const sibling = activator.parentElement.querySelector("svg");
        if (sibling) renderedTitle = sibling as SVGSVGElement;
      }
      (rendered as Post).entry(renderedTitle);
    } else if (state.ty === "About") (rendered as About).entry();
    else if (state.ty === "Tag") (rendered as List).entry(false);
  }

  if (!SSR) {
    document.title = title;
    editMeta("giscus:backlink", backlink);
    editMeta("og:title", title);
    editMeta("og:url", backlink);
    editMeta("og:description", desc);
  } else {
    register!(":title", title);
    if (backlink) register!(":backlink", title);
    register!(":og:title", title);
    register!(":og:url", CONFIG.BASE + path);
    register!(":og:type", "website");
    register!(":og:description", desc);
  }
}

async function transitionRehydrate(slowEntry: boolean) {
  if (state.ty === "Home" || state.ty === "Tag") {
    const l = new List();
    rendered = l;
    l.entry(slowEntry && state.ty === "Home");
  } else if (state.ty === "Post") {
    const p = new Post();
    rendered = p;
    p.entry(null);
  } else if (state.ty === "About") {
    const a = new About(true);
    rendered = a;
    a.entry();
  }
}

function editMeta(key: string, value: string | null) {
  let meta = document.querySelector(`meta[name="${key}"]`);
  if (value === null) {
    meta?.remove();
    return;
  }

  if (meta) meta.setAttribute("content", value);
  else {
    meta = <meta name={key} content={value} />;
    document.head.appendChild(meta);
  }
}

function freezeScroll(el: HTMLElement) {
  const scrollY = window.scrollY;
  el.style.setProperty("position", "fixed");
  el.style.setProperty("top", `-${scrollY}px`);
  // Override --scroll variable
  el.style.setProperty("--scroll", `${scrollY}`);
}

function resetPrerenderedGiscusTheme() {
  const darkMode =
    !SSR && window.matchMedia("(prefers-color-scheme: dark)").matches;
  setGiscusTheme(darkMode ? "dark_dimmed" : "light");
}

function setGiscusTheme(theme: string) {
  for (const el of document.getElementsByTagName("giscus-widget"))
    el.setAttribute("theme", theme);
  for (const iframeRaw of document.querySelectorAll("iframe.giscus-frame")) {
    const iframe = iframeRaw as HTMLIFrameElement;
    iframe?.contentWindow?.postMessage(
      {
        giscus: {
          setConfig: {
            theme: theme,
          },
        } as ISetConfigMessage,
      },
      "https://giscus.app",
    );
  }
}

function renderGiscus(title: string): HTMLElement {
  const darkMode =
    !SSR && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const discusTheme = darkMode ? "dark_dimmed" : "light";

  return (
    <giscus-widget
      repo="CircuitCoder/layered"
      repoid="R_kgDOGW5ewA"
      category="Comments"
      categoryid="DIC_kwDOGW5ewM4Cmogr"
      mapping="specific"
      term={title}
      strict="1"
      reactionsenabled="1"
      emitmetadata="1"
      inputposition="top"
      theme={discusTheme} // TODO: change me when introducing dark mode override
      lang={preferredLocale}
      loading="lazy"
    ></giscus-widget>
  );
}

function rehydrate(key: string, cls?: string): HTMLElement | null {
  if (SSR) return null;
  const root = document.getElementById("root")!;
  if (root.getAttribute("data-prerendered") !== key) return null;
  const queried = root.querySelector(`:scope > .${cls ?? key}`);
  return queried as HTMLElement | null;
}

export function surrogateTitle(spec: TitleResp, text: string): Element {
  return (
    <div class="surrogate-title">
      {text}
      <script type="application/json">{JSON.stringify(spec)}</script>
    </div>
  );
}

export function hydratedTitle(
  spec: TitleResp,
  maxWidth: number,
  additionalClasses?: string[],
): [Element, RenderDimensions] {
  const rendered = renderLine(spec, maxWidth);
  return [materializeLine(...rendered, additionalClasses), rendered[1]];
}

export function renderTitle(
  spec: TitleResp,
  text: string,
  getMaxWidth: () => number,
  additionalClasses?: string[],
): [Element, RenderDimensions?] {
  if (SSR) return [surrogateTitle(spec, text), undefined];
  return hydratedTitle(spec, getMaxWidth(), additionalClasses);
}

/**
 * List rendering
 */

namespace ListCommon {
  export function getTitleSpace(): number {
    // Get available space
    const viewportWidth = window.innerWidth;
    if (viewportWidth > 500) return Math.max(viewportWidth - 120, 400);
    else return viewportWidth - 80;
  }

  export function renderEntry(
    metadata: Metadata,
    extra: HTMLElement[] = [],
  ): HTMLElement {
    const dispTime = Temporal.Instant.from(metadata.publish_time);
    const dispDate = dispTime.toLocaleString(preferredLocale, {
      dateStyle: "medium",
    });
    const updated = !!metadata.update_time;

    let line: Element;
    let delayedRenderer: (() => void) | null = null;
    const render = () => {
      const [rendered] = renderTitle(
        metadata.title_outline,
        metadata.title,
        () => getTitleSpace() / 24,
      );
      return rendered;
    };

    if (SSR || !window.ContentVisibilityAutoStateChangeEvent) {
      line = render();
    } else {
      line = <div />;
      delayedRenderer = () => {
        line.replaceWith(render());
      };
    }

    const entry = (
      <div class="entry">
        <div class="entry-title" style={{}}>
          {line}
          <a class="entry-title-tangible" href={`/post/${metadata.id}`}>
            {metadata.title}
          </a>
        </div>
        {...extra}
        <div class="entry-time">
          {dispDate}
          {updated && cloneNode(Icons.Edit)}
        </div>
      </div>
    );

    if (delayedRenderer !== null)
      entry.addEventListener("contentvisibilityautostatechange", () => {
        delayedRenderer();
      });
    return entry;
  }
}

class List implements RenderedEntity {
  element: HTMLElement;

  constructor(
    posts?: PostData[],
    register?: (key: string, value: any) => void,
    addon?: () => Element,
    cls?: string[],
  ) {
    // TODO: actually use hash of list
    if (posts === undefined) {
      const rehydrated = rehydrate("list");
      if (!rehydrated) throw new Error("Hydration failed!");
      // TODO: retry render
      this.element = rehydrated;

      this.element.querySelectorAll(".surrogate-title").forEach((el) => {
        const spec = JSON.parse(
          el.querySelector(":scope > script")!.textContent!,
        );
        const [hydrated] = hydratedTitle(spec, ListCommon.getTitleSpace() / 24);
        el.replaceWith(hydrated);
      });
      return;
    }
    if (SSR) register!(":prerendered", "list");

    const entries = posts.map((p) => {
      const preview =
        p.plain.length > AUTO_POST_PREVIEW_LENGTH
          ? p.plain.substring(0, AUTO_POST_PREVIEW_LENGTH) + "..."
          : p.plain;
      return ListCommon.renderEntry(p.metadata, [
        <div class="entry-preview">{preview}</div>,
      ]);
    });
    const list = <div class={["list", ...(cls ?? [])]}>
      {addon && addon()}
      {...entries}
    </div>;
    this.element = list;
  }

  entry(initialHome: boolean): typeof this {
    this.element.animate(
      [
        {
          transform: "translateY(-20px)",
          opacity: 0,
        },
        {},
      ],
      {
        delay: initialHome ? 700 : 200,
        duration: 200,
        easing: "ease-out",
        fill: "backwards",
      },
    );
    return this;
  }

  async exit() {
    const el = this.element;
    freezeScroll(el);
    return el
      .animate(
        [
          {},
          {
            transform: "translateY(20px)",
            opacity: 0,
          },
        ],
        {
          duration: 200,
          easing: "ease-in",
          fill: "backwards",
        },
      )
      .finished.then(() => el.remove());
  }
}

/* Search is a simple wrapper around List */
class Search implements RenderedEntity {
  element: HTMLElement;
  // Active search result container
  active: HTMLElement | null;

  constructor(_register?: (key: string, value: any) => void) {
    this.active = null;

    // Never re-hydrate search, and also don't register

    const input = <input id="search-input"></input>;

    if (!SSR) {
      const searchDebouncer = new Debouncer(500);
      input.addEventListener("input", async () => {
        this.exitResult();
        await searchDebouncer.notify();
        const query = (input as HTMLInputElement).value;
        if (query === "") this.renderResult();
        else {
          const result = await search(query);
          this.renderResult(result);
        }
      });
    }

    this.element = (
      <div class="search">
        <div class="search-input-container">
          {input}
          <div id="search-cnt">在此输入关键词</div>
        </div>
      </div>
    );
  }

  renderResult(results?: SearchResult[]) {
    const cntContainer = document.getElementById("search-cnt");
    if (!results) {
      if (cntContainer) {
        cntContainer.innerText = "在此输入关键词";
        cntContainer.classList.remove("hidden");
      }
      return;
    }

    const cnt = results.length;
    if (cntContainer) {
      cntContainer.innerText = `${cnt} 条结果`;
      cntContainer.classList.remove("hidden");
    }

    const rendered = (
      <div class="search-result">
        {results.map((r) => {
          const preview = r.preview.map((e) => {
            if (e[0] === "ellipsis")
              return <span class="search-preview-ellipsis">...</span>;
            else if (e[0] === "text")
              return <span>{r.plain.slice(e[1], e[2])}</span>;
            else if (e[0] === "highlight")
              return <strong>{r.plain.slice(e[1], e[2])}</strong>;
            else throw new Error("Unknown preview segment");
          });
          return ListCommon.renderEntry(r.metadata, [
            <div class="search-preview">{...preview}</div>,
          ]);
        })}
      </div>
    );
    this.element.appendChild(rendered);
    this.active = rendered;
    rendered.animate([{ opacity: 0, transform: "translateY(-20px)" }, {}], {
      duration: 200,
      easing: "ease-out",
      fill: "backwards",
    });
  }

  entry(initialHome: boolean): typeof this {
    this.element.animate([{ opacity: 0 }, {}], {
      delay: initialHome ? 700 : 200,
      duration: 200,
      easing: "ease-out",
      fill: "backwards",
    });
    return this;
  }

  async exitResult(endOpacity: number = 0) {
    const cntContainer = document.getElementById("search-cnt");
    if (cntContainer) cntContainer.classList.add("hidden");
    const el = this.active;
    if (!el) return;

    freezeScroll(el);
    return el
      .animate(
        [
          {},
          {
            transform: "translateY(20px)",
            opacity: endOpacity,
          },
        ],
        {
          duration: 200,
          easing: "ease-in",
          fill: "backwards",
        },
      )
      .finished.then(() => el.remove());
  }

  async exit() {
    this.exitResult(1);
    const el = this.element;
    freezeScroll(el);
    return el
      .animate([{}, { opacity: 0 }], {
        duration: 200,
        easing: "ease-in",
        fill: "backwards",
      })
      .finished.then(() => el.remove());
  }
}

/* Post rendering */
class Post implements RenderedEntity {
  element: HTMLElement;
  observer: IntersectionObserver | null = null;

  constructor(post?: PostData, register?: (key: string, value: any) => void) {
    // TODO: actually use hash of post
    if (post === undefined) {
      const key = "post";
      const rehydrated = rehydrate(key);
      if (!rehydrated) throw new Error("Hydration failed!");
      this.element = rehydrated;

      this.element.querySelectorAll(".surrogate-title").forEach((el) => {
        const spec = JSON.parse(
          el.querySelector(":scope > script")!.textContent!,
        );
        const isAux = el.parentElement?.classList.contains("post-metadata-aux");
        const maxWidth = isAux
          ? Post.getAuxTitleSpace() / 16
          : Post.getTitleSpace() / 48;
        const [hydrated, dim] = hydratedTitle(
          spec,
          maxWidth,
          !isAux ? ["title-center"] : [],
        );

        if (!isAux)
          el.parentElement?.style.setProperty(
            "--title-line-cnt",
            dim.lineCnt.toString(),
          );
        el.replaceWith(hydrated);
      });

      return;
    }
    if (SSR) register!(":prerendered", "post");

    // Get available space

    const [title, titleDim] = renderTitle(
      post.metadata.title_outline,
      post.metadata.title,
      () => Post.getTitleSpace() / 48,
      ["title-center"],
    );

    const content = <div __html={post.html} class="post-content"></div>;

    const publishTime = Temporal.Instant.from(post.metadata.publish_time);
    const publishTimeStr = publishTime.toLocaleString(preferredLocale, {
      dateStyle: "short",
      timeStyle: "short",
    });

    let updatedTimeStr: string | null = null;
    if (post.metadata.update_time) {
      const updatedTime = Temporal.Instant.from(post.metadata.update_time);
      updatedTimeStr = updatedTime.toLocaleString(preferredLocale, {
        dateStyle: "short",
        timeStyle: "short",
      });
    }

    function genMetadata(cn: string, additional: Element[]): Element {
      return (
        <div class={cn}>
          {...additional}
          <div class="post-metadata-line post-metadata-published">
            {cloneNode(Icons.Event)}
            {publishTimeStr}
          </div>
          {updatedTimeStr && (
            <div class="post-metadata-line post-metadata-updated">
              {cloneNode(Icons.EventEdit)}
              {updatedTimeStr}
            </div>
          )}
          <div class="post-metadata-line post-metadata-tags">
            {cloneNode(Icons.Tag)}
            {post!.metadata.tags.map((tag) => (
              <a href={`/tag/${tag}`} class="post-metadata-tag">
                {tag}
              </a>
            ))}
          </div>
        </div>
      );
    }

    function genBanner(metadata: Metadata): Element[] {
      const result = [];
      if(metadata.hidden) {
        result.push(
          <div class="post-banner">
            <div class="post-banner-inner">This post is hidden! But you can still share around the link if you'd like to.</div>
          </div>
        );
      }

      if(metadata.wip) {
        result.push(
          <div class="post-banner post-banner-amber">
            <div class="post-banner-inner">This post / series is a WIP. Please send feedbacks in comments!</div>
          </div>
        );
      }

      if(metadata.legacy) {
        const link = `https://legacy.meow.c-3.moe/${metadata.id}`;
        result.push(
          <div class="post-banner post-banner-green">
            <div class="post-banner-inner">This is a legacy post migrated from my old blog C3Meow. <a href={link}>Check out the original version!</a></div>
          </div>
        );
      }
      return result;
    }

    const metadata = genMetadata("post-metadata", []);

    const [auxTitle] = renderTitle(
      post.metadata.title_outline,
      post.metadata.title,
      () => Post.getAuxTitleSpace() / 16,
    );

    const auxMetadata = genMetadata("post-metadata-aux", [auxTitle]);
    const banner = genBanner(post.metadata);

    const contentWrapper = (
      <div class="post-content-wrapper">
        {metadata}
        {banner}
        {content}
        <div class="post-comments">{renderGiscus(post.metadata.title)}</div>
      </div>
    );

    this.element = (
      <div
        class="post"
        style={{
          "--title-line-cnt": (titleDim?.lineCnt ?? 1).toString(),
        }}
      >
        {title}
        {auxMetadata}
        {contentWrapper}
      </div>
    );
  }

  private static getTitleSpace(): number {
    const viewportWidth = window.innerWidth;
    if (viewportWidth > 800) return Math.min(viewportWidth - 300, 900);
    else if (viewportWidth > 500) return viewportWidth - 120;
    else return viewportWidth - 80;
  }

  private static getAuxTitleSpace(): number {
    const viewportWidth = window.innerWidth;
    if (viewportWidth > 800) return 160;
    else return viewportWidth - 260;
  }

  entry(renderedTitle: SVGSVGElement | null): Post {
    const title = this.element.querySelector(
      ":scope > .title",
    ) as SVGSVGElement;
    const contentWrapper = this.element.querySelector(
      ".post-content-wrapper",
    ) as HTMLElement;
    const metadata = this.element.querySelector(
      ".post-metadata",
    ) as HTMLElement;

    renderedTitle?.style.setProperty("opacity", "0");

    Post.applyTitleVariation(title, renderedTitle);
    if (!renderedTitle) Post.applyTitleFreeAnimation(title, true);
    contentWrapper.animate(
      [
        {
          opacity: 0,
          transform: "translateY(-10px)",
        },
        {},
      ],
      {
        delay: 200,
        duration: 200,
        easing: "ease-out",
        fill: "both",
      },
    );

    this.observer = new IntersectionObserver((ents) => {
      for (const ent of ents) {
        if (ent.isIntersecting) this.element.classList.remove("post-docked");
        else this.element.classList.add("post-docked");
      }
    });
    this.observer.observe(metadata);

    return this;
  }

  async exit() {
    const el = this.element;
    el.classList.add("post-exiting");
    freezeScroll(el);
    const title = el.querySelector(":scope > .title") as SVGSVGElement;
    const titleRemoved = Post.applyTitleFreeAnimation(title, false);
    const content = el.querySelector(".post-content-wrapper") as HTMLElement;
    const contentRemoved = content.animate(
      [
        {},
        {
          opacity: 0,
          transform: "translateY(10px)",
        },
      ],
      {
        duration: 200,
        easing: "ease-in",
        fill: "both",
      },
    );

    await Promise.all([titleRemoved, contentRemoved]);
    el.remove();
    this.observer?.disconnect();
  }

  private static async applyTitleVariation(
    title: SVGElement,
    ref: SVGElement | null = null,
  ) {
    // Query location prior to applying variation

    const grps = Array.from(
      title.querySelectorAll("g.var-group") as NodeListOf<
        HTMLElement | SVGElement
      >,
    );
    let pastXVar = 0;
    let lastLine = grps[0]?.parentElement;

    const uncommittedX = new Map<HTMLElement | SVGElement, number>();
    function commit(delta: number) {
      for (const [grp, x] of uncommittedX)
        grp.style.setProperty("--var-offset-x", (x + delta).toString() + "px");
      uncommittedX.clear();
    }

    for (const grp of grps) {
      const curLine = grp.parentElement;
      if (curLine !== lastLine) {
        commit(-pastXVar / 2);
        pastXVar = 0;
        lastLine = curLine;
      }

      const scale = randomWithin(0.9, 1.2);
      grp.style.setProperty("--var-scale", scale.toString());
      grp.style.setProperty("--var-offset-y", randomWithin(-0.1, 0.1) + "px");
      uncommittedX.set(grp, pastXVar);

      const grpWidth = parseFloat(grp.style.getPropertyValue("--grp-width"));

      pastXVar += grpWidth * (scale - 1);
    }
    commit(-pastXVar / 2);

    if (ref !== null) {
      const refStrokes = ref?.querySelectorAll(
        "g.var-group path",
      ) as NodeListOf<SVGPathElement>;
      const strokes = title.querySelectorAll(
        "g.var-group path",
      ) as NodeListOf<SVGPathElement>;

      const animations = Array.from(strokes).map((stroke, i) => {
        const refStroke = refStrokes[i];

        // TODO: do not hard code scale

        // It's really hard to figure out the relative position
        // when considering overarching scaling
        // So we pre-set the target FLIP scale and then ask
        // what's the delta

        stroke.style.setProperty("--var-scale", `0.5`); // Origional scale
        const bbox = stroke.getBoundingClientRect();
        const refBbox = refStroke.getBoundingClientRect();

        stroke.style.removeProperty("--var-scale");
        const dist = getStrokeDist(stroke, 24);
        return { dx: refBbox.x - bbox.x, dy: refBbox.y - bbox.y, dist, stroke };
      });

      const maxDist = Math.max(...animations.map(({ dist }) => dist));

      for (const { dx, dy, dist, stroke } of animations) {
        stroke.animate(
          [
            {
              transform: `
          translate(${dx}px, ${dy}px)
          scale(calc(24 / var(--em)))
          `,
            },
            {},
          ],
          {
            delay: Math.random() * 200 + (dist / maxDist) * 300,
            duration: 200,
            easing: "cubic-bezier(0, 0, 0, 1)",
            fill: "both",
          },
        );
      }
    }
  }

  private static async applyTitleFreeAnimation(
    title: SVGElement,
    entry: boolean,
  ) {
    const strokes = Array.from(
      title.querySelectorAll("g.var-group path"),
    ) as SVGPathElement[];
    const promises = strokes.map((stroke, _i) => {
      const dist = getStrokeDist(stroke, 48);

      const offsetX = entry ? randomWithin(-50, 35) : randomWithin(-10, 25);
      const offsetY = entry ? randomWithin(-50, 35) : randomWithin(-10, 25);
      const scale = entry ? randomWithin(1, 1.1) : randomWithin(0.9, 1);

      const freeKeyframe = {
        transform: `
          translate(${offsetX}px, ${offsetY}px)
          scale(calc(${scale} * var(--size) / var(--em)))
          translate(calc(0.5px *  var(--em)), calc(-0.5px *  var(--em)))
          scaleX(${Math.abs(offsetX) / (entry ? 250 : 25)})
          scaleY(${Math.abs(offsetY) / (entry ? 50 : 25)})
          translate(calc(-0.5px *  var(--em)), calc(0.5px *  var(--em)))
        `, // FIXME: figure out how to correct viewBox transform orogin
        opacity: 0,
        // filter: "blur(calc(0.2px * var(--em)))",
      };

      const keyframes = entry ? [freeKeyframe, {}] : [{}, freeKeyframe];
      return stroke.animate(keyframes, {
        delay: dist * (entry ? 1.2 : 0.5) * DEBUG_ANIMATION_SLOWDOWN,
        duration: (entry ? 500 : 200) * DEBUG_ANIMATION_SLOWDOWN,
        easing: entry ? "cubic-bezier(0, 0, 0, 1)" : "cubic-bezier(1, 0, 1, 1)",
        fill: "both",
      }).finished;
    });

    await Promise.all(promises);
  }
}

class About implements RenderedEntity {
  element: HTMLElement;

  constructor(
    prerendered: boolean = false,
    register?: (key: string, value: any) => void,
  ) {
    if (prerendered) {
      const rehydrated = rehydrate("about");
      if (!rehydrated) throw new Error("Hydration failed!");
      this.element = rehydrated;
      return;
    }
    if (SSR) register!(":prerendered", "about");

    this.element = (
      <div class="about">
        {arrow}
        <div class="about-content">
          <div class="about-inner">
            <h2 class="about-title">
              是<a href="https://c-3.moe">喵喵</a>的博客。
            </h2>
            {/* prettier-ignore */}
            <div class="about-text">
              <p>
                喵喵不是很聪明的那种猫，因此就连自己的想法有的时候都搞不太懂。更糟糕的是，喵喵每天在做的事情也是五花八门，有的时候会写一些<a href="https://github.com/CircuitCoder">奇怪代码</a>，偶尔作为 <ruby>CS 硕士生<rp>(</rp><rt>工科猪</rt><rp>)</rp></ruby>在<a href="https://tuna.moe">工位摸鱼</a>，吃饱的时候会<a href="https://www.strava.com/athletes/39432242">出门跑步</a>，更多的时候是像猫咪一样呼呼大睡。
              </p>
              <p>
                然而丑陋的表达欲是无法抗拒的，所以喵喵尝试将自己小脑瓜里的混沌拣出部分自认为有意思的，编码成文字，分门别类摆放在这个网站上。人们所度过的时间是连续的，然而文字所能定义的内容至多可数，放在这个网站上的内容更是只能有限，是一列离散的采样。这些文章有些涉及技术，有些是生活琐事，还有一些是纯粹的碎碎念，他们所折射出的，是一个分层的喵喵形象。
              </p>
              <p>
                无论你如何找到这个网站，想接触哪个层面的喵喵，都欢迎你的来访，希望你能在这里找到有趣的东西。
              </p>
            </div>
            <div id="about-giscus">{renderGiscus("关于")}</div>
          </div>
          <div class="about-overlay"></div>
        </div>
      </div>
    );
  }

  async entry() {
    const arrowComps = this.element.querySelectorAll("#arrow path");
    const arrowDelays = [0, 500];
    const arrowAnimations = Array.from(arrowComps).map((comp, i) =>
      comp.animate(
        [{ strokeDashoffset: "var(--path-length)" }, { strokeDashoffset: 0 }],
        {
          duration: 300,
          delay: arrowDelays[i],
          easing: "ease-out",
          fill: "both",
        },
      ),
    );

    const content = this.element.querySelector(".about-content") as HTMLElement;
    const contentAnimation = content.animate([{ opacity: 0 }, {}], {
      duration: 200,
      easing: "ease-out",
      fill: "both",
    });

    const text = this.element.querySelector(".about-text") as HTMLElement;
    const textAnimation = text.animate([{ opacity: 0 }, {}], {
      duration: 200,
      delay: 1000,
      easing: "ease-out",
      fill: "both",
    });

    return Promise.all([
      ...arrowAnimations.map((e) => e.finished),
      contentAnimation.finished,
      textAnimation.finished,
    ]);
  }

  async exit() {
    freezeScroll(this.element);

    const arrowComps = this.element.querySelectorAll("#arrow path");
    const arrowDurations = [200, 100];
    const arrowDelays = [200, 0];
    const arrowAnimations = Array.from(arrowComps).map((comp, i) =>
      comp.animate(
        [{ strokeDashoffset: 0 }, { strokeDashoffset: "var(--path-length)" }],
        {
          duration: arrowDurations[i],
          delay: arrowDelays[i],
          easing: "ease-in",
          fill: "both",
        },
      ),
    );

    const content = this.element.querySelector(".about-content") as HTMLElement;
    const contentAnimation = content.animate([{}, { opacity: 0 }], {
      duration: 200,
      easing: "ease-in",
      fill: "both",
    });

    await Promise.all([
      ...arrowAnimations.map((e) => e.finished),
      contentAnimation.finished,
    ]);
    this.element.remove();
  }
}

if (!SSR) document.addEventListener("DOMContentLoaded", () => bootstrap());

// Helper functions for SSR
export async function listTags(): Promise<string[]> {
  const data = await getData();
  const tags = new Set<string>();
  for (const post of data)
    for (const tag of post.metadata.tags)
      tags.add(tag);
  return Array.from(tags);
}
