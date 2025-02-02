type classDefSingle = string | { [key: string]: boolean };
type classDef = classDefSingle | classDefSingle[];
type styleDef = string | { [key: string]: any };

export type JSXData = {
  class?: classDef,
  style?: styleDef,
  [other: string]: any,
}

function evalClassDefSingle(def: classDefSingle): string {
  if(typeof def === 'string') return def;
  else return Object.keys(def).filter(key => def[key]).join(' ');
}

function evalClassDef(def: classDef): string {
  if(Array.isArray(def)) return def.map(evalClassDefSingle).join(' ');
  else return evalClassDefSingle(def);
}

function evalStyleDef(def: styleDef): string {
  if(typeof def === 'string') return def;
  else return Object.keys(def).map(key => `${key}: ${def[key]}`).join('; ');
}

export function jsx(tag: string, data: JSXData, ...children: (HTMLElement | string)[]): HTMLElement {
  const el = document.createElement(tag);
  if(data.class !== undefined) el.className = evalClassDef(data.class);
  if(data.style !== undefined) el.setAttribute('style', evalStyleDef(data.style));
  for(const key in data) {
    if(key === 'class' || key === 'style') continue;
    el.setAttribute(key, data[key]);
  }
  el.append(...children);
  return el;
}

export namespace jsx {
  export namespace JSX {
    export type Element = HTMLElement;
    export interface IntrinsicElements {
      // TODO: restrict to HTML elements
      [elemName: string]: JSXData;
    }
  }
}