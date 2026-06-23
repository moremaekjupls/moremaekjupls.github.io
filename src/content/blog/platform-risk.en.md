---
title: "When a government can switch off your model"
excerpt: "Anthropic abruptly restricted its top models after a US export directive — and the real story isn't geopolitics, it's what your product stands on."
pubDate: 2026-06-23
lang: "en"
transId: "platform-risk"
draft: true
---

## What happened

According to The Economist (citing Senator Mark Warner), Anthropic was forced to sharply restrict access to its most capable models — Fable 5 and Mythos 5 — following a US export-control directive. The same story carries a far louder claim: that the Mythos model broke into nearly all of the NSA's classified systems in a few hours. There's no way to verify that from the outside, and the drama clearly runs ahead of the facts. So let's separate the headline from what actually concerns us — people who build products on top of someone else's model.

## Why this hits a solo builder

Your product is a thin layer over a model you don't control. We're used to two risks: price can rise, a version can be deprecated. This story adds a third, less obvious one — political. Access can be cut overnight: by country, by type of user, by a directive you had nothing to do with.

For NURA this isn't abstract. If the multimodal model that reads a meal photo becomes unavailable in some region tomorrow, the product dies there — and my code has nothing to do with it. Depending on a single provider isn't a technical choice; it's a business risk that just happens to look like a line in a config file.

## What to do about it

Don't panic, and don't "go train your own model" — that's rarely justified (I wrote about that separately). Make the dependency manageable instead:

- **An abstraction layer.** One interface in your code, behind which the model swaps with a single line, not a rewrite of half the app.
- **A real fallback provider.** Not "we'll switch in theory," but a path that's wired and tested. A backup you've never run isn't a backup.
- **Portable prompts.** The less you lean on one vendor's tricks, the cheaper the move.
- **Your own eval set.** With 30 examples and expected outputs, switching models is a measurable evening's decision, not a leap in the dark.
- **Watch more than price.** Geo-availability, terms of use, export limits — that's part of your risk map now.

## Takeaway

The NSA headline will be forgotten in a week. The structural lesson won't.

> Your product is only as resilient as access to the model underneath it.

A small team's strength is speed. But speed shouldn't curdle into fragility: one blocked API shouldn't take the whole product down with it. Build the ability to switch — before you need it.
