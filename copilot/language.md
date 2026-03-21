# Translation Style Guide for layered

This document is for preparing human-quality LLM translations of the posts under `translated/`.

The blog already has a recognizable voice in both languages, but the two corpora are not symmetric:

- Existing `en-US` posts are mostly technical, with dry humor and a strong first-person voice.
- Existing `zh-CN` posts cover both technical writing and personal / reflective writing, and the tone range is wider.

Use the target-language corpus as the primary style anchor. Do not translate literally if literal translation would flatten the voice, break an idiom, or make the prose sound unlike the existing posts.

## Global rules

- Preserve Markdown structure, headings, blockquotes, footnotes, HTML blocks, math, code fences, inline code, and link targets.
- Do not translate code, commands, API names, equations, URLs, commit hashes, filenames, or standard library / framework identifiers.
- `TRANSLATE_MANUAL_FIXME` marks long blob lines that were intentionally stripped out before machine translation. Leave those markers in place for later manual repair.
- Do not turn the posts into product copy, documentation copy, or polished magazine prose. The house style is personal, sharp, and a little uneven on purpose.
- Keep the author visible. These posts are frequently written in first person, with explicit judgments, side comments, and small jokes.
- Preserve mixed register. Technical explanation and casual commentary often live in the same paragraph.

## Target: en-US

### Core voice

The existing English posts are direct, technically precise, and conversational. They usually start from a concrete claim, then walk forward step by step. The prose is not stiffly academic. It often uses `we` for shared reasoning and `I` for personal judgment.

Representative examples:

- [Determining the "direction" of a vector shape](../content/2025-06-25-vector-pca.en-US.md): "First we need to figure out what is a stroke and what is a \"direction\"." This is the normal explanatory rhythm: define the problem, then refine it.
- [pause() is not enough for scroll-driven animations](../content/2025-06-30-view-timeline-pause.en-US.md): "Pausing is not enough" and "Luckily, for web animations, we can easily _sychronously_ apply the current computed style..." Strong topic sentence first, then practical reasoning.
- [A race condition in QReadWriteLock](../content/2026-01-02-qreadwritelock-race.en-US.md): "brought me on a magical journey" and "the cursed nature of weak memory ordering." Technical writing is allowed to be playful.
- [Advanced waiting for processes on Windows for showing off on Steam](../content/2025-10-13-wait-for-process-ex.en-US.md): "friendly remind your friends that you are doing hard work™". Jokes are short, dry, and embedded in otherwise useful prose.
- [FIFO on Single Port SRAM](../content/2025-11-30-single-port-sram-fifo.en-US.md): "Let's now try to introduce some other features..." The author often guides the reader through the argument in real time.
- [Misc. Notes on Writing a TUN/TAP Device](../content/2026-02-20-tun-misc.en-US.md): "The Internet™ is a dangerous place" and "I'm lazy, so only option 3 for me." Casual aside, then back to substance.

### What to preserve when translating into English

- Keep the prose concrete. Prefer "Here is the problem" over abstract framing like "This article seeks to discuss...".
- Split very long Chinese sentences when needed, but preserve the logical flow and momentum.
- Use natural English technical wording, not word-for-word calques from Chinese. If the source says something like "正常人这个时候应该都去用...", translate the force of the joke, not the exact words.
- Keep the authorial asides. Parenthetical remarks, short jokes, and ironic qualifiers are part of the voice.
- Let the English stay slightly informal. Contractions, rhetorical questions, and short punch lines are normal.
- Use `we` when the source is walking the reader through an argument. Use `I` for personal taste, travel, reflection, complaint, or opinion.

### What not to do in English

- Do not over-formalize into textbook English.
- Do not flatten sarcasm into neutral explanation.
- Do not translate internet-native expressions literally if a natural English equivalent exists.
- Do not add extra explanation everywhere. If the original trusts the reader, the translation should too.

### English diction and rhythm

- Prefer strong section openings. Example: "Pausing is not enough".
- Prefer explicit causal steps: "This means...", "Therefore...", "However...", "Now...".
- Short standalone sentences are welcome after dense paragraphs.
- A small amount of deliberate understatement works better than exaggerated slang.

### Handling humor and cultural references in English

- Keep jokes dry and close to the sentence that carries the information.
- Translate Chinese internet slang by function, not literally.
  - `太香了` usually means "too good not to use", "too nice", or "too tempting" depending on context.
  - `搞点灵的` usually means "do something clever", "pull a trick", or "cheat a little" in a playful tone.
  - `群友` is usually "friends in the group chat/server", not "group friends".
  - `安利` is usually "recommend" or "sell people on", depending on tone.
  - `大厂` is usually "big tech company" or "major tech company", not "big factory".
- Keep local references specific. Do not erase Beijing subway lines, railway stations, TUNA, Bilibili, or other named context. Add a tiny gloss only if the sentence becomes opaque without it.
- If a Chinese post uses meme-like exaggeration, translate to an English equivalent with similar restraint. Avoid turning it into loud social-media English unless the source is already loud.

### Personal / reflective posts into English

There are fewer existing English personal essays, so extrapolate from the technical corpus carefully:

- Keep the first-person presence strong.
- Prefer concrete scenes over ornate abstraction.
- Preserve restrained melancholy when it exists; do not romanticize further.
- Do not sand away sudden tonal turns. A reflective paragraph may end with a joke, and that should survive.

Useful Chinese references for this mode:

- [在铁轨上](../content/2025-04-04-on-railroad.zh-CN.md): detailed sensory memory, then an abrupt funny postscript.
- [玩了 Clair Obscur: Expedition 33](../content/2026-01-10-about-expedition-33.zh-CN.md): long personal evaluation that moves freely between sincerity, jokes, and technical / media vocabulary.

## Target: zh-CN

### Core voice

The existing Chinese posts are highly recognizable: colloquial, internet-native, judgment-heavy, and often playful even when the topic is technical. The prose frequently mixes Chinese with English technical terms, brand names, and borrowed internet expressions. This should be preserved.

Representative examples:

- [使用 JSX 直接创建 DOM 元素](../content/2025-03-18-jsx-dom.zh-CN.md): "JSX 语法实在是太香了。" and "不过我们可以搞点灵的。" This is the house style in one shot: strong opinion, spoken rhythm, then a playful pivot.
- [Open Graph on C3Meow](../content/2019-03-15-implementing-open-graph.zh-CN.md): sarcasm through faux praise, e.g. "显然是非常原创的想法" and "充分体现了 Facebook 大厂在工程上的取舍能力".
- [玩了 Clair Obscur: Expedition 33](../content/2026-01-10-about-expedition-33.zh-CN.md): Chinese prose freely mixing English media terms, memes, and serious commentary.
- [在铁轨上](../content/2025-04-04-on-railroad.zh-CN.md): long reflective sentences full of concrete details, then a deliberately abrupt punch line at the end.
- [扔番茄](../content/2025-04-03-tomato.zh-CN.md): even code-heavy posts still sound casual and mischievous.

### What to preserve when translating into Chinese

- Keep the spoken, blog-like rhythm. It should sound like a sharp person talking, not filing a report.
- Preserve the mixture of Chinese and English technical terms when that is the natural style.
- Keep explicit judgment words such as `实在`, `确实`, `显然`, `很遗憾`, `不过`, `然而`, `总之` where the source calls for them.
- Preserve rhetorical pivots. A paragraph often turns with a short sentence like `不过我们可以搞点灵的。`
- Short joke sentences after dense explanation are part of the pacing.
- Personal posts should stay sensory and concrete. The emotional effect often comes from detail, not overt self-analysis.

### What not to do in Chinese

- Do not translate into formal written Mandarin unless the source is already formal.
- Do not force every technical term into Chinese if the existing corpus would normally keep it in English.
- Do not clean up all slang, irony, or meme phrasing.
- Do not make the Chinese uniformly elegant. The voice benefits from rough edges and sudden gear shifts.

### Chinese diction and register

- Keep standard technical English tokens when the corpus already does so: `SSR`, `JSX`, `VDOM`, `SeqCst`, `No-op`, `Acquire`, `Release`, `TSO`, `Rust`, `Vue`, `Webpack`, `Telegram`, `Steam`, and so on.
- Translate the connective tissue around those tokens into natural Chinese.
- When an English sentence is jokingly blunt, do not soften it too much.
- Colloquial emphasis is welcome, but avoid overdoing current slang that may date the post more than the source does.

### Handling humor and cultural references in Chinese

- Keep sarcasm sharp. If the source mocks something by pretending to praise it, preserve that structure.
- English jokes can be localized into natural Chinese instead of translated literally.
- If a reference is already familiar to the likely readership, do not over-explain it.
- If the source uses a meme-ish phrase, match the intensity, not the exact wording.

Some common choices:

- "cursed" is often better as `邪门`, `灵车`, or a context-specific joking phrase, not literally `被诅咒的`.
- "too good not to use" may map to `太香了`, `太好用了`, or `很难不用` depending on tone.
- "I'm lazy" is usually better as `我懒得...`, `我比较懒`, or `图省事` depending on context.
- "magical journey" in a debugging context may need a mildly ironic rendering like `离谱的 debug 之旅` rather than a grand literal translation.

Additional translation note for the actual post-by-post translation phase:
- Watch for puns, alternate readings, mixed-language jokes, or layered expressions that are not fully translatable as plain prose. In this repo they often show up as `<ruby>...</ruby>` constructs with `rt/rp`, but can also appear as parenthetical glosses or deliberately doubled expressions.
- Common examples include things like `流浪猫 / LLM`, `networking / 网络原理`, ironic ruby text such as `良心 / 毒瘤`, Japanese reading jokes, and nickname-style glosses like `小甜嘴 / 能量胶`.
- In these cases, it is acceptable to preserve the original expression and carry the second layer with ruby tags or parentheses instead of flattening the joke into a single literal translation.
- When the target-language wording is already more natural, you may also keep that target wording as the visible text and move the source-side pun or gloss into ruby or parentheses.
- Before finalizing each translated post, actively look for other similar constructs and handle them consistently.

### Personal / reflective posts into Chinese

When translating English posts with personal commentary into Chinese, the target style should still feel like this blog's Chinese voice, not generic essay Chinese.

- Concrete details first, interpretation second.
- Allow slightly long rolling sentences when the scene is being built.
- Preserve sudden tonal breakage if the source pivots into a joke or aside.
- Use familiar Chinese blog / forum rhythm when appropriate, but do not force slang into places where the source is calm.

Useful references:

- [在铁轨上](../content/2025-04-04-on-railroad.zh-CN.md): for memory, travel, and quiet melancholy.
- [玩了 Clair Obscur: Expedition 33](../content/2026-01-10-about-expedition-33.zh-CN.md): for long-form opinionated commentary with mixed media / technical vocabulary.

## Structure, formatting, and terminology

- Keep heading levels unchanged.
- Preserve HTML tags such as `<figure>`, `<figcaption>`, `<small>`, `<del>`, `<ruby>`, and footnote blocks.
- Translate link text if the link text is human-language prose, but do not change the URL.
- Do not translate code comments inside code blocks unless the entire block is clearly prose-like and meant for reading rather than execution. When in doubt, leave code blocks unchanged.
- Keep equations and symbolic notation untouched.
- Preserve list shape unless the target language becomes genuinely unreadable.

## Final bias to remember

When choosing between literal fidelity and voice fidelity, prefer the version that sounds like this blog, as long as it remains accurate.

The posts are written by one person, not by a committee. The translation should preserve that.