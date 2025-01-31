import fetch from 'node-fetch';
import process from 'process';
import fs from 'fs/promises';

const base = process.argv[2];

async function fetchPage(pn) {
  console.log(`Fetching page ${pn}`);
  const listReq = await fetch(`${base}/posts/${pn}`);
  const list = await listReq.json();
  return list;
}

async function fetchPost(url) {
  const postReq = await fetch(`${base}/post/${url}`);
  const post = await postReq.json();
  const publish = new Date(post.post_time);
  const md = `---
title: ${post.topic}
tags: ${post.tags.join(', ')}
force_publish_time: ${publish.toISOString()}
force_update_time: ${new Date(post.update_time).toISOString()}
---

${post.content}
`;
  const month = (publish.getMonth()+1).toString().padStart(2, '0');
  const date = publish.getDate().toString().padStart(2, '0');
  const prefix = `${publish.getFullYear()}-${month}-${date}`;
  const filename = `${prefix}-${post.url}.md`;

  console.log(`Writing ${post.url}`);
  await fs.writeFile(filename, md);

  return post;
}

async function work() {
  let posts = [];
  let pn = 1;
  while(true) {
    const l = await fetchPage(pn);
    posts = posts.concat(l.posts);
    if(!l.hasNext) break;

    pn += 1;
  }

  // console.log(posts);
  await Promise.all(posts.map(p => fetchPost(p.url)));
}

work();
