---
title: pause() is not enough for scroll-driven animations
tags: 开发,前端
---

When doing navigation in SPA, the scroll position would often experience a sudden change, either done intentionally to return to the top of the newly accessed page, or inadvertently as a side effect from the change of scrollable content's height. If the scroller is shared between the exiting and entering content (e.g. scroller being the root viewport), then the exiting content would also be scrolled abruptly. An easy mitigation for this maybe unwanted visual side effect is to change the positioning of the exiting content to `position: fixed`, essentially fixing the exiting content's position at the moment of the navigation. However, if the exiting content contains scroll-driven animations, we would also have to somehow fix them too.

## Pausing is not enough

One obvious choice is add `animation-play-state: paused`, or to call `Animation.pause()` if using WebAnimation. However, these approachs suffers from the fact that the pausing of the animation is **not synchronous**, at least as implemented currently in Blink (the only implementation of scroll-driven animation as of right now), so even after the pausing is initiated, changing the scroll position may still affect the animation progress. Even worse is that both changing CSS or calling `Animation.pause()` provides no signal of completion. So we can't even reliably delay the scrolling until the pausing is done.

The specification is somewhat outdated and contradictory regarding scroll-driven animations. The current CSSWG draft spec for web animations [\[web-animation-1\]](https://drafts.csswg.org/web-animations-1/#pausing-an-animation-section) on paper would categorize scroll-driven animation as "has finite timeline", but that's obviously not the intention here. Based on the steps below, "has finite timeline" should only be applicable to animations with finite iterations. The newer (unfinished) draft \[web-animation-2\], which incorporates scroll-driven animations, is apparantly incomplete, because the _hold time_ is never set to _current time_. Also, according to [a issue in csswg-drafts](https://github.com/w3c/csswg-drafts/issues/11469#issuecomment-2634876248), Blink's implementation has already diverge from the draft.

## A temporary workaround for WebAnimation

Luckily, for web animations, we can easily _sychronously_ apply the current computed style according to a `Animation` by using [`Animation.commitStyles()`](https://drafts.csswg.org/web-animations-1/#dom-animation-commitstyles).

So instead of doing:

```javascript
animation.pause();
```

One would need:

```javascript
animation.commitStyles();
animation.cancel();
```

Notice that `Animation.cancel()` instead of `Animation.pause()` is used here. Because animated values take precedence over all static values, even those defined in the element's style property, so we have to cancel the animation all together to avoid further timeline updates overriding our committed styles. This piece of code works in Blink as of right now, and is used in the [frontend of the page you're watching](https://github.com/CircuitCoder/layered/blob/148c2590a3885d0048455586534fb6d6a21d2d74/web/src/main.tsx#L1047-L1053).

For pure CSS animations, one may need to manually call `getComputedStyle` and apply animated properties one-by-one.
