type classDefSingle = string | { [key: string]: boolean };
type classDef = classDefSingle | classDefSingle[];
type styleDef = string | { [key: string]: any };

export type JSXData = {
  class?: classDef,
  style?: styleDef,
  [other: string]: any,
} | null;

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

type RecursiveElement = Element | string | boolean | null | undefined | RecursiveElement[];
type NonrecursiveElement = Element | string;

type RecursiveElementSSR = string | boolean | null | undefined | RecursiveElementSSR[];

function flatten(e: RecursiveElement[]): NonrecursiveElement[] {
  return e.filter(e => !!e).flatMap(e => {
    if(Array.isArray(e)) return flatten(e);
    else if(e === true) return ['true'];
    return [e];
  }) as NonrecursiveElement[];
}

function flattenSSR(e: RecursiveElementSSR[]): string[] {
  return e.filter(e => !!e).flatMap(e => {
    if(Array.isArray(e)) return flattenSSR(e);
    else if(e === true) return ['true'];
    return [e];
  }) as string[];
}

export function jsxFactory(ns?: string): (tag: string, data: JSXData, ...children: RecursiveElement[]) => Element {
  return (tag, data, ...children) => {
    const el = ns !== undefined ? document.createElementNS(ns, tag) : document.createElement(tag);
    if(data?.class !== undefined) el.setAttribute("class", evalClassDef(data.class));
    if(data?.style !== undefined) el.setAttribute('style', evalStyleDef(data.style));
    if(data !== null) for(const key in data) {
      if(key === 'class' || key === 'style') continue;
      el.setAttribute(key, data[key]);
    }
    el.append(...flatten(children));
    return el;
  }
}

export function jsxFactorySSR(ns?: string): (tag: string, data: JSXData, ...children: RecursiveElementSSR[]) => string {
  return (tag, data, ...children) => {
    let str = ns !== undefined ? `<${tag} xmlns="${ns}"` : `<${tag}`;

    if(data?.class !== undefined) str += ` class="${evalClassDef(data.class)}"`;
    if(data?.style !== undefined) str += ` style="${evalStyleDef(data.style)}"`;
    if(data !== null) for(const key in data) {
      if(key === 'class' || key === 'style') continue;
      str += ` ${key}="${data[key]}"`;
    }
    str += '>';
    str += flattenSSR(children).join('');
    str += `</${tag}>`;
    return str;
  }
}


const SSR = import.meta.env.SSR;
const factory = SSR ? jsxFactorySSR : jsxFactory;
export const jsx = factory();
export const jsxSVG = factory('http://www.w3.org/2000/svg');

export namespace jsx {
  export namespace JSX {
    export type Element = HTMLElement;
    export interface IntrinsicElements {
      // TODO: restrict to HTML elements
      [elemName: string]: JSXData;
    }
  }
}

export namespace jsxSVG {
  export namespace JSX {
    export type Element = SVGElement;
    export interface IntrinsicElements {
      // TODO: restrict to HTML elements
      [elemName: string]: JSXData;
    }
  }
}