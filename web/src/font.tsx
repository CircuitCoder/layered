import { TitleResp } from "./typings/TitleResp";

function generateVarGroup(xdiff: number): SVGGElement {
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.classList.add('var-group');
  g.style.setProperty('--grp-xdiff', xdiff.toString() + 'px');
  return g;
}

type RenderDimensions = {
  totalWidth: number;
  opticalWidth: number;
  lineCnt: number;
}

// TODO(perf): cache width with WeakMap
export function relayoutLine(svg: SVGSVGElement, maxWidth: number = Infinity, centered: boolean = false): RenderDimensions {
  if(maxWidth <= 0) throw new Error("maxWidth must be positive");
  if(centered && !Number.isFinite(maxWidth)) throw new Error("centered layout requires finite maxWidth");

  const grps = svg.querySelectorAll('.var-group') as NodeListOf<SVGGElement>;
  let line = 0;
  let lineWidth = 0;
  let maxLineWidth = 0;
  let totWidth = 0;

  const pendingXdiff = new Map<SVGGElement, number>();
  function commitXdiff(delta: number) {
    for(const [g, xdiff] of pendingXdiff)
      g.style.setProperty('--grp-line-xdiff', (xdiff + delta).toString() + 'px');
    pendingXdiff.clear();
  }

  for(const g of grps) {
    const approxWidth = parseFloat(g.style.getPropertyValue('--grp-approx-width'));
    const text = g.getAttribute('data-text');
    totWidth += approxWidth;

    let spaceOnly = text && text.match(/^ *$/);

    let overflowed = lineWidth + approxWidth > maxWidth;
    // Under two conditions, the overflow is ignored:
    // 1. The line is empty
    if(lineWidth === 0) overflowed = false;
    // 2. The group is space-only
    if(spaceOnly) overflowed = false;

    if(overflowed) {
      commitXdiff(centered ? ((maxWidth - lineWidth) / 2) : 0);
      ++line;
      lineWidth = 0;
    }
    g.style.setProperty('--grp-line', line.toString());
    pendingXdiff.set(g, lineWidth);
    lineWidth += approxWidth;

    if(!spaceOnly)
      maxLineWidth = Math.max(maxLineWidth, lineWidth);
  }

  commitXdiff(centered ? ((maxWidth - lineWidth) / 2) : 0);
  svg.style.setProperty('--line-cnt', (line + 1).toString());
  svg.style.setProperty('--optical-width', (centered ? maxWidth : maxLineWidth).toString());

  return {
    totalWidth: totWidth,
    opticalWidth: maxLineWidth,
    lineCnt: line + 1,
  }
}

function isContinous(thunk: string, incoming: string): boolean {
  if(incoming === ' ') return !!thunk.match(/^ +$/);
  else if(thunk.match(/[0-9]/)) return !!thunk.match(/^[0-9]+$/);
  else if(thunk.match(/[a-zA-Z]/)) return !!thunk.match(/^[a-zA-Z]+$/);
  else return false;
}

export function renderLine(line: TitleResp): SVGSVGElement {
  // FIXME: wrap
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const root = document.createElementNS("http://www.w3.org/2000/svg", "g");

  svg.classList.add('title');
  root.classList.add('line');

  let group = null;

  let xdiff = 0;
  let inGrpXdiff = 0;
  let grpCnt = 0;
  let grpThunk = '';
  for(const chr of line.chars) {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");

    // Mask looks really bad for horizontal strokes. Maybe find better path expansion algorithm?
    /*
    let maskAcc = document.createElementNS("http://www.w3.org/2000/svg", "mask");
    maskAcc.id = 'stroke-mask-' + crypto.randomUUID();
    const maskBackdrop = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    maskBackdrop.setAttribute("x", chr.bbox.left + 'px');
    maskBackdrop.setAttribute("y", chr.bbox.top + 'px');
    maskBackdrop.setAttribute("width", (chr.bbox.right - chr.bbox.left) + 'px');
    maskBackdrop.setAttribute("height", (chr.bbox.bottom - chr.bbox.top) + 'px');
    maskBackdrop.setAttribute("fill", "white");
    maskAcc.appendChild(maskBackdrop);
    g.appendChild(maskAcc);
    */

    for(const comp of chr.components) {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", comp);
      // path.setAttribute("mask", `url(#${maskAcc.id})`);
      g.appendChild(path);

      /*
      const maskPath = path.cloneNode(true) as SVGGElement;

      maskAcc = maskAcc.cloneNode(true) as SVGMaskElement;
      maskAcc.id = 'stroke-mask-' + crypto.randomUUID();
      maskAcc.appendChild(maskPath);
      g.appendChild(maskAcc);
      */
    }
    g.classList.add('glyph');

    const keep = group !== null && isContinous(grpThunk, chr.char);
    if(!keep) {
      if(group) {
        group.style.setProperty('--grp-approx-width', inGrpXdiff.toString());
        group.setAttribute('data-text', grpThunk);
      }
      group = generateVarGroup(xdiff);
      group.style.setProperty('--grp-id', grpCnt.toString());
      ++grpCnt;
      root.appendChild(group);
      inGrpXdiff = 0;
      grpThunk = '';
    }

    g.style.setProperty('--in-grp-xdiff', inGrpXdiff.toString() + 'px');
    group!.appendChild(g);
    grpThunk += chr.char;

    xdiff += chr.hadv;
    inGrpXdiff += chr.hadv;
  }

  if(group) {
    group.style.setProperty('--grp-approx-width', inGrpXdiff.toString());
    group.setAttribute('data-text', grpThunk);
  }

  svg.style.setProperty("--grp-cnt", grpCnt.toString());
  svg.appendChild(root);
  return svg;
}