---
title: "When you don't need to fine-tune your own model"
excerpt: "The urge to train 'your own' model is strong. Usually it's months of work for something a good prompt handles in an evening."
pubDate: 2026-05-12
transId: "skip-fine-tuning"
---

Almost every conversation about an AI product eventually turns to "let's fine-tune a model for our task." It sounds serious and technical. For a small team it's more often a trap than an advantage.

## What the builder actually wants

Fine-tuning is a tool for a specific problem: a general model systematically fails on your narrow domain, and no amount of instruction fixes it. If that's not your problem — and usually it isn't — you're paying a large price for the wrong task.

The price isn't only money. It's data collection and labeling, training infrastructure, versioning, retraining every time the base model updates. For a solo builder that's months during which the product doesn't move.

## What I did in NURA instead

NURA estimates food from a photo. Seemingly an obvious candidate for a custom recognition model. But I started in a different order:

1. Took a strong general-purpose multimodal model.
2. Invested in the prompt: a strict response format, examples, explicit constraints.
3. Added number validation on the app side — to reject obviously absurd estimates.

That was enough to reach a working prototype. The accuracy is "good enough," and I spent evenings, not quarters.

## The rule I use

> Fine-tune only when the prompt is already exhausted and the error is measurable and systematic.

First squeeze everything out of the general model and the prompt. Only if you hit a wall — and can show in numbers that fine-tuning is what breaks through it — do you take on training. Nine times out of ten you never reach the wall, and the product is already in users' hands.
