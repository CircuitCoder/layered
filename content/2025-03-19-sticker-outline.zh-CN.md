---
title: Adobe Illustrator 添加白边
tags: TUNA
---

最近给 TUNA 画了新的贴纸和 TUNAive。

![TUNAive 正面图案.jpg](https://github.com/tuna/artwork/blob/master/clothing/TUNA-tunaive-2025-art-light.png?raw=true)

经常会遇到的一个操作是需要给贴纸添加一个白边。TUNA 贴纸使用的操作如下：

> - 选中对象，复制一份，打开 Path finder，Union
> - 删除掉所有 Clip group 内部的背景
> - Object -> Path -> Offset Path
>   - 我们选择的是圆角，所以这里选 Round joint
> - 把可能出现的洞填起来，再 Union 一次。删除掉 Offset Path 之前的路径。
> - 填充白色，放置在最底层

对于常见的矢量图，以上操作是够用的。

## 文字

对于文字，需要在一开始额外进行一个操作，将文字转换为路径：

> 右键选中文字，Create outlines

## Stroke

这次画的贴纸第一次部分直接使用 Stroke 作为展示元素，例如本文最开始图片中的网线。直接使用 Path finder 进行 Union 是不工作的，因为这个路径不是使用其内部填充进行绘制的。

因此也需要在一开始将路径的 Stroke 填充本身转换为一个轮廓路径。

> 选中路径，Object -> Path -> Outline Stroke

## 位图

本次准备印制的贴纸也是第一次使用了来源第三方的位图。位图同样因为缺乏轮廓路径所以无法通过 Offset Path 直接得到想要的结果。

为了获得一个有透明度的图片的不透明部分轮廓路径，可以采用以下方式：

> - 将这一位图复制一份
> - Effect -> Path -> Outline Object。Effect 的执行结果是一个边缘路径，但是这个路径暂时没办法被直接操作。
> - Object -> Expand Appearance，这时会得到可以直接操作的路径，但是这个路径现在被套在很多层 Group / Clip group 背后。
>   - 在实践中，很多时候 Trace 出来的边界有锯齿，需要进行一次 Object -> Path -> Smooth。选大约 3-5% 即可。
> - 如果愿意一层一层把所有的 Group 打开，可以根据矢量路径的方法继续操作。我因为比较懒，直接设置了个白色的 Stroke color，宽度是白边宽度 x2，然后丢到最底层了，其实也能达成这个效果。
