export type Locale = 'zh-CN' | 'en-US';

export type TagDef = {
  name: string,
  desc: string,
}
export type TagsDef = Record<string, TagDef>;

import { default as TagsZhCN } from './assets/tags/zh-CN.yml';
import { default as TagsEnUS } from './assets/tags/en-US.yml';
export const Tags: Record<Locale, TagsDef>  = {
  'zh-CN': TagsZhCN,
  'en-US': TagsEnUS,
}