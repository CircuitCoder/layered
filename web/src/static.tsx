/**
 * Pure static HTML contents
 */

import { jsxSVG as jsx } from "./jsx";

const SQRT3 = Math.sqrt(3);
const CORNER_RADIUS = 10;
const logo = <svg id="logo" viewbox="0 0 160 100">
  <defs>
    <path
      id="logo-shard"
      d={`M -${CORNER_RADIUS/2*SQRT3} ${-50 + CORNER_RADIUS / 2 * 3}
        A ${CORNER_RADIUS} ${CORNER_RADIUS} 0 0 1 ${CORNER_RADIUS / 2 * SQRT3} ${-50 + CORNER_RADIUS / 2 * 3}
        L ${50 / SQRT3 - CORNER_RADIUS / 2 / SQRT3} -${CORNER_RADIUS / 2}
        A ${CORNER_RADIUS} ${CORNER_RADIUS} 0 0 1 ${50 / SQRT3 - CORNER_RADIUS / 2 / SQRT3} ${CORNER_RADIUS / 2}
        L ${CORNER_RADIUS/2*SQRT3} ${50 - CORNER_RADIUS / 2 * 3}
        A ${CORNER_RADIUS} ${CORNER_RADIUS} 0 0 1 -${CORNER_RADIUS / 2 * SQRT3} ${50 - CORNER_RADIUS / 2 * 3}
        L -${50 / SQRT3 - CORNER_RADIUS / 2 / SQRT3} ${CORNER_RADIUS / 2}
        A ${CORNER_RADIUS} ${CORNER_RADIUS} 0 0 1 -${50 / SQRT3 - CORNER_RADIUS / 2 / SQRT3} -${CORNER_RADIUS / 2}
        z
      `}
      style={{
        transform: `translate(50px, 50px)`
      }}
    ></path>

    <mask id="logo-mask">
      <g>
        <rect x="50" y="0" width="150" height="100" fill="oklab(1 0 0)"></rect>
        <use href="#logo-shard" style={{
          fill: "oklab(0 0 0)",
        }}></use>
      </g>
    </mask>
  </defs>
  <a href="/">
    <g id="logo-shards">
      <g class="logo-shards-container">
        <use href="#logo-shard" mask="url(#logo-mask)"></use>
      </g>
      <g class="logo-shards-container">
        <use href="#logo-shard" mask="url(#logo-mask)"></use>
      </g>
      <g class="logo-shards-container">
        <use href="#logo-shard" ></use>
      </g>
    </g>
  </a>
</svg>;

export function apply() {
  document.getElementById("logo")!.replaceWith(logo);
}