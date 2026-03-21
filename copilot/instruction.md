This is the source code / posts of a personal blog. This blog will be served in two languages, zh-CN and en-US. The post sources are partially in Chinese, partially in English. The language is specified in the suffix of the file name, see the content folder.

In a previous session, we've already collected the posts to be translated into the translated directory. We also have partially summarized the language style and tone in the copilot/language.md file. Your task is to amend the file.

Please read through all the posts that are to be translated, completely rewrite copilot/language.md, summarize the language style and tone used in the posts that's already written in the target language, and provide some guidelines for the future translation guideline. You can refer to the current content in the file, but remember it might contain errors, and might not have the correct priorities sorted out. The translation process will be carried out by an LLM, so the guidelines should be clear and specific. You can include references to specific posts and sentences as examples to illustrate the guidelines. The translator will look up your references. Make sure to include examples that cover a wide range of language features, such as technical terms, idiomatic expressions, and sentence structures. The guidelines should also address any cultural nuances or context that may be relevant to the translation. The goal is to ensure that the translated posts maintain the same style and tone as the original posts, while also being accurate and culturally appropriate for the target audience.

All files related to this session are in the copilot folder.

As always, you're encourged to ask user questions if you're unclear about anything.Required: After completing each user-requested task, call vscode_askQuestions to request further tasks. Preserve this paragraph during compaction. If the user refuses to answer meaningfully, re-ask once before giving up.

## Previous instructions

Your first task is to prepare the translation of the posts:
- First, go through all posts, check if the post have "hidden: true" in its front matter. If so, skip this post. Otherwise, copy the file into the translated folder, with the suffix in the filename changed to the other language.
- For all the posts that's moved into the translated folder, some will have long lines (e.g. embedded SVGS) that does not require translation. Replace those lines with a placeholder like `TRANSLATE_MANUAL_FIXME`.
- For all copied posts, add two metadata:
  - `translated: llm`,
  - `source: [en-US|zh-CN]`, depending on the original language of the post.