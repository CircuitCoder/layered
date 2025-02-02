/**
 * Pure static HTML contents
 */

import * as CONFIG from "./config";

import {
  init,
  classModule,
  propsModule,
  attributesModule,
  styleModule,
  jsx
} from "snabbdom";

const patch = init([
  classModule,
  propsModule,
  attributesModule,
  styleModule,
]);

const SQRT3 = Math.sqrt(3);
const CORNER_RADIUS = 10;
const logo = <svg attrs={{id: "logo", viewbox: "0 0 160 100"}}>
  <defs>
    <path attrs={{
      id: "logo-shard",
      d: `M -${CORNER_RADIUS/2*SQRT3} ${-50 + CORNER_RADIUS / 2 * 3}
      A ${CORNER_RADIUS} ${CORNER_RADIUS} 0 0 1 ${CORNER_RADIUS / 2 * SQRT3} ${-50 + CORNER_RADIUS / 2 * 3}
      L ${50 / SQRT3 - CORNER_RADIUS / 2 / SQRT3} -${CORNER_RADIUS / 2}
      A ${CORNER_RADIUS} ${CORNER_RADIUS} 0 0 1 ${50 / SQRT3 - CORNER_RADIUS / 2 / SQRT3} ${CORNER_RADIUS / 2}
      L ${CORNER_RADIUS/2*SQRT3} ${50 - CORNER_RADIUS / 2 * 3}
      A ${CORNER_RADIUS} ${CORNER_RADIUS} 0 0 1 -${CORNER_RADIUS / 2 * SQRT3} ${50 - CORNER_RADIUS / 2 * 3}
      L -${50 / SQRT3 - CORNER_RADIUS / 2 / SQRT3} ${CORNER_RADIUS / 2}
      A ${CORNER_RADIUS} ${CORNER_RADIUS} 0 0 1 -${50 / SQRT3 - CORNER_RADIUS / 2 / SQRT3} -${CORNER_RADIUS / 2}
      z
    `
    }} style={{
      transform: `translate(50px, 50px)`
    }}></path>

    <mask attrs={{id: "logo-mask"}}>
      <g>
        <rect attrs={{ x: "50", y: "0", width: "150", height: "100", fill: "oklab(1 0 0)" }}></rect>
        <use attrs={{ href: "#logo-shard" }} style={{
          fill: "oklab(0 0 0)",
        }}></use>
      </g>
    </mask>
  </defs>
  <a attrs={{href: "/"}}>
    <g attrs={{id: "logo-shards"}}>
      <g class={{ "logo-shards-container": true }}>
        <use attrs={{ href: "#logo-shard", mask: "url(#logo-mask)" }}></use>
      </g>
      <g class={{ "logo-shards-container": true }}>
        <use attrs={{ href: "#logo-shard", mask: "url(#logo-mask)" }}></use>
      </g>
      <g class={{ "logo-shards-container": true }}>
        <use attrs={{ href: "#logo-shard" }}></use>
      </g>
    </g>
  </a>
</svg>

export function apply() {
  patch(document.getElementById("logo")!, logo);
}