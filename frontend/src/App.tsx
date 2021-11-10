import clsx from 'clsx';
import { useCallback, useRef, useState } from 'react';

import SPEC from './test.json';
import { LayoutedTitle } from 'pointwise-render';

const Render = import('pointwise-render');

type Awaited<T> = T extends PromiseLike<infer U> ? U : T

// TODO: move to rust side
export enum State {
  Anchored = 'Anchored',
  Loading = 'Loading',
  Centered = 'Centered',
};

export default function App(): JSX.Element {
  const title = useRef<LayoutedTitle>();
  const titleElem = useRef<HTMLCanvasElement>();
  const render = useRef<Awaited<typeof Render>>();

  const startup = useCallback((local: HTMLCanvasElement) => {
    Render.then(r => {
      render.current = r;

      // TODO: move into comp
      const t = r.prepare(SPEC);
      title.current = t;
      titleElem.current = local;

      const localSize = local.getBoundingClientRect();
      local.width = localSize.width;
      local.height = localSize.height;

      const localCtx = local.getContext('2d');
      if(!localCtx) return;
      let now = performance.now();
      r.render(t, localCtx, now);

      const canvas: HTMLCanvasElement | null = document.getElementById('title-global') as HTMLCanvasElement | null;
      if(!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const ctx = canvas.getContext('2d');
      if(!ctx) return;

      const frame = () => {
        let now = performance.now();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        r.render(t, ctx, now);

        requestAnimationFrame(frame);
      }

      frame();
    });
  }, []);
  const [cur, setCur] = useState(State.Anchored);
  const [titleHidden, setTitleHidden] = useState(false);
  const [hidden, setHidden] = useState(true);

  return (
    <div className="app" onClick={() => {
      console.log('Trigger');
      if(!title.current || !titleElem.current || !render.current) return;
      if(cur !== State.Loading) {
        const titleLoc = titleElem.current.getBoundingClientRect();
        render.current.blowup(title.current, titleLoc.x, titleLoc.y, performance.now());
        setTitleHidden(true);
        setCur(State.Loading);
      } else {
        const delay = render.current.condense(title.current, performance.now());

        // TODO: do we have any better way to do this
        setTimeout(() => {
          setHidden(false);
        }, delay);
        setCur(State.Centered);
      }
    }}>

      <canvas id="title-global" className={clsx({ 'title-global-hidden': cur === State.Anchored })}></canvas>

      <div className="list-entry">
        <canvas
          ref={startup}
          className={clsx("list-title", { 'list-title-hidden': titleHidden })}
        />
      </div>
      <div className={clsx("post", { 'post-hidden': hidden })}>
        <div className="post-inner">
          <div className="post-meta">
            <div className="post-author">
              <img src="https://lh3.googleusercontent.com/a-/AOh14Gh_MGK0Bw_K_pZ2kMQ-UFnybSQbS2NSBn8m0fB7lg=s96-c" />
              <div className="post-author-img-mask" />
              <div className="post-author-info">
                <div className="post-author-name">
                  喵喵 🍓
                </div>
                <div className="post-author-tool">
                  w/ 猫爪子
                </div>
              </div>
            </div>

            <div className="post-meta-icon">
              <i className="material-icons">access_time</i>
            </div>
            <div className="post-time">
              <div className="post-time-date">
                2020-02-02
              </div>
              <div className="post-time-time">
                08:00:00
              </div>
              <div className="post-time-time">
                edit @ +43d
              </div>
            </div>

            <div className="post-meta-icon">
              <i className="material-icons">style</i>
            </div>
          </div>
          <div className="post-content">
            Test
          </div>
        </div>
      </div>
    </div>
  );
}