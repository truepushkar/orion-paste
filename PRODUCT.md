# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: Flask JSON API + MongoDB (SQLite fallback for local runs) as the backend; React 19 + TypeScript + Vite built frontend, served by Flask as a single process. Chosen because it keeps the existing Python/Mongo deploy story intact while replacing the Jinja + Tailwind-CDN frontend that could not carry a full-screen application shell.

## Users

Developers, sysadmins, and technical writers who need to move a block of text or code from one machine, person, or conversation to another. They are usually mid-task: debugging with a colleague, filing a bug report, pasting a config into a chat, or handing a log to support. They arrive from a terminal or an editor, want to paste and leave, and expect to read the result back later at their desk.

## Product Purpose

Store a block of text at a short link and hand back that link. No account, no dashboard, no onboarding. Success is that a person goes from "I need to share this" to "here is the link" in under ten seconds, and that the reader of that link gets a clean, legible, copyable document.

## Positioning

Paste tools decay into advertising or accounts. Stow is a single-purpose store: one field, one action, one link, with real expiry control, optional read protection, and an editing password, and it never asks who you are.

## Operating Context

Used inside a browser tab that sits beside an editor, a terminal, or a chat client. Text arrives by paste, not by typing. Content is frequently code, config, logs, or error output. Sessions are short and revisits are often days later, from a different machine. Mobile visits are mostly reads of a link received in a message.

## Capabilities and Constraints

Confirmed existing behaviour to preserve:

- Create a paste with optional title, optional language, optional expiry in days, optional password.
- Share by short slug link; view the paste at `/p/<slug>`; raw plain text at `/raw/<slug>`.
- Edit an existing paste when a password was set on creation.
- Expired pastes are removed on access and return 404.

Added or corrected in this rebuild:

- A password set at creation now protects reading as well as editing. The paste owner chooses read protection explicitly; the old behaviour, where a password gated only editing and left content public, is a disclosure bug, not a feature. Both modes ship: password protects reading and editing by default.
- Content is stored in MongoDB when `MONGODB_URI` is set, and in a local SQLite file otherwise, so the app runs with no external service.

Constraints: no user accounts, no file uploads, no analytics that identify a person. Paste content is untrusted input and must never be rendered as HTML.

Undecided: retention policy beyond per-paste expiry, and rate limiting thresholds.

## Brand Commitments

Name: Stow. The name is a verb meaning to put something away carefully where it can be found again. Voice is plain, quiet, and specific: no exclamation marks, no growth language, no emoji. The product never calls itself a "pastebin".

## Evidence on Hand

The existing public deployment at orion-paste.vercel.app and its source at github.com/truepushkar/orion-paste establish the feature set above. There are no customers, testimonials, benchmarks, or usage numbers, and none may be invented.

## Product Principles

1. The text is the interface. Every piece of chrome earns its pixels against the content it frames.
2. One action per screen. Creating, reading, and unlocking are separate tasks and never share a crowded surface.
3. Protect by default. Anything that could leak a paste body requires an explicit decision from its author.
4. The link is the product. Nothing on the read page may obstruct copying or opening the document.
5. Works without ceremony. No account, no cookie wall, no modal on arrival.
