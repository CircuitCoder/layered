import { TitleResp } from "./typings/TitleResp";
import { randomWithin } from "./utils";

function generateVarGroup(): SVGGElement {
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.classList.add('var-group');
  return g;
}

export function renderLine(line: TitleResp): [SVGSVGElement, number] {
  // FIXME: wrap
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const root = document.createElementNS("http://www.w3.org/2000/svg", "g");

  svg.classList.add('title');
  root.classList.add('line');


  let varScale = randomWithin(0.9, 1.2);
  let varOffsetX = randomWithin(-0.05, 0.05);
  let varOffsetY = randomWithin(-0.1, 0.1);

  let xdiff = 0;
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
    g.style.setProperty('--xdiff', xdiff.toString() + 'px');

    const keep = !!chr.char.match(/[a-zA-Z0-9]/);
    if(!keep) {
      varScale = randomWithin(0.9, 1.2);
      varOffsetX = randomWithin(-0.05, 0.05);
      varOffsetY = randomWithin(-0.1, 0.1);
    }
    g.style.setProperty('--var-scale', varScale.toString());
    g.style.setProperty('--var-offset-x', varOffsetX.toString());
    g.style.setProperty('--var-offset-y', varOffsetY.toString());

    xdiff += chr.hadv;
    // FIXME: centering
    if(keep) {
      varOffsetX += (varScale - 1) * chr.hadv;
    }

    root.appendChild(g);
  }

  svg.appendChild(root);
  return [svg, xdiff];
}