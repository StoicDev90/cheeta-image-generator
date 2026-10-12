# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
Existing: Flask (Python) serves a Vite + TypeScript frontend. Single page: `web/index.html` with `web/src/main.ts`. CSS stays inline in index.html. No UI framework.

## Users
One person (the owner), using it locally on their own machine to generate images from text prompts with their own Higgsfield API key.

## Product Purpose
A local web app that wraps Higgsfield's z-image/turbo model: write a prompt, set parameters, wait for the generation, and save the image automatically to `generated-images/`. Success: a prompt becomes a saved image with minimal friction and honest error states.

## Positioning
Personal, local image studio: the API key never reaches the browser, and every result is saved to disk with a timestamped filename.

## Operating Context
Runs at http://127.0.0.1:5000 via `python main.py`. Frontend is compiled with `npm run build` in `web/`. Each generation is billable and blocks until the API finishes.

## Capabilities and Constraints
- Parameters the model supports: prompt (1-800 chars), resolution (1k, 2k), aspect_ratio (1:1, 2:3, 3:2, 3:4, 4:3, 7:9, 9:7, 9:16, 16:9, 21:9), seed (0-2147483647, optional), prompt_extend (boolean).
- Reference image is NOT supported by z-image/turbo; the control stays visible but disabled.
- Failed, canceled, and NSFW-moderated requests must be reported as such, never as success.
- Saved filename: image-YYYY-MM-DD-HH-MM-SS.png.
- User-facing language: Spanish.

## Brand Commitments
Name: "Cheeta Image Generator Studio" (user-chosen). The user asked for a dark theme, new fonts, controls that feel like an AI image generation site, plus a header, footer, descriptive text, and a single index page.

## Evidence on Hand
No real example images, testimonials, or customers exist. Do not fabricate any. Generated images appear only after a real generation.

## Product Principles
- The studio (prompt, parameters, result) is the page; everything else supports it.
- Be honest about state: loading, success, failure, moderation, unsupported options.
- Spend the user's credits knowingly: make cost-bearing actions clear.
- Stay a single-page, dependency-light tool.
