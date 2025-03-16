import { NONAME } from "node:dns";
import { RenderDimensions, WidthLine } from "../font";
import { BBox } from "../typings/BBox";
import { Constant, TransitionValue } from "./transition";

type PrerenderedStroke = {
  size: number;
  // Drawn with offsets because of the canvas coordinate system
  img: OffscreenCanvas;
}

type Stroke = {
  blur: TransitionValue;
  opacity: TransitionValue;
  size: TransitionValue;
  offsetX: TransitionValue;
  offsetY: TransitionValue;

  path: Path2D;
  bbox: BBox;
}

const SIDE_BEARING = 10;

function commitStroke(ctx: CanvasRenderingContext2D, stroke: Stroke, t: number) {
  const offsetX= stroke.offsetX.evalAt(t);
  const offsetY= stroke.offsetY.evalAt(t);

  const size = stroke.size.evalAt(t);

  // Drawing
  ctx.save();
  ctx.globalAlpha = stroke.opacity.evalAt(t);
  ctx.filter = `blur(${stroke.blur.evalAt(t)}px)`;
  ctx.translate(offsetX, offsetY);
  ctx.scale(size, size);
  ctx.fill(stroke.path);
  ctx.restore();
}

// TODO: dry run to figure out the size of the canvas
export type TextPack = {
  lines: WidthLine[],
  dims: RenderDimensions,
}

export function initRender(
  lines: WidthLine[],
  lineHeight: number,
  baseline: number,
  size: number,
): Stroke[] {
  return lines.flatMap((line, lineIdx) => {
    const lineY = baseline + lineIdx * lineHeight;
    const lineX = 0; // TODO: centering

    let x = lineX;
    return line.line.flatMap((grp): Stroke[] => {
      let chrX = x;
      const ret = grp.chars.flatMap((chr): Stroke[] => {
        const ret = chr.components.map((comp): Stroke => {
          return {
            blur: new Constant(0),
            opacity: new Constant(1),
            size: new Constant(size),
            offsetX: new Constant(chrX),
            offsetY: new Constant(lineY),

            path: new Path2D(comp),
            bbox: chr.bbox, // FIXME: this is an super conservative estimation
          }
        });

        chrX += chr.hadv * size;
        return ret;
      });

      x += grp.hadv * size;
      return ret;
    });
  });
}

export function commitStrokes(strokes: Stroke[], ctx: CanvasRenderingContext2D, t: number) {
  for (const stroke of strokes)
    commitStroke(ctx, stroke, t);
}
