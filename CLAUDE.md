# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Purpose

This repository stores Architecture Decision Records (ADRs) — markdown summaries documenting changes made across multiple software projects. Each file records the problem, root cause, solution, key files, and lessons learned for a specific change or feature.

## Naming Convention

Files are named `{project}-{brief-description}.md`. Current projects include:
- `einkbro` — Android browser app (Kotlin/JS)
- `koreader_plugin_vertical_read` — KOReader Lua plugin
- `webvtt-converter` — Calibre plugin (Python)
- `mandroid` — macOS SwiftUI app

## ADR Template

Every ADR follows this structure:

```markdown
# Title

## Problem
What was wrong or missing.

## Root Cause
Why the problem existed.

## Solution
What was changed and how, with subsections as needed.

## Key Files
List of files that were modified.

## Lessons Learned
Non-obvious insights from the work.
```

Some ADRs include additional sections like `## Original Plan` or `## Feature Spec Plan` when the change was large enough to warrant upfront design.
