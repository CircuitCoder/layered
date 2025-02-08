import path from 'node:path';
import fs from 'node:fs/promises';

type Bootstrap = (register: (key: string, value: string) => void, initPath: string) => Promise<void>;

// @ts-ignore
const { bootstrap, reset } = await import('./dist/server/main.js') as { bootstrap: Bootstrap, reset: () => void };

async function renderPath(path: string) {
  console.log(`Rendering ${path}...`);
  let tmpl = await fs.readFile('./dist/client/index.html', 'utf-8');
  await bootstrap((key, value) => {
    if(key.startsWith(':')) {
      // Special keys
      // TODO: assert special keys cannot occur more than one time
      if(key === ':title') tmpl.replace(/<title>.*<\/title>/, `<title>${value}</title>`);
      else if(key === ':backlink') tmpl = tmpl.replace(/<\/head>/, `<meta name="giscus:backlink" href="${value}"></head>`);
      else if(key === ':data-view') tmpl = tmpl.replace(/<root /, `<root data-view="${value}" data-prerendered="${value}"`);
      else console.log('Unknown special key:', key);
    } else {
      // This is a little of a type hack, because value is actually string
      const valueStr = value as unknown as string;
      tmpl = tmpl.replace(`<!-- SSR: ${key} -->`, valueStr);
      tmpl = tmpl.replace(new RegExp(`<!-- SSR: ${key}\\[ -->[\\s\\S]*<!-- SSR: ${key}\\] -->`, 'm'), valueStr);
    }
  }, path);
  await fs.writeFile(`./dist/render${path === '/' ? '/index' : path}.html`, tmpl);
  reset();
}

async function work() {
  // Mkdirs
  await fs.mkdir('./dist/render', { recursive: true });
  await fs.mkdir('./dist/render/post', { recursive: true });

  // TODO: move about into dynamic rendering, so we can also render about

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
