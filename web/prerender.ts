import path from "node:path";
import fs from "node:fs/promises";

type Bootstrap = (
  register: (key: string, value: string) => void,
  initPath: string,
) => Promise<void>;

const {
  bootstrap,
  listTags,
  reset,
  // @ts-ignore
} = (await import("./dist/server/main.js")) as {
  bootstrap: Bootstrap;
  listTags: () => Promise<string[]>;
  reset: () => void;
};

async function renderPath(path: string) {
  console.log(`Rendering ${path}...`);
  let tmpl = await fs.readFile("./dist/client/index.html", "utf-8");
  await bootstrap((key, value) => {
    if (key.startsWith(":")) {
      // Special keys
      // TODO: assert special keys cannot occur more than one time
      // TODO: render image based on og:title
      if (key === ":title")
        tmpl = tmpl.replace(/<title>.*<\/title>/, `<title>${value}</title>`);
      else if (key === ":backlink")
        tmpl = tmpl.replace(
          /<\/head>/,
          `<meta name="giscus:backlink" href="${value}"></head>`,
        );
      else if (key === ":prerendered")
        tmpl = tmpl.replace(/<root /, `<root data-prerendered="${value.replace(/"/g, '&quot;')}" `);
      else if (key.startsWith(":og:"))
        tmpl = tmpl.replace(
          /<\/head>/,
          `<meta property="${key.slice(1)}" content="${value.replace(/"/g, '&quot;')}"></head>`,
        );
      else console.log("Unknown special key:", key);
    } else {
      // This is a little of a type hack, because value is actually string
      const valueStr = value as unknown as string;
      tmpl = tmpl.replace(`<!-- SSR: ${key} -->`, valueStr);
      tmpl = tmpl.replace(
        new RegExp(
          `<!-- SSR: ${key}\\[ -->[\\s\\S]*<!-- SSR: ${key}\\] -->`,
          "m",
        ),
        valueStr,
      );
    }
  }, path);
  await fs.writeFile(
    `./dist/render${path === "/" ? "/index" : path}.html`,
    tmpl,
  );
  reset();
}

async function work() {
  // Mkdirs
  await fs.mkdir("./dist/render", { recursive: true });
  await fs.mkdir("./dist/render/post", { recursive: true });
  await fs.mkdir("./dist/render/tag", { recursive: true });

  // Prerender root
  await renderPath("/");
  await renderPath("/about");
  await renderPath("/tags");

  // Render all posts
  for (const post of await fs.readdir("../content")) {
    const filename = path.basename(post, ".md");
    const [_, slug] = filename.match(/^\d{4}-\d{2}-\d{2}-(.*)$/)!;
    await renderPath(`/post/${slug}`);
  }

  // Render all tags
  const tags = await listTags();
  for (const tag of tags) await renderPath(`/tag/${tag}`);
}

work().catch(console.error);
