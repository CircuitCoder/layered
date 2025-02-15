import { TitleResp } from "./typings/TitleResp";
import { jsxSVG as jsx } from "./jsx";
import { GroupResp } from "./typings/GroupResp";

type RenderDimensions = {
  totalWidth: number;
  opticalWidth: number;
  lineCnt: number;
};

type WidthLine = {
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
              "--in-grp-xdiff": grpAccum.toString(),
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
            "--local-grp-idx": localGrpIdx.toString(),
            "--grp-idx": grpCnt.toString(),
            "--grp-line-xdiff": lineAccum.toString(),
            "--grp-width": grp.hadv.toString(),
            "--grp-xdiff": globalXdiff.toString(),
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
          "--line-optical-width": line.optWidth.toString(),
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
        "--line-cnt": dim.lineCnt.toString(),
        "--grp-cnt": grpCnt.toString(),
        "--optical-width": dim.opticalWidth.toString(),
      }}
    >
      {linesEl}
    </svg>
  );
}

function segmentBefore<T, S>(
  data: T[],
  pred: (x: T, idx: number) => boolean,
  incr: (x: T, idx: number) => void,
  decorate: (seg: T[]) => S,
): S[] {
  if (data.length === 0) return [];

  const segments: S[] = [];
  let cur: T[] = [data[0]];
  incr(data[0], 0);

  data.slice(1).forEach((x, idx) => {
    if (pred(x, idx + 1)) {
      segments.push(decorate(cur));
      cur = [];
    }
    cur.push(x);
    incr(x, idx + 1);
  })
  segments.push(decorate(cur));

  return segments;
}

export function render(
  line: TitleResp,
  maxWidth: number = Infinity,
): [WidthLine[], RenderDimensions] {
  let lineWidth = 0;
  let lineOpticalWidth = 0;
  const widthLines: WidthLine[] = segmentBefore(
    line.groups,
    (grp) => !grp.text.match(/^ +$/) && lineWidth + grp.hadv > maxWidth,
    (grp) => {
      lineWidth += grp.hadv;
      if (!grp.text.match(/^ +$/)) lineOpticalWidth = lineWidth;
    },
    (line) => {
      const ret = {
        optWidth: lineOpticalWidth,
        fullWidth: lineWidth,
        line,
      };
      lineWidth = 0;
      lineOpticalWidth = 0;
      return ret;
    },
  );

  const dimensions = {
    totalWidth: widthLines.reduce((acc, line) => acc + line.fullWidth, 0),
    opticalWidth: widthLines.reduce(
      (acc, line) => Math.max(acc, line.optWidth),
      0,
    ),
    lineCnt: widthLines.length,
  };

  return [widthLines, dimensions];
}

export function getStrokeDist(stroke: SVGPathElement, size: number): number {
  const bbox = stroke.getBoundingClientRect();
  const parentBbox = stroke.parentElement!.getBoundingClientRect();
  const inGrpXdiff =
    stroke.parentElement!.style.getPropertyValue("--in-grp-xdiff");
  const grpXdiff =
    stroke.parentElement!.parentElement!.style.getPropertyValue(
      "--grp-xdiff",
    );
  console.log(inGrpXdiff, grpXdiff, bbox, parentBbox);
  return (
    bbox.x -
    parentBbox.x +
    (parseFloat(inGrpXdiff) + parseFloat(grpXdiff)) * size
  )
}
