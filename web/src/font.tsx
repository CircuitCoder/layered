import { CharResp } from "./typings/CharResp";
import { TitleResp } from "./typings/TitleResp";
import { jsxSVG as jsx } from "./jsx";

type RenderDimensions = {
  totalWidth: number;
  opticalWidth: number;
  lineCnt: number;
}

function isContinous(thunk: string, incoming: string): boolean {
  if(incoming === ' ') return !!thunk.match(/^ +$/);
  else if(thunk.match(/[0-9]/)) return !!thunk.match(/^[0-9]+$/);
  else if(thunk.match(/[a-zA-Z]/)) return !!thunk.match(/^[a-zA-Z]+$/);
  else return false;
}

type WidthGroup = {
  width: number;
  text: string;
  group: CharResp[];
};

type WidthLine = {
  optWidth: number;
  fullWidth: number;
  line: WidthGroup[];
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

      const chrs = grp.group.map(chr => {
        const glyph = <g class="glyph" style={{
          '--in-grp-xdiff': grpAccum.toString() + 'px',
        }}>
          {chr.components.map(comp => <path d={comp}></path>)}
        </g>;
        grpAccum+= chr.hadv;
        return glyph;
      });

      const grpEl = <g class="var-group" style={{
        '--local-grp-idx': localGrpIdx.toString(),
        '--grp-idx': grpCnt.toString(),
        '--grp-line-xdiff': lineAccum.toString() + 'px',
        '--grp-width': grp.width.toString(),
        '--grp-xdiff': globalXdiff.toString() + 'px',
      }} data-text={grp.text}>{chrs}</g>;

      lineAccum += grp.width;
      globalXdiff += grp.width;
      ++grpCnt;

      return grpEl;
    });

    return <g class="line" style={{
      '--line-idx': lineIdx.toString(),
      '--line-optical-width': line.optWidth.toString(),
    }}>
      {grps}
    </g>
  });

  return <svg class={["title", ...additionalClasses]} style={{
    '--line-cnt': dim.lineCnt.toString(),
    '--grp-cnt': grpCnt.toString(),
    '--optical-width': dim.opticalWidth.toString(),
  }}>
    {linesEl}
  </svg>;
}

function segmentBefore<T, S>(
  data: T[],
  pred: (x: T) => boolean,
  incr: (x: T) => void,
  decorate: (seg: T[]) => S,
): S[] {
  if(data.length === 0) return [];

  const segments: S[] = [];
  let cur: T[] = [data[0]];
  incr(data[0]);

  for(const x of data.slice(1)) {
    if(pred(x)) {
      segments.push(decorate(cur));
      cur = [];
    }
    cur.push(x);
    incr(x);
  }
  segments.push(decorate(cur));

  return segments;
}

export function render(line: TitleResp, maxWidth: number = Infinity): [WidthLine[], RenderDimensions] {
  let grpText = '';
  let grpWidthAcc = 0;

  const widthGroups: WidthGroup[] = segmentBefore(
    line.chars,
    chr => grpText !== '' && !isContinous(grpText, chr.char),
    chr => {
      grpText += chr.char;
      grpWidthAcc += chr.hadv;
    },
    grp => {
      const ret = {
        text: grpText,
        width: grpWidthAcc,
        group: grp,
      };
      grpText = '';
      grpWidthAcc = 0;
      return ret;
    }
  );

  let lineWidth = 0;
  let lineOpticalWidth = 0;
  const widthLines: WidthLine[] = segmentBefore(
    widthGroups,
    grp => !grp.text.match(/^ +$/) && lineWidth + grp.width > maxWidth,
    grp => {
      lineWidth += grp.width;
      if(!grp.text.match(/^ +$/)) lineOpticalWidth = lineWidth;
    },
    line => {
      const ret = {
        optWidth: lineOpticalWidth,
        fullWidth: lineWidth,
        line,
      };
      lineWidth = 0;
      lineOpticalWidth = 0;
      return ret;
    }
  );

  const dimensions = {
    totalWidth: widthLines.reduce((acc, line) => acc + line.fullWidth, 0),
    opticalWidth: widthLines.reduce((acc, line) => Math.max(acc, line.optWidth), 0),
    lineCnt: widthLines.length,
  };

  return [widthLines, dimensions];
}