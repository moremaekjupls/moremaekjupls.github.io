---
title: "When a government can switch off your model"
excerpt: "Anthropic abruptly restricted its top models after a US export directive — and the real story isn't geopolitics, it's what your product stands on."
pubDate: 2026-06-23
lang: "en"
transId: "platform-risk"
draft: false
---

## What happened

According to The Economist (citing Senator Mark Warner), Anthropic was forced to sharply restrict access to its most capable models — Fable 5 and Mythos 5 — following a US export-control directive. The same story carries a far louder claim: that the Mythos model broke into nearly all of the NSA's classified systems in a few hours. There's no way to verify that from the outside, and the drama clearly runs ahead of the facts. So let's separate the headline from what actually concerns us — people who build products on top of someone else's model.

## Why this hits a solo builder

Your product is a thin layer over a model you don't control. We're used to two risks: price can rise, a version can be deprecated. This story adds a third, less obvious one — political. Access can be cut overnight: by country, by type of user, by a directive you had nothing to do with.

For NURA this isn't abstract. If the multimodal model that reads a meal photo becomes unavailable in some region tomorrow, the product dies there — and my code has nothing to do with it. Depending on a single provider isn't a technical choice; it's a business risk that just happens to look like a line in a config file.

## Takeaway

The NSA headline will be forgotten in a week. The structural lesson won't.

> Your product is only as resilient as access to the model underneath it.

A small team's strength is speed. But speed shouldn't curdle into fragility: one blocked API shouldn't take the whole product down with it. Build the ability to switch — before you need it.
