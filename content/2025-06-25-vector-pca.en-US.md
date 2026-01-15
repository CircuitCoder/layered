---
title: Determining the "direction" of a vector shape
tags: 开发
---

Edited 06-29: updated how to compute the length of the direction vector. See the end of this post.

Intuitively, the Chinese stroke <ruby>"㇐"<rt>U+31D0</rt></ruby> has a _horizontal_ direction, while <ruby>"㇓"<rt>U+31D3</rt></ruby> has a _mostly top-right to bottom-left_ direction. How do we determine the "direction" of a stroke?

First we need to figure out what is a stroke and what is a "direction". Since we are working in a 2D plane, we can instead use a method for any **closed loop without self-intersection**. Most frequently, these shapes are represented in piecewise parametric curves<sup>[1]</sup>, which is also the case for font-shapped characters from free-type fonts. One possible definition of "direction" is the main axis of the smallest bounding ellipsis. Computing the smallest bounding ellipsis is hard to do analytically, but we can deal with another form of ellipsis much more easily: statistics has given us a tool for dealing with _fitted_ ellipsis: principal component analysis (PCA).

In practice, PCA is always used with samples, but instead we can abuse it to compute the ellipsis fitted to a multivariate distribution with known PDF. In our case, we can define the "direction" of a shape $L$ to be the main axis of the ellipsis fitted to the uniform distribution over the internal of $L$.

# What do we need

First, the PDF of the distribution over the internal of some shape closed $L$ with internal $int(L)$ and area $A(L)$ is:

$$
f(\mathbf{p}) = \begin{cases} 0& \mathbf{p} \notin int(L),\\ 1 \over A(L) & \mathbf{p} \in int(L), \end{cases}
$$

So first, we need to compute the area of $L$. Another subtle thing that needs to be determine is the orientation of $L$, because it's not guaranteed that it has conter-clockwise orientation. Both of these can be computed in a single step by first assuming $L$ has the correct orientation, compute the area $A(L)$ as-is, and then judge the orientation by the sign of $A(L)$.

$$
A(L) = \iint_{int(L)} dA = \oint_L x dy
$$

Now with the PDF fully defined, we need to compute the covariance matrix of this distribution. This in turn requires the following values:

- $Var(x)$ and $Var(y)$
- $Cov(x, y) = Cov(y, x)$

Since $Var(x) = E(x^2) - E(x)^2$ and $Var(y) = E(y^2) - E(y)^2$, so we need the first and second central moment of x and y, which are:

- $E(x) = \frac{1}{A(L)} \iint_{int(L)} x dA = \frac{1}{2A(L)} \oint_L x^2 dy$
- $E(y) = \frac{1}{A(L)} \iint_{int(L)} y dA = - \frac{1}{2A(L)} \oint_L y^2 dx$
- $E(x^2) = \frac{1}{A(L)} \iint_{int(L)} x^2 dA = \frac{1}{3A(L)} \oint_L x^3 dy$
- $E(y^2) = \frac{1}{A(L)} \iint_{int(L)} y^2 dA = - \frac{1}{3A(L)} \oint_L y^3 dx$

And for the covariance:

$$
Cov(x, y) = \frac{1}{A(L)} \iint_{int(L)} x y dA = \frac{1}{4A(L)} \oint_L x^2 y dy - y^2 x dx
$$

Finally, compute the largest eigenvector & eigenvalue for the covariance matrix:

$$
\begin{bmatrix}
Var(x) & Cov(x, y) \\
Cov(x, y) & Var(y)
\end{bmatrix}
$$

Since this is a symmetric matrix, a real eigenvalue & eigenvector is guaranteed.

# Computation

In practice, all curves are SVG paths. We first preprocess the paths to split them into non-overlapping components that do not self-intersect.

Then we can use the [`lyon_algorithms`](https://docs.rs/lyon_algorithms/latest/lyon_algorithms/) crate for sampling along a SVG path. Extra caution should be taken for the left-over segment at the end of the integration.

For computing the eigenvalue and eigenvector, we used two tricks for 2x2 matrices, [one from 3b1b (YouTube)](https://www.youtube.com/watch?v=e50Bj7jn9IQ), and [another one from math stackexchange](https://math.stackexchange.com/questions/395698/fast-way-to-calculate-eigen-of-2x2-matrix-using-a-formula). For the following matrix:

$$
A = \begin{bmatrix}
a & b \\
c & d
\end{bmatrix}
$$

Recall that the sum of eigenvalues $\lambda_1 + \lambda_2 = tr(A)$, and the product of eigenvalues $\lambda_1 \lambda_2 = det(A)$. So we can directly solve for the larger eigenvalue $\lambda_1 = \frac{1}{2} tr(A) + \sqrt{\frac{1}{4} tr(A)^2 - det(A)}$.

Then, we can compute the (unnormalized) eigenvector corresponding to $\lambda_1$ to be:

$$
\big(
\begin{matrix}
b \\
\lambda_1 - a
\end{matrix}
\big)
$$

BTW, since we are dealing with a symmetric real matrix ($b = c$), it's guaranteed that:

$$
\begin{aligned}
& (a - d)^2 \geq 0 \\
\implies & (a + d)^2 \geq 4 a d \geq 4 a d - 4 b c \\
\implies & \frac{1}{4} tr(A)^2 = \frac{1}{4} (a + d)^2 \geq ad - bc = det(A)
\end{aligned}
$$

Finally, we scale the eigenvector to have the length $\sqrt{\lambda_1}$, because now it repersent the "standard derivation" along that axis.

# Result

<figure>
  <img src="https://layered-assets.thu.fail/pca-scale.png">
  <figcaption>
    Title from <a href="/post/isca2025-pt1">the last post</a>
  </figcaption>
</figure>

The above figure shows the computed direction vector scaled by 10. Because the length of the original vector is the standard derivation along the principal axis, it's almost always being covered by the stroke itself.

Also because of this, the length of the vector does not directly reflect the "outer dimension" of the stroke. The distribution of thickness along the axis will affect the length of the vector. One may argue this is not a good indicator of the dimension of a shape. In that case, a distribution along the boundary of the shape may be used instead of the internal of the shape.

But for me, this is good enough™, and does reflect the optical heaviness of the various part of a stroke, so I'm settling with this.

---

Edit 06/29: We noticed a problem with the aforementioned approach to compute the length of direction vectors. When the primary and secondary component has similar derivation, the direction of the primary component alone may not actually suggest the shape of the original distribution. An example is the dot in the figure above.

Instead, we choose to scale the direction vector based on the ratio between the derivations along primary and secondary component (square root of the two eigenvalues):

$$
L = 1 - \sqrt{\lvert \frac{\lambda_2}{\lambda_1} \rvert}
$$

This mapping has the property that if $\lambda_1 \approx \lambda_2$, then $L = 0$, effectively suggests that the shape has _no direction_. The more eccentric the fitted ellipsis is, the closer $L$ is to 1. One can also just the use ellipsis eccentricity.

Numerically, $\lambda_1 \approx 0$ indicates a small vector shape. A good fallback is to just return $L = 0$.

---

<div class="footnotes">
- [1]: more concretely, SVG paths, or bezier curve segments with various orders.
</div>
