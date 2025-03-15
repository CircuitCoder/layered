import { BBox } from "../typings/BBox";
import { TransitionValue } from "./transition";

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

function renderStroke(path: string, bbox: BBox, size: number): PrerenderedStroke {
  const p2d = new Path2D(path);
  const canvas = new OffscreenCanvas(100, 100);
  const 
}
