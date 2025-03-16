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

  path: string;
  bbox: BBox;

  prerendered: PrerenderedStroke | null;
}

const SIDE_BEARING = 10;
const MAX_SIZE = 72;

function prerenderStroke(path: string, bbox: BBox, size: number): PrerenderedStroke {
  const p2d = new Path2D(path);
  // Offset is (-bbox.left, -bbox.top)
  const width = bbox.right - bbox.left;
  const height = bbox.bottom - bbox.top;
  const canvas = new OffscreenCanvas(Math.ceil(width * size + SIDE_BEARING * 2), Math.ceil(height * size + SIDE_BEARING * 2));
  const ctx = canvas.getContext('2d')!;
  // TODO: figure out the order of these transformations
  ctx.translate(-bbox.left * size + SIDE_BEARING, -bbox.top * size + SIDE_BEARING);
  ctx.scale(size, size);
  ctx.fill(p2d);

  return {
    size,
    img: canvas
  }
}

function commitStroke(ctx: CanvasRenderingContext2D, stroke: Stroke, t: number) {
  if (stroke.prerendered === null)
    stroke.prerendered = prerenderStroke(stroke.path, stroke.bbox, MAX_SIZE * 2);

  const currentSize = stroke.size.evalAt(t);
  const scale = currentSize / (MAX_SIZE * 2);
  if(scale > 0.5)
    console.warn(`Potential insufficent scale: ${scale}, MAX_SIZE=${MAX_SIZE}, currentSize=${currentSize}`);

  // After scale, the origin goes to:
  const originXAt = (stroke.bbox.left * MAX_SIZE * 2 + SIDE_BEARING) * scale;
  const originYAt = (stroke.bbox.top * MAX_SIZE * 2 + SIDE_BEARING) * scale;

  const committedXAt = stroke.offsetX.evalAt(t);
  const committedYAt = stroke.offsetY.evalAt(t);
  
  const offsetX = committedXAt - originXAt;
  const offsetY = committedYAt - originYAt;

  // Drawing
  ctx.save();
  ctx.globalAlpha = stroke.opacity.evalAt(t);
  ctx.filter = `blur(${stroke.blur.evalAt(t)}px)`;
  ctx.drawImage(
    stroke.prerendered.img,
    offsetX, offsetY,
    stroke.prerendered.img.width * scale, stroke.prerendered.img.height * scale);
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

            path: comp,
            bbox: chr.bbox, // FIXME: this is an super conservative estimation
            prerendered: null,
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
