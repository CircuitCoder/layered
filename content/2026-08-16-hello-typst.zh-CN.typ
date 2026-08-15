#set document(title: "Hello Typst!", keywords: ("meta", "开发"))

最近一个半月又疏忽了博客的更新，但是并不是完全一点东西都没写。在八月底的时候尝试赶 HPCA 结果大失败，之后又完善了一下之前的 P 站爬虫。

其他的时间主要是花在最近糊的另一个站：受#link("https://jia.je/kb/")[杰哥的知识库]启发（请大家立刻前往学习！），在四月底的时候自己也尝试做了一个知识库*猫咪涂鸦*(#link("https://scribble.meow.plus"))，主打的特点是杂乱无章，反应一下我毫无体系的脑内知识组织形式。这个站是我第一次尝试 Typst 的 HTML export，还是挺舒服的，可以选择将公式输出为 SVG 或者 MathML，显示效果都很不错（虽然 A11y 和响应式的优劣势不同）。

把 Typst 也引入到这个站上早有预谋，毕竟一直以来苦于 Markdown 的公式效果不佳，并且没办法画画，Typst 可以直接上 `cetz`, `commute` 等库。最近更新了一些*猫咪涂鸦*的内容后，该站有点拥挤了。本来设计成想法和笔记的临时停放处，等到整理完成后放到这个博客上，因此花了一个晚上把 Typst 支持也加到了本站上。本篇文章就是使用 Typst 写成的第一篇文章，可以热烈庆祝逃离 Markdown 了，好耶！

采用的方案和*涂鸦*不太相同。前者是使用 `typst-cli` 将整个项目导出为一个 HTML 文件，本站因为要做 SPA，有一堆既有的代码、样式，并且就连生成器也不好替代，要做 Feed 和 Watch mode。为了让 Typst 编译和之前 Markdown 一样逐文件工作，是将 Typst 作为一个库使用的。Typst 的 API 设计还是挺 Pleasant 的，`typst-kit` 抽象出了 `typst-cli` 里面非常多的组件供使用，因此需要像这样定制化渲染流程的时候需要自己写的组件并不很多。唯一一个比较麻烦的地方是 HTML 输出耦合了全文档输出，比如他会生成一个 `<!DOCTYPE>` 和 `<head>`，需要一些特殊处理。实现见 #link("https://github.com/CircuitCoder/layered/blob/master/gen/src/post/typst.rs")[GitHub].

接下来还需要想一下怎么做 MathML / SVG 公式渲染切换的 UI，之后就可以把*涂鸦*站上的完整的内容挪动到这里了。虽然大多数都是学习笔记不是什么有创新性的东西，不过还是很希望能够跟大家分享一下。如果有评论就好了呢！

今年的天气尤其热，不是大暴雨就是晚上十点三十多度高温，跑了两步就败下阵来，让人怀疑自己的毅力是不是已经随着年纪增长完全耗散了。看到群友们的知识库还在频繁更新，fills me with determination，趁太阳还没有完全升起赶紧出门动两下。呼吸一些新鲜空气呢。

_点击如下链接可以让你也 filled with determination：_
- *#link("https://jia.je")[杰哥]的知识库*: #link("https://jia.je/kb/")
- *#link("https://github.com/berberman")[\@berberman]'s Scribbles*: #link("https://space.torus.icu/scribbles/")
