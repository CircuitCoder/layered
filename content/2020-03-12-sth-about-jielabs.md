---
title: Sth. about JieLabs
tags: 开发
force_publish_time: 2020-03-12T03:49:07.946Z
force_update_time: 2020-03-16T21:04:17.885Z
---

最近和川川杰哥一起写了 JieLabs，在线进行数电实验。板子上的川川写的，我完全看不懂，后端和前端算法部分全靠杰哥，喵喵就写了几千行 CSS，基本没干活。虽然只写了 UI 有点内疚，但是摸鱼真爽啊。

杰哥's side: [https://jiege.ch/jielabs/](https://jiege.ch/jielabs/)

但是听说有人对前端 UI 我写的部分的实现感兴趣，还是蛮开心的。于是稍微写一点可能对前端入门有点帮助的知识？毕竟喵喵的前端水平也就业余。对于其他不打算学前端的同学们，以下是你不需要知道的 Somethings about JieLabs.

## 众所周知，CSS Transition 不应该用...

首先是<del>比较清楚的</del>部分: CSS Transition。

既然我们都是在写 CSS，我们就先不需要关心 JS 的事件循环啊，怎么算 Sytle set 啊之类的。因此我们需要关心的就是，DOM 确定不变，Style set 浏览器帮忙计算，究竟用什么属性来做 CSS Transition 又快又好还省电呢？

众所周知<sup>[来源请求?]</sup>，在浏览器里，这部分渲染一般实现为三个不同的阶段：

- Layout: 算位置，宽高
- Paint/Render: 画
- Composite: 叠加

一般而言，如果前两个阶段需要重新做，我们通常分别叫他们 Reflow, Repaint/Rerender。重新进行 Composite 没有单独的名字？我们通常叫他 Composite。

首先，Paint 依赖 Layout 的结果，要不然我们没办法知道特定绘制的参数（`background-size: cover` 时背景的缩放，`calc(100vw - 10%)` 究竟是几个像素，etc.)。Composite 依赖 Paint 的结果，Paint 的东西改变了之后需要重新混合。因此越靠上的阶段如果重新做了，需要把下面所有的事情都重新做一次。

此外，Reflow 是本身代价最高的操作，因为 Reflow 可能会涉及非常非常多的元素。比如这样的 HTML：

```html
<style>
  .animated {
    font-size: 18px;
    transition: font-size .2s ease;
  }
  .animated:hover {
    font-size: 24px;
  }
</style>
<div class="parent">
  <p class="animated">First paragraph <span>inner</span></p>
  <p>Second paragrapn</p>
</div>
```

`p.animated` 会在鼠标经过的时候变<span style="font-size: 24px">大</span>，这个变大是可能改变元素的大小的，所以当 `p.animated` 被撑大之后，`p.animated + p` 也需要 Reflow，之后把整个父元素也撑大了，所以 `.parent` 也需要 Reflow。同时因为 Style 的继承，`p.animated > span` 也会经历一遍相似的事情。如果是大段文字前面发生了某个元素 Reflow，场面就尤其壮观，因为算一个现代字体具体怎么画，在哪里换行，可能是很慢而且很难的事情。因此，如果发生了 Reflow，不需要区分到底是哪个元素 Reflow 了，因为其实大家都在 Reflow。

随后，当一大坨元素都 Reflow 完成了之后，他们还需要 Repaint，最后再 Composite，新画出来的东西还得都发给 GPU。

Paint 就安分很多，可以把这个元素单独拿出来，自己画自己的。但是画画这件事情其实也挺复杂的，比如画个字，浏览器一般自己都懒得做，全都丢给 OS，导致 Windows 上字体渲染水准和 macOS 比完全比不上（碎碎念）。因此这部分虽然不很慢，但是如果每帧都做，一般你能确保 20 FPS，具体上限在哪里看渲染面积和造化。

然后是 Composite，这步通常靠 GPU 加速一下，用各种 gl 直接叠起来就行了，而且只需要 Composite 变化了的部份，因此它是最快的。

根据刚刚的分析，越靠前的阶段，我们越不希望重做。所以我猜前两个之所以有名字，就是因为大家都在写博客，说

> Don't cause a reflow in CSS animation!

久而久之大家就都这么叫了。结果就是虽然大家整天都在导致重新 Composite，但是它却没有名字，稍微有点心疼。

说了这么多背景知识，到底能干什么呢？假设如果我们要让一个一个图片往下动，略加思索得到的 transition 选择包括：

- img { top }
- img { margin-top }
- div { background-position }
- img { transform }

前两者会导致 Reflow，即使你把它安排成一个 `position: fixed`，浏览器依旧决定 Reflow 一大堆元素，然后大家全部 Reapint。第三种会导致 Repaint，第四种只影响 Composite，因此它最快，而且最省电。

同样地，如果要改变一个字的透明度，可以通过 `color` 或者 `opacity`，如果能用后者永远是更好的。

At the time of writing，JieLabs 里用到的 Transition 属性统计如下：
```
> grep -r -h -oP -i --include \*.scss "^ *transition: [a-zA-Z\-]+" src | grep -h -oP -i "[a-zA-Z\-]*$" | sort | uniq -c | sort -n
      1 background-color
      1 border-color
      1 box-shadow
      1 color
      1 mask-position
      4 filter
     12 transform
     39 opacity
```

前四个会有 Repaint，其中第三个稍微贵一点，因为他要重新决定 Composite 的边界。剩下的理论上来说都可以在 Composite 时解决，但是好像 WebKit 没好好写 `mask-position` 的动画。可以理解，毕竟这个属性没啥人用。

除了 Transition 以外，动画里还有到了一个 clip-path，这个理论上来说应该可以在 Composite 的时候实现？但是 Chrome 好像也摸了。这个喵喵没有发现简单地办法看出来它有没有触发 Repaint，因为如果把 Repaint flash 打开，其实改变 style 也会闪烁，所以在 Composite 属性改变的时候也会绿绿绿。

> 吐槽： Chrome 好像会把 Composite 丢到另外一个后台线程上去做，然后如果 Tab 开太多，这个线程就会比较摸鱼，但是一打开 Profiler 它就不摸了，导致只有在 Profile 的时候跑得快（混乱邪恶：说明打开 Profiler 即可瞬间优化）

总体而言，为了达成常用的动画效果，喵喵的习惯是：
- 移动: `transform: translate`
- 强调 - 渐变: `transition: opacity`
- 渐变+隐藏: `transition: opacity`, 额外用 `pointer-events` 控制鼠标事件的捕捉
- 模糊: `filter: blur`
- 背景模糊: `backdrop-filter: blur` (这个在比较新的 Chrome 里支持了，动画也很流畅，但是在最新的 Windows Insider 上会把我的系统打绿屏)
- 颜色: 如果可能的话，用 `filter: hue-rotate`
- 背景渐变: 放一个 `:after { position: absolute; }`，然后在这个上面 `transition: opacity`
- 背景颜色改变: 放一个 `:after` 和一个 `:before`，然后控制 `:after` 的透明度
- 显示区域变化: `transition: clip-path` 或者 `mask-image + transtiion: mask-position`

剩下如果必须要发生 Repaint 了，一定不要改变定位属性，还有改变 bouding box 的那一堆东西（`margin`, `padding`, `top`, etc.)

## React rendering flow
老生常谈了。这次 JieLabs 在写的时候所有 React 组件都是用了 `React.memo` 的函数式组件，用了十万个 Hook，然后叠了个 Redux 管大范围分享的状态。

写了大半年 React，对 React 组件感觉上除了重用以外，另外还有作为渲染边界使用。在这里讨论 React 的渲染流，即 React component -> V-DOM 这部分。React 是单向向下的渲染流，如果一个组件发生重新渲染，它会通知 React 渲染自己的子组件，React 去拿渲染好的 Cached V-DOM 或者重绘，然后把渲染出来的结果返回。

React.memo 作为渲染边界的时候，决定一个子组件是否需要重新渲染是通过属性的 Weak equality。所以写这样的代码就基本 GG：

```html
<Component
  prop={list.map(mapper)}
  cb={e => { /* Literal callback */ }}
/>
```

即使 list 是个 immutable list 也一样，因为每次都吐了个新的 mapped list 出来。

一般而言这样的代码写在一个 HTML 元素上不会有大问题，因为反正每次渲染到底层都得重新算一遍 attribute，然后和 Cached V-DOM 比对，对于 Event listener 而言也不会直接注册到 DOM 上面，而是 React-dom 自己把自己的 Listener 注册上去，然后在里面再调用写在 JSX 里的 callback，所以也不会涉及 DOM 上 listener 的注册/注销。但是放到 Component 上，这么写肯定和上次渲染不满足 Weak equality，所以子组件一定会重绘，即使最后渲染出来结果一样。

那么怎么办呢？一个办法是所有东西都丢到 Redux 里，Redux 里面同时存原数据和一个 map 过的数据，用 Action 控制更新的原子性。此时，无论是用 connect 还是 useSelector，Redux 会帮忙通过一个 weak equality 决定是否需要通知重绘。

但是当然还是单一 source of truth 比较好，而且 Redux 里放太多组件自己的不需要持久化的状态就很怪。然后代码里就充满了 `useCallback`, `useMemo`, `useEffect` 之类的垃圾代码。只有这个时候想起了 Vue 的好，自动计算依赖图。当然有一些 Corner case 可以跳过一部分依赖图的节点进行优化，以及显式的决定各种 Hook 回调的通知顺序，这个时候 Vue 就没办法做这些。

当然，优化到最后就会涉及到状态改变但是不希望重绘的情况（例如 Canvas 正在被隐藏，有一个 `useLayoutEffect` 是用来画它的，希望暂时暂停）。这个时候感觉没有特别好的解决方法，只能把数据存到 `useRef` 里面，然后真的需要重新渲染的时候 `setXX(XXRef.current)`

## DOM patching
写 key 这种东西就不用说了，这里要吐槽一些东西。

DOM 本身是要带状态的，包括 class 导致的 CSS transition。由于 React 是把映射出来的 V-DOM 给 Patch 到 DOM 上。所以写这种代码，就算没写 key，也是可以显示出来一个 loading 类消失的过渡动画的:

```js
if(loading) return <div className="container loading" />;

return (
  <div className="container">
    { /* ... */ }
  </div>
);
```

但是用 Suspense 就不行，不知道为什么会不重用 DOM。可能 Suspense 是一套完全不同的渲染方法？

喵喵反正不太喜欢 Suspense 这种结构，如果以后有等待 Promise 的东西会好用一些。现在只有 `React.lazy` 加载组件好像没啥用（

## Initial load speed
怎么能够加载的快呢？Cache 是浏览器提供的好东西，但是我们能够通过 Service Worker，实现更加激进的缓存策略。

### Service worker
CRA 吐出来的模板自带一个 Workbox，稍微调教了一下让它能够从本地加载 Workbox 库，而不是隔着万里长城去找 Google CDN。

为了让加载比较快，选择的 Workbox 缓存策略非常激进，用 Local only，做 Pre-caching，包括 index.html 都从 Cache 返回。一般而言这样的行为会导致页面没办法更新，也就是就算 index.html 里面的 version string (文件名内的 hash 或者 query string) 发生改变，也不会被浏览器察觉。

解决更新问题的方法是在安装的时候加载一下 manifest。由于 manifest 和所有的 asset 文件名都有 hashing，如果服务器上的 asset 更新了，那么 service worker 的代码一定会变，这个时候让它在后台安装，预先下载好资源，然后显示一个刷新通知。

这样的设计的结果包括：

- 只有 Asset 更新的时候需要向服务器请求
- 只有第一次加载的时候，Asset 请求会阻塞渲染流

这个渲染流不只包括 DOM 渲染，也包括 React 的渲染。所有的字体都是用 Webpack 包了一下，因此除了第一次访问，以后每次刷新的时候应该都是瞬间加载的。

所以我们需要 Care 的就是第一次加载到渲染出有效内容之中，加载的内容。这分为两部分：加载出来“加载页面”，和 React 渲染出来有效内容。

### Critical style
浏览器一般（写Web的时候什么东西都是一般...）如果没有明确指定（defer），在加载 HTML 的时候同时渲染，其中同步加载、执行脚本，异步加载 `<link rel="stylesheet">`。这里加载、解析、执行脚本的时候需要阻塞接下来 HTML 的渲染，但是不会阻塞渲染线程本身。

所以如果我们认为一些 HTML 元素是需要在脚本加载、执行完成之前显示出来，需要把它写到 `<script>` 标签前面。

Webpack 会按照程序入口开始的依赖图，向 HTML 里注入一个或者多个 `<script>`，没有 `defer`。CRA 默认会把这些标签注入到 body 的结尾，因此我们在 body 开头写的 HTML 元素，是可以很快显示出来的。这个时间中，我们能控制的因素是这个标签前面的字节数。因此放的越靠前，加载出来更快。

麻烦的是样式表。一般而言，我们把初始显示时就需要的样式称为 Critical style，在静态页面中传统意义上指不滚动的第一屏中显示的内容需要的样式。

`<link>` 里的样式表永远异步加载，然后加载完成后应用新样式。所以为了保证样式是有效的，我们需要把这部分样式表内联到 `<style>` 标签里，这样可以保证样式表先于标签加载出来。

在 Webpack 里完成这件事也比较麻烦，`ExtractTextPlugin` 或者 `MiniCSSPlugin` 只会生成 `<link>` 标签，`style-loader` 会生成一个用 JS 注入的代码，喂这个要在 JS 加载开始之前就渲染好啊。

还好 `HTMLWebpackPlugin` 可以写 ejs 语法，而且可以干奇怪的事情：

```html
<style>
  <%= require('!!css-loader!sass-loader!../src/prelude.scss') %>
</style>
```

这里用了 Webpack 的一个特殊语法:
- `!!` 表示禁用所有配置里写好的 loader，这里 scss 默认是 `['style', 'css', 'sass']`
- 之后，只执行 `sass -> css` 两个 loader，得到一个字符串，然后就内嵌进来了

另一个据说可行的方法是添加一个 entry，然后指定特殊的 loader，但是我们没有找到 `customize-cra` 里面怎么加 entry，因此没有考证这个方法是否可行。

### Code splitting

现在加载页面已经加载了（笑），我们需要加快 React 渲染出来有效内容的速度。

Webpack 会把内容拆分成不同的 Chunk，然后每个 Chunk 加载完了一起解析执行。一般而言 Webpack 的分块策略是所有 `node_modules` 放到一起，剩下的代码积极分块，这样的理由是如果应用代码更新了，绝大多数 Asset 不需要重新下载。但是我们重新下载的延迟都用 Service worker 藏起来了，而且按照默认分块方法，Monaco 需要一开始就加载，这是最大的一块儿内容。

渲染出来有效内容可能要做这些事情：

- Redux 创建 store
- 加载编辑器、 Verilog / VHDL 语言支持
- 加载 WASM 模块
- 加载两个 Route:
  - Login
  - Workspace
- Redux store 初始化，尝试向服务器询问是否已登录

由于是初次加载，肯定没有登录。因此只有 Login Route 会用到。编辑器只在 Workspace 里和构建详情里用到，因此也可以延迟加载。 WASM 同样只在编辑器里用到，因此也延迟加载。最后的结果是，我们相当于需要在加载过程中插入这么几个 yield point:

- App 请求加载 Workspace 时
- App 请求加载 Monaco 时
- App 请求加载 WASM 时

其中，最后一个因为本来就是用 redux 加载完放到 state 里的，直接不 `await` 到它上面就行了。

第一个需要 Webpack 的一些特性：使用 `const ModulePromise = import('./module')` 加载的模块，可以分到一个不同的 chunk 中。

第二个最麻烦，因为我们不仅需要一个 async import，还需要把 Monaco 从 vendor chunk 里拆出来。这个时候需要额外配置一下 Webpack，强制把 Monaco 自己分一个 chunk:

```js
setWebpackOptimizationSplitChunks({
  chunks: 'all',
  name: false,

  cacheGroups: {
    monaco: {
      test: /[\\/]node_modules[\\/]monaco-editor/,
      reuseExistingChunk: false,
    },
  },
}),
```

对于延迟加载的模块，可以造一个 React hook:
```js
function useLoader(loader) {
  const [Comp, setComp] = useState(null);
  useEffect(() => {
    loader.then(mod => {
      setComp(() => mod.default);
    });
  }, []);

  const Nullify = useCallback(() => null, []);

  return Comp || Nullify;
}

const WorkspaceLoader = import('./routes/Workspace');

// Somewhere within App component:

const Worksapce = useLoader(WorkspaceLoader);
```

这样写即使 App 没有被渲染，也会积极加载 Workspace，但是不会阻塞程序入口所在 chunk 的解析和执行。

