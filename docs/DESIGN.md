# Kinproof design notes

Direction: **a family's front door.** Calm, warm, quietly serious; made for a parent reading it under stress.

## Type
- Display and headings: **Fraunces** (a soft, characterful serif).
- UI and body: **Source Sans 3** (a humanist sans, very legible at size).
- Both load through `next/font/google` (self-hosted at build), with system serif/sans fallbacks. Body is 17px (21px in large-text mode) at a 1.6 line height.

## Colour
Defined as CSS variable tokens in `app/globals.css`, with a full dark theme (follows the system, no flash). Warm paper in light mode, warm ink in dark mode. Teal means trust, amber means held, brick means blocked. No neon, no gradients.

Contrast (WCAG AA needs 4.5:1 for text). Lowest pairs, light / dark:

| Pair | Light | Dark |
|---|---|---|
| ink on paper | 13.1 | 15.1 |
| muted on paper | 5.8 | 8.3 |
| muted on surface-2 | 5.4 | 6.7 |
| primary on paper | 7.3 | 9.6 |
| held (amber) on its tint | 6.2 | 8.3 |
| blocked (brick) on its tint | 6.0 | 7.0 |
| ok (green) on its tint | 5.5 | 7.8 |

## The motif: the seal
A scalloped stamp (`components/Seal.tsx`) is the "proof" in Kinproof. It marks verified people and every outcome (sent, held, blocked, expired, redirected). Each state has its own glyph and an accessible name, so colour is never the only signal. On the request page and the confirmation card it lands with a short stamp animation.

## Motion
Only the hold (a slow breathing dot), the confirmation sheet rising, the countdown ring and the stamp move. Everything is switched off under `prefers-reduced-motion`.

## Layout
Designed for 360 to 414px first. Bottom navigation with icons and labels on phones, top navigation from 768px. All tap targets are at least 48px, the send flow keeps its actions pinned above the nav and respects safe-area insets, and nothing scrolls sideways at any width (checked in `e2e/design.spec.ts` at 360, 390, 414, 768, 1024 and 1440).

## Voice
Plain words, no stock phrases. Copy is written from the viewer's point of view: the sender reads "your money", everyone else reads "Ada's money" (`lib/wording.ts`).
