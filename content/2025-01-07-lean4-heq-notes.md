---
title: Notes about HEq in Lean4 (Part 1?)
tags: 摸鱼
legacy: true
force_publish_time: 2025-01-07T04:44:22.397Z
force_update_time: 2025-01-15T04:56:26.371Z
---

Edit TL;DR: Lean4 有 Definitional proof irrelevance，所以本篇内容纯瞎搞。不过还有一部分没瞎搞的，所以留着。

---

上上次被 Heterogeneous identity 创还是[上上次](https://proofassistants.stackexchange.com/questions/2694/does-equality-in-sigma-x-x-x-x-implies-uip)。上次被 JMeq 创过一次后就想着迟早写点 Notes 给自己看以防下次被创，结果消极怠工然后又被创了，hence this note.

Apparently 在 Lean4 里可以直接证明 UIP，不需要使用任何公理（Quot 那些东西），十分纯净：

```lean4
theorem pair_inj2 {A : Sort u} {B : A -> Sort v} (x y : (a : A) ×' B a)
  : x = y -> HEq x.snd y.snd := by { intro Heq; rw [Heq] }

theorem pair_eq {A : Sort u} (base : A) (l : base = base)
  : @Eq ((a : A) ×' (a = a)) (PSigma.mk base l) (PSigma.mk base (Eq.refl base)) := by { cases l; rfl }

theorem UIP {A : Sort u} (base : A) (l : base = base) : l = Eq.refl base := by {
  let Hpeq := pair_eq base l
  let Heq : HEq l (Eq.refl base) := @pair_inj2 A (fun x => x = x) (PSigma.mk base l) (PSigma.mk base (Eq.refl base)) Hpeq
  exact eq_of_heq Heq
}
```

这非常神秘。

HEq 就是 Coq 里面的 [JMeq](https://coq.inria.fr/doc/v8.9/stdlib/Coq.Logic.JMeq.html)，一个广为人知的性质是如果有 `JMeq -> Eq` 那么 `K`（来源找不到了，G）。在 HoTT 的框架内其实可以把这种 Heterogeneous identity 理解成 Identity of pointed-types `{ A : Type & A }` <super>[1]</super> (把 Pointed-types 理解成 Fibration over `Type` 或者无论什么 base space，现在 Path 可以在整个 Fibration 上跑了)。可以看到其实 `JMeq -> Eq` 其实就是 Injectivity of dependent pair 的一个特殊情况。事实上，这两者是等价的：

```coq
Inductive HEq {A : Type} : A -> forall {B}, B -> Prop :=
| HEq_refl (a : A) : HEq a a
.

Definition Thm_HEq_eq: Prop := forall A (a b : A), HEq a b -> a = b.
Definition Thm_pair_inj2 : Prop := forall A (B : A -> Type) (bp : A) (x y : B bp), existT B bp x = existT B bp y -> x = y.

Theorem Thm_pair_inj2_implies_Thm_HEq_eq : Thm_pair_inj2 -> Thm_HEq_eq.
Proof.
  intros pair_inj2 A a b Heq_ab.
  inversion Heq_ab.
  apply pair_inj2 in H2.
  exact H2.
Qed.

Lemma HEq_lift {A : Type} {B : A -> Type} (f : forall (a : A), B a) : forall (a b : A), a = b -> HEq (f a) (f b).
Proof.  intros a b Heq.  case Heq. apply HEq_refl.  Qed.

Definition pair_inj2_weak {A} {B : A -> Type} {p1 p2 : sigT B} : p1 = p2 -> HEq (projT2 p1) (projT2 p2)
 := (HEq_lift (fun x => projT2 x) p1 p2).

Theorem Thm_HEq_eq_implies_Thm_pair_inj2 : Thm_HEq_eq -> Thm_pair_inj2.
Proof.
  intros HEq_eq A B bp x y Heq_xy.
  exact (HEq_eq _ _ _ (pair_inj2_weak Heq_xy)).
Qed.
```

再加上另一个广为人知的性质 Injectivity of dependent pairs -> UIP <super>[2]</super>，所以只要让 JMeq 和普通的 identity 一样强，那么也可以证出来 UIP。

因此上述 Lean4 证明中唯一一个比较 Dubious 的地方就是 HEq 和 Eq 的转换，也就是 [`eq_of_heq`](https://leanprover-community.github.io/mathlib4_docs/Init/Prelude.html#eq_of_heq) 这个定理，和 [JMeq_eq](https://coq.inria.fr/doc/v8.20/stdlib/Coq.Logic.JMeq.html) 一模一样：

```lean4
theorem eq_of_heq {α : Sort u} {a a' : α} (h : HEq a a') : Eq a a' :=
  have : (α β : Sort u) → (a : α) → (b : β) → HEq a b → (h : Eq α β) → Eq (cast h a) b :=
    fun _ _ _ _ h₁ =>
      h₁.rec (fun _ => rfl)
  this α α a a' h rfl
```

使用了 HEq 的 recursion principle，如果我们仔细看这个 recursion principle 的定义，并且把上面那句 `h₁.rec (fun _ => rfl)` 展开的话：

```lean4
Heq.rec : {α : Sort u} →
  {a : α} →
    {motive : {β : Sort u} → (b : β) → HEq a b → Sort v} →
      motive a (HEq.refl a) → {β : Sort u} → {b : β} → (t : HEq a b) → motive b t
---
  have : (α β : Sort u) → (a : α) → (b : β) → HEq a b → (h : Eq α β) → (cast h a) = b :=
    fun α β a b =>
      @HEq.rec
        α a
        (fun {β} a_1 _ => (h : α = β) -> (cast h a) = a_1) -- motive
        (fun _ => rfl) -- Should have type motive a _ :== (h : α = β) -> (cast h a) = a ???????
        β b
```

我的猪脑感觉就根本不应该 Typecheck...

躺平了，去 Zulip 问一下...

---

Edit 01-06:
Apparently Lean4 对于 Pattern Matching 的处理比较神秘：

```lean
theorem meow {α : Sort u} (a : α) : (h : α = α) -> (cast h a) = a :=
  fun _ => rfl

theorem meow_meow {A : Sort u} {a : A} : (i : a = a) -> i = rfl
:= fun _ => rfl
```

那能证出来 UIP 一点也不奇怪...那么应该问的问题是：Lean4 的 Pattern matching 到底是怎么处理的呢？

---

Edit 01-07:

在 Zulip 提问了，原来是 Lean 有 Definitional proof irrelevance:

https://leanprover.zulipchat.com/#narrow/channel/113489-new-members/topic/How.20are.20functions.20taking.20equalities.20type.20checked.3F/near/492251131

那么一切都不奇怪了（

我是工科猪.jpg

相关阅读：LeanTT [3], Definitional proof irrelevance without K [4].


References

- [1] https://homotopytypetheory.org/2012/11/21/on-heterogeneous-equality/
- [2] https://coq.discourse.group/t/dependent-pair-injectivity-equivalent-to-k
- [3] Mario Carneiro, [The Type Theory of Lean](https://github.com/digama0/lean-type-theory/releases). 2019 
- [4] Gaëtan Gilbert, Jesper Cockx, Matthieu Sozeau, and Nicolas Tabareau. 2019. Definitional proof-irrelevance without K. Proc. ACM Program. Lang. 3, POPL, Article 3 (January 2019), 28 pages. https://doi.org/10.1145/3290316
