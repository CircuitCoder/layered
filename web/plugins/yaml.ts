import type { Plugin } from 'vite';
import { parse } from 'yaml';
import tosource from 'tosource';

export default (): Plugin => ({
  name: 'vite:transform-yaml',
  async transform(code: string, id: string) {
    if (!id.endsWith('.yaml') && !id.endsWith('.yml'))
      return null;

    const parsed = parse(code);

    return {
      code: `export default ${tosource(parsed)};`,
      map: { mappings: "" },
    };
  }
});