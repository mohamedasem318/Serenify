---
name: remotion-best-practices
description: Router for all Remotion skills
metadata:
  tags: remotion, video, react, animation, composition
---

<!--
LOCAL ADAPTATION — read before editing or upgrading.

Upstream (github.com/remotion-dev/skills) ships this router with a full copy of
every other skill nested INSIDE its own directory, and links to them as
`<skill-name>/REFERENCE.md`. That layout does not fit `.claude/skills/` and
`.agents/skills/`, where every skill is a flat sibling directory, so the links
below point at `../<skill-name>/SKILL.md` instead. The bodies are upstream's,
unedited.

Sections for skills not installed here — remotion-maps, remotion-saas,
remotion-upgrade, remotion-interactivity — have been removed rather than left
pointing at nothing. Rationale and the full install list: `video/README.md`.

On upgrade: re-flatten the links and re-drop the excluded sections, or install
the excluded skills and restore them.
-->

## New project setup

If no Remotion project currently exists, load [Create a new Remotion project](../remotion-create/SKILL.md)

Note that this repository already HAS a Remotion project, at `video/`. Read
`video/README.md` before scaffolding anything — it is deliberately outside the
npm workspaces and it imports real `apps/web` components.

## React Markup Best Practices

If you are writing Remotion React Markup, load [Remotion Markup Best Practices](../remotion-markup/SKILL.md)

## Multimedia

For achieving multimedia tasks in the browser, such as trimming, cropping videos, or getting metadata from them, load [Remotion Multimedia](../remotion-multimedia/SKILL.md)

## Rendering

For advanced rendering beyond simple `npx remotion render`, see: [Rendering Best Practices](../remotion-render/SKILL.md)

## Captions

When working with Captions, load [Remotion Captions](../remotion-captions/SKILL.md).

## Looking up Remotion APIs and documentation

To find and read current Remotion documentation, load [Remotion Docs](../remotion-docs/SKILL.md).
