---
title: 喵++
tags: 开发
legacy: true
force_publish_time: 2019-05-21T18:38:07.601Z
force_update_time: 2019-08-21T07:19:29.413Z
---

躺在床上忽然想做个作品页。于是做了。<del>CSS 真好玩。</del>

[https://meow.plus](https://meow.plus)

没有 JS 和 SVG Clip，应该是确保了没有任何动画导致的 DOM repaint，所以在各种机子上都可以 60FPS 的说。

以下是我的摸鱼和 StackOverflow 以及 CSS-Trick 搬运工

## 字颜色渐变

```css
.foo {
  background: linear-gradient(/* ... */);
  color: transparent;
  -webkit-background-clip: text;
  background-clip: text;
}
```

<div class="text-test">
  哈哈哈哈哈哈哈哈
</div>

<style>
.text-test {
background: linear-gradient(to right, red 0%, blue 50%, green 100%);
text-align: center;
color: transparent;
-webkit-background-clip: text;
background-clip: text;
font-size: 80px;
white-space: nowrap;
overflow: hidden;
text-overflow: ellipsis;
}
</style>

## Hover 区域比真实显示区域小

### 方法 1
因为其实有很多用 absolute 叠起来的孩子，所以这是我使用的方法

```html
<div class="parent">
  <div class="action"></div>
  <div class="child">
    <!-- Stuff -->
  </div>
</div>

<style>
  .parent {
    position: relative;
  }
  
  .action {
    position: absolute;
    top: 10px;
    bottom: 10px;
    right: 10px;
    left: 10px;
    z-index: 100;
  }
  
  .action:hover ~ .child {
    /* ... */
  }
</style>
```

### 方法 2
```html
<div class="parent">
  <div class="child">
    <!-- Stuff -->
  </div>
</div>

<style>
  .parent {
    margin: 10px;
    overflow: visible;
  }
  
  .child {
    margin: -10px -10px -10px -10px;
  }
  
  .parent:hover .child {
    /* ... */
  }
</style>
```

## 写好几个一样的 linear-gradient 好麻烦
```css
.parent {
  --bg-gradient: linear-gradient(/* ... */);
}

.parent .child {
  background-image: var(--bg-gradient);
}
```

## linear-gradient 方向要写度数，但是斜着又不知道宽高比

```css
.foo {
  background-image: linear-gradient(to top right, /* ... */);
}
```

## 覆盖层动画
因为有渐变所以不能变形，没法用 `transform: scale`。顺便在 blur 的时候需要等待内部内容先恢复，所以要修改 transition 的延迟。

```css
.overlap {
  clip-path: inset(0 100% 0 0);
  
  transition-property: clip-path;
  transition-duration: var(--step-duration);
  transition-timing-function: ease;
  transition-delay: calc(var(--step-duration) + var(--step-interval));
}

.action:hover ~ .overlap {
  clip-path: inset(0 var(--row-margin));
  transition-delay: 0s;
}
```

<div class="box-test">
</div>

<style>
  @keyframes box-animation {
  0% {
  clip-path: inset(0 100% 0 0);
  }
  
  50% {
  clip-path: inset(0);
  }
  
  100% {
  clip-path: inset(0 0 0 100%);
  }
  }
  .box-test {
  margin: 0 auto;
  background: linear-gradient(to right, red 0%, blue 50%, green 100%);
  height: 20px;
  animation: box-animation 1s ease infinite;
  }
</style>

## 瞬间显示动画后面的小尾巴

### 方法 1
最无脑，直接用了。

```css
.escape {
  transition: opacity 0s linear, clip-path var(--escape-duration) ease;
}
```

### 方法 2
科学的方法，这个就算倒过来放也没有问题。但是因为在这个用例内不需要倒过来放所以没写。

```css
.escape {
  transition-property: opacity, clip-path;
  transition-duration: var(--escape-duration);
  
  transition-timing-function: step-start, ease;
}
```

<div style="text-align: center; color: #AAA">
  <img src="https://mdn.mozillademos.org/files/3423/steps(1,start).png" />
  
  MDN: step-start = steps(1, jump-start) = steps(1, start)
</div>

## 还可以再给力一点吗？

可以做成点击换背景色的

```html
<input type="radio" id="select-a" name="foo-bar-color">
<input type="radio" id="select-b" name="foo-bar-color">

<label for="select-a" class="a-label"></label>
<label for="select-b" class="b-label"></label>

<main>
  <div class="box"></div>
</main>

<style>
  input[type="radio"] {
    position: fixed;
    bottom: 100%;
  }
  label {
    width: 20px;
    height: 20px;
    display: inline-block;
    cursor: pointer;
  }

  .a-label {
    background: red;
  }

  .b-label {
    background: blue;
  }

  main {
    --background: #AAA;
  }

  #select-a:checked ~ main {
    --background: red;
  }

  #select-b:checked ~ main {
    --background: blue;
  }

  .box {
    width: 100%;
    height: 20px;
    background: var(--background);
  }
</style>

```

请点击下面的红蓝小方块

<div>
  <input type="radio" id="select-a" name="foo-bar-color">
  <input type="radio" id="select-b" name="foo-bar-color">

  <label for="select-a" class="a-label"></label>
  <label for="select-b" class="b-label"></label>

  <main>
    <div class="box"></div>
  </main>

  <style>
    input[type="radio"] {
      position: fixed;
      bottom: 100%;
    }
    label {
      width: 20px;
      height: 20px;
      display: inline-block;
      cursor: pointer;
    }

    .a-label {
      background: red;
    }

    .b-label {
      background: blue;
    }

    main {
      --background: #AAA;
    }

    #select-a:checked ~ main {
      --background: red;
    }

    #select-b:checked ~ main {
      --background: blue;
    }

    .box {
      width: 100%;
      height: 20px;
      background: var(--background);
    }
  </style>
</div>

<del>最开始想做这件事情的，后来摸掉了，所以现在背景色是写在一个 variable 里的 :joy:</del>

已经加上了，Flag 回收!
