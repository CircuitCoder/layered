import path from 'node:path';
import fs from 'node:fs/promises';

type Bootstrap = (register: (key: string, value: string) => void, initPath: string) => Promise<void>;

// @ts-ignore
const { bootstrap } = await import('./dist/server/main.js') as { bootstrap: Bootstrap };

async function renderPath(path: string) {
  console.log(`Rendering ${path}...`);
  let tmpl = await fs.readFile('./dist/client/index.html', 'utf-8');
  await bootstrap((key, value) => {
    if(key.startsWith(':')) {
      // Special keys
      if(key === ':title') tmpl.replace(/<title>.*<\/title>/, `<title>${value}</title>`);
      else console.log('Unknown special key:', key);
    } else {
      // This is a little of a type hack, because value is actually string
      const valueStr = value as unknown as string;
      tmpl = tmpl.replace(`<!-- SSR: ${key} -->`, valueStr);
    }
  }, path);
}

async function work() {
  // Prerender root
  await renderPath('/');

  // Render all posts
  for(const post of await fs.readdir('../content')) {
    const filename = path.basename(post, '.md');
    const [_, slug] = filename.match(/^\d{4}-\d{2}-\d{2}-(.*)$/)!;
    await renderPath(`/post/${slug}`);
  }
}

work().catch(console.error);