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

const arrow = <svg id="arrow" viewBox="0 0 38.0965290904 30.5262755052">
  <path
    d="M0,28.0142232945c3.2310780829-6.7495110392,7.9280695555-12.8872048319,14.0387158787-17.2064369811,6.1106463232-4.3192321492,13.6868529362-6.7264715069,21.1379972765-6.0363897249"
    style="--path-length: 44.888343811035156"
  />
  <path
    style="--path-length: 11.792379379272461"
    d="M31.4766212075,0c1.2944018304.7174098089,2.4776749813,1.6348765975,3.4948750212,2.7097984603.2787990226.2946188951.5548943577.6195228047.6409950007,1.0159011978.0928706516.4275451337-.0498748793.8681743804-.2059773585,1.2768939783-.5736964536,1.5020956486-1.3551162966,2.9246919202-2.3150580137,4.2146261727"
  />
</svg>;

const SSR = import.meta.env.SSR;
export function apply(register: (key: string, value: Element) => void) {
  if(SSR || !document.getElementById("logo")?.hasChildNodes())
    register("logo", logo);
  if(SSR || !document.getElementById("arrow")?.hasChildNodes())
    register("arrow", arrow);
}