import { TitleResp } from "./typings/TitleResp";
import { jsxSVG as jsx } from "./jsx";
import { GroupResp } from "./typings/GroupResp";

export type RenderDimensions = {
  totalWidth: number;
  opticalWidth: number;
  lineCnt: number;
  unitsPerEm: number;
};

export type WidthLine = {
  optWidth: number;
  fullWidth: number;
  line: GroupResp[];
};

// Render flow: render gives Line[] and RenderDimensions
// Compare Line[] with rendered lines to see if they are the same
// First render call materialize
// Second render call relayout, with a WeakMap for cached lines and glyphs

// TODO: cache with WeakMap
export function materialize(
  lines: WidthLine[],
  dim: RenderDimensions,
  additionalClasses: string[] = [],
): SVGElement {
  let grpCnt = 0;
  let globalXdiff = 0;
  const linesEl = lines.map((line, lineIdx) => {
    let lineAccum = 0;

    const grps = line.line.map((grp, localGrpIdx) => {
      let grpAccum = 0;

      const chrs = grp.chars.map((chr) => {
        const glyph = (
          <g
            class="glyph"
            style={{
              "--in-grp-xdiff": (grpAccum / dim.unitsPerEm).toString(),
            }}
          >
            {chr.components.map((comp) => (
              <path d={comp}></path>
            ))}
          </g>
        );
        grpAccum += chr.hadv;
        return glyph;
      });

      const grpEl = (
        <g
          class="var-group"
          style={{
            "--local-grp-idx": (localGrpIdx / dim.unitsPerEm).toString(),
            "--grp-idx": grpCnt.toString(),
            "--grp-line-xdiff": (lineAccum / dim.unitsPerEm).toString(),
            "--grp-width": (grp.hadv / dim.unitsPerEm).toString(),
            "--grp-xdiff": (globalXdiff / dim.unitsPerEm).toString(),
          }}
          data-text={grp.text}
        >
          {chrs}
        </g>
      );

      lineAccum += grp.hadv;
      globalXdiff += grp.hadv;
      ++grpCnt;

      return grpEl;
    });

    return (
      <g
        class="line"
        style={{
          "--line-idx": lineIdx.toString(),
          "--line-optical-width": (line.optWidth / dim.unitsPerEm).toString(),
        }}
      >
        {grps}
      </g>
    );
  });

  return (
    <svg
      class={["title", ...additionalClasses]}
      style={{
        "--em": dim.unitsPerEm.toString(),
        "--line-cnt": dim.lineCnt.toString(),
        "--grp-cnt": grpCnt.toString(),
        "--optical-width": (dim.opticalWidth / dim.unitsPerEm).toString(),
      }}
    >
      {linesEl}
    </svg>
  );
}

function nextLine(grps: GroupResp[], maxWidth: number): WidthLine {
  let lineWidthHist = [];
  let lineOpticalWidthHist: number[] = [];
  let lineWidth = 0;
  let lastBreakAfter: null | number = null;

  let idx = 0;
  for (const grp of grps) {
    if (lineWidth + grp.hadv > maxWidth && lastBreakAfter !== null) break;
    lineWidth += grp.hadv;
    lineWidthHist.push(lineWidth);
    if (!grp.text.match(/^ +$/)) {
      lineOpticalWidthHist.push(lineWidth);
    } else {
      lineOpticalWidthHist.push(lineOpticalWidthHist[lineOpticalWidthHist.length - 1]);
    }
    if (grp.breakAfter) lastBreakAfter = idx;
    ++idx;
  }
  if (lastBreakAfter === null) throw new Error("Cannot break line");

  return {
    optWidth: lineOpticalWidthHist[lastBreakAfter],
    fullWidth: lineWidthHist[lastBreakAfter],
    line: grps.slice(0, lastBreakAfter + 1),
  };
}

export function render(
  line: TitleResp,
  maxWidth: number = Infinity,
): [WidthLine[], RenderDimensions] {
  const widthLines: WidthLine[] = [];
  const maxWidthInUnit = maxWidth * line.em;
  let remaining = line.groups;
  while (remaining.length > 0) {
    const line = nextLine(remaining, maxWidthInUnit);
    widthLines.push(line);
    remaining = remaining.slice(line.line.length);
  }

  const dimensions = {
    totalWidth: widthLines.reduce((acc, line) => acc + line.fullWidth, 0),
    opticalWidth: widthLines.reduce(
      (acc, line) => Math.max(acc, line.optWidth),
      0,
    ),
    lineCnt: widthLines.length,
    unitsPerEm: line.em,
  };

  return [widthLines, dimensions];
}

export function getStrokeDist(stroke: SVGPathElement, size: number): number {
  const bbox = stroke.getBoundingClientRect();
  const parentBbox = stroke.parentElement!.getBoundingClientRect();
  const inGrpXdiff =
    stroke.parentElement!.style.getPropertyValue("--in-grp-xdiff");
  const grpXdiff =
    stroke.parentElement!.parentElement!.style.getPropertyValue("--grp-xdiff");
  return (
    bbox.x -
    parentBbox.x +
    (parseFloat(inGrpXdiff) + parseFloat(grpXdiff)) * size
  );
}
