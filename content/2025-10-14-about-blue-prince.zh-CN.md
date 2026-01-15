---
title: 玩了 Blue Prince
tags: 游戏屋
---

<style>
.hide {
    background: var(--color-fg);
}
</style>

上次在 [Ghost of Tsushima 的简评](/post/about-ghost-of-tsushima)里提到了最近在 Blue Prince 里面坐牢。Well，人总会走出自己划给自己的牢笼的，在经过 150h 左右的游戏时间之后，我总算觉得我可以把这游戏放下，并且写一点评论了。

玩这个游戏的整体心路历程可以总结为如下的进程：
- 最开始 30h: GotY，神作，引人入胜，神秘气氛拉满，Secrets everywhere
- 30h-80h: 开始意识到 Rougelike 机制的存在，和其他尝试对随机性进行弥补的机制。开始逐步摸清剧情。开始遇到让人摸不到头脑的谜题。
- 80h-110h: 开始坐牢，这 30h 几乎没有进展，有的谜题需要 Brute force，导致体验很差
- 110h onward：放弃治疗，开始看 Reddit 的 Hint，意识到可能自己这些谜题真的就解不开，心灰意冷，有些 Endgame puzzle 直接开始跟攻略。从解密游戏角度来看，这段时间就是没有体验，我为什么不直接看 Let's Play，看别人 Suffer instead of myself?

可以看到，是一个单调下坡路的体验。要不是最后为了写这个简评把一些 CG 看了一遍重新唤醒了最开始 30h 中令人兴奋的游戏体验，我就要给出经典 Steam 评论区中的 300h+ do not recommend 了。

本评论希望以完全 Spoiler free 的方式完成，会涉及 Spoiler 的东西都会放到 Spoiler 里面藏起来。对于这种<em>基于探索的推理/解谜游戏</em>，很重要的体验是发现 Unknown unknown，本文会尽量避免提到这件事，不过探讨机制是肯定会暴露一些谜题解答信息，甚至会导致我个人对游戏操作的理解影响读者，所以如果真的想要特别完美的 Spoiler-free 体验的玩家，可以只阅读我如下的总体评价，再决定是否前往 Steam 商店就好了：

> 本游戏从解谜游戏角度，和 FEZ 的谜题设置思路高度相似，难度也类似，唯一区别是相比于 FEZ 只有数个 "extreme late-game puzzle" <span class="hide">(a.k.a. heart blocks)</span>，Blue Prince 有大概至少 50% 的谜题、游戏和叙事内容不比这一难度更简单。如果你没有看过 FEZ，但是对 TUNIC 比较熟悉的话，这些谜题的难度和结构大概类似 TUNIC 的 <span class="hide">ARG 部分</span>
> 
> 如果你很喜欢这些解谜体验，那么推荐，并且尝试穷尽本游戏的所有谜题。尤其是如果你有朋友可以和你一起沟通交流。
>
> 如果你愿意尝试，可以自选结束的时机。本游戏的“通关”大概需要 30h，之后还有很多难度很高的谜题，而且很依赖你有没有某些特定的灵感，这也挺有 Rougelike 的 RNG 感的吧...所以没有解出来特定的谜题不应该被认为是 Skill issue 
>
> 如果你是看到 Steam 上说这东西很像 Outer Wilds 或者 Obra Dinn 所以感兴趣（比如我），Be well aware that 这些游戏是在一个 <em>基于探索的推理/解谜游戏光谱</em> 上的，需要具体根据你对特定游戏的体验做调整。这个光谱从一端到另一端大致是：
> Obra Dinn / Outer Wilds -> FEZ / TUNIC -> Blue Prince -> Rusty Lake 的游戏

<details>
<summary>我的进度 (Spoiler!)</summary>

完成本文的时候我的进度：
- All sigils
- All red envelops
- 除了需要新开档的奖杯，只缺一个 Drafting sweeptake
- All blue memos
- Endgame puzzle: 推进到 Still water puzzle

其中：
- 一个 Red envelop 一个 Sanctum key 的位置看了攻略
- Satelite 看了部分提示（主要是我没把那六个数映射到 XYZABC 上，还以为是 Z/26Z 循环群呢，后面具体吐槽这个）。
- [r/BluePrince: End-Game Progress Route [Major Spoilers Within]](https://www.reddit.com/r/BluePrince/comments/1k0jhq2/endgame_progress_route_major_spoilers_within/) 这篇文章基本 14 之后都或多或少看了一点。
</details>

接下来给一些细节的讨论...

## 推理 vs. 解谜：构造谜题的范式

上面那个“光谱”是什么意思呢？

我一直觉得需要显著区分“推理游戏 (detective game)”和“解谜游戏 (puzzle game)”。但是现实中确实这两个还是挺混杂的，因为很容易糅合在一起。不过我们依旧可以讨论是侧重在哪边。

Blue Prince 的绝大多数谜题都是一种 “Word play”：各种各样 Written repersentation 的各种各样解读形式。它的名字就是一个例子：Blue Prince / Blueprints.

这会导致它基本没有推理元素，而是应该是某种纯解谜游戏，更像 The witness (但是 The witness 的核心我感觉是另外的东西，有机会另说)：谜题解答不依赖推理，而是依赖灵机一动，依赖在草稿纸上写写画画，以及对大量信息的记忆。这也导致，同样是 Word play，他和 Chants of Sennar 区别巨大，不能等同，后者可以理解成是在真实语言学理论框架下的推理游戏。

这首先就意味着这游戏不可能有翻译了，而且对于来自其他文化/语言的玩家其实有一个很高的隐形门槛。其次一个问题是：这会导致对于每一个特定的玩家，总会在整个过程中接不到一些线索。这本身并不是什么本质麻烦，但是 Blue Prince 在执行上出现了一些偏差：它的线索结构存在问题。

## 线索结构，难度感知和“社区合作解谜”

作为一个半职业 OW 吹，我要准备起手式了。基于探索的解谜/推理游戏 Game loop 是“获取新线索 -> 解开谜题，从而获得物品/新的可达游戏区域”，因此我们可以把线索之间组成一个网。这就是 OW 船上电脑的“传闻模式”干的事情。 <small>Mobius 真的什么都想明白了</small>

OW 之所以广受赞誉，是因为他的这一线索网络比较稠密，每个节点都有多个出边、入边，这样玩家可能体验到线索放在一起的 Aha moment 的个数是已经获得的线索个数的指数阶的。Blue Prince 看上去这个网络也和 OW 一样稠密，而且节点数多非常多，应该是神中神游戏，但是有几个很大的不同：

- 很多谜题，尤其是在 Late-game puzzle 上，布置是完全线性的。在 Late-game puzzle guide 那个 Reddit 帖子中，居然连续出现了接近十个 "Building on the previous puzzle" 字样，所以只要一个倒闭，这整条线就完全撞墙。而整条线撞墙的概率，是每个谜题撞墙的概率的一个指数函数。
- 而且每个谜题并没有冗余：只有一种得到谜底的方式。这个时候，入边多反而会构成一种累赘：玩家需要真的完全掌握所有前置线索，才能够抵达谜底，没有任何 Wiggle room。结合到前述谜题的构造方法，因此某个特定谜题倒闭的概率也很高。这样每个谜题倒闭的概率，也是每个线索倒闭概率的一个指数函数。
- 最后，在玩家尝试在游戏内解决特定谜题时，需要的操作数很多。这是入边多的一个表现。当一个大门没动静的时候，你不知道门上五十把钥匙哪把是有问题的。它可以直接类比成 RL 的 Sparse reward。考虑到我没有 Deepseek 聪明，Deepseek 是 RL 训练的，RL 没办法很好处理 Sparse reward，那我吃到了一个 sparse 的谜题的时候遇到的困难也可想而知。

我能想到的唯一同时符合这三个特点的游戏中的谜题，就是 FEZ 的 <span class="hide">heart blocks 中的两个（望远镜那个我感觉还行，剩下俩是真不行）</span>。就算是 TUNIC 的 <span class="hide">ARG / tuneic language</span>，也是一小步一小步的谜题设计，没有 Sparse reward，即使这样它也花了整个社区很长时间才解决。

这样的结果是在玩家的感知中这个游戏有些谜题“异常困难”，因为到了一个时间点之后自己所有谜题都解不开。并且无论是真的通过重复反复读笔记、Brute-force 还是看提示/攻略真的解决了卡关的谜题的时候，玩家也并不会得到很大的成就感：自己 Miss 的东西通常都是一些很小的，本身并不困难的一小部分，<small>That's the psychology of hindsight</small>。同时这种困难会给人一种非常“人造”的感觉，有时会让人非常恼火。Reddit 上可以看到一些 [60-80h rage quit 的帖子](https://www.reddit.com/r/BluePrince/comments/1kga6c1/80_hours_in_im_calling_it_quits/)，确实也不能怪他们。

因此如果有至少一个同样喜欢这类游戏的朋友可以同步一起推进，然后共享笔记，经常讨论的话，游戏体验会大大提升。就像 TUNIC 的 End-game puzzle <span class="hide">(fairies, ARG, tuneic language)</span>，可以看出来开发者故意是把这部分谜题交给整个社区一起合作解开的，它的难度明显比其他谜题高一个台阶，所以从游戏设计角度这些“社区合作解谜” as a bonus 是一个很令人兴奋的内容。说到这里...

## Does it never end?

然而对于 Blue prince 而言给我感觉这些 Late-game puzzle 反而起到了反效果，降低了体验，问题也是有几个不幸的原因：
- 本身的谜题数量太多了，有非常多 Early game 的线索是用于这些也许是希望社区一起解决的谜题的，因为谜题的结构是线性的，所以在卡关情况下，玩家会觉得自己手头只有少数没有解开的谜题，但是却有一大堆不知道意思的线索，而且没有什么可以换到手头的其他谜题。
- 这部分内容包含的剧情也太多了...谜题的线索结构是线性的，它的叙事结构也是按线性逐个揭露信息的，而这部分谜题揭露的剧情内容几乎完全没有被别的游戏中其他的探索覆盖。所以只要不把所有谜题弄完，看上去就是一个残缺的故事。

我个人感觉是这反映出来了一个对自己作品非常有激情的开发团队，有很多点子，在开发八年的情况下，往游戏中塞了很多很多想法，各个地方都可以体现出他们的热情（e.g. Antichamber 中<span class="hide">包含了第一版的设计</span>，Blue Prince 看上去<span class="hide">也是把第一版的设计包含了进去作为了最终谜题</span>）。但是忽略掉的一点是，自己看起来都非常 Approachable 的解谜步骤，对于第一次接触的玩家而言可能就是并不是 100% 能够解开的，所以放很多这样的谜题其实是不合理的，一个链式的设计是尤其不合理的。这让我想起来我前几次作为 TA 出题的时候，感觉搞一个端到端很完整的题目，只要文档写的全，每一步足够简单，那么就是 OK 的。事实证明基本所有这样的东西都会翻车，指数函数是非常恐怖的。

<details>
<summary>As a side note... (Minor spoiler...)</summary>

其实就算把所有谜题搞定了，感觉也是一个不完整的故事：最后没有 CG，莫名其妙就结束了，一直等待的大结局看来并不存在（或者六个月了社区还没搞出来）。

互联网上对此有 [Argument](https://www.gamespot.com/articles/blue-prince-doesnt-have-a-satisfying-ending-but-thats-the-point/1100-6532795/) and [Counter-argument](https://www.reddit.com/r/Games/comments/1lm592t/comment/n05bnm9/)，我个人的感觉是：

我连看攻略都还没打到那儿呢，哪儿来的感想。

</details>

## Rougelike 解谜成立吗？

最后说一下对于 Rougelike 解谜是否成立这件事情的一些感想。很多玩家估计是看到 "Rougelike puzzle game" 这个 tagline 所以开始玩的（Also 比如我），这个想法确实之前非常少见。

我个人的感觉是，这是一个非常有趣，也相对成功的对于这一想法的实验，游戏本身的完成度比较高（虽然有上述一些问题），但是其实并没有特别证明 Rougelike 和 Puzzle 是一个很能有机结合的东西。尤其是到了后期，非常能看到这两个组成部分的割裂感：在手头只有一个有点想法的谜题情况下，有的时候需要疯狂 Reroll 超过两百次，很难说是一个令人享受的体验。

在前期，Rougelike 的随机性确实为不同玩家创造了不同的解谜体验，但是说实话，就连 Obra Dinn 那么线性的地图，我都从来没有见过两个人有非常相似的解谜流程。好奇心侧重点的不同本身就可以创造不同的解谜体验<small>（OW 吹，Ahem）</small>，何况到了后期这个线索结构又像个漏斗一样把大家都弄回了一条线上。

因此，只能说这是一个很好玩的 Rougelike 游戏，也是个很深很复杂的解谜游戏，但是目前来看我感觉很难说这是一个很 NB 的 Rougelike puzzle。