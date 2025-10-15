# Copilot Instructions for JSHack

## Project Overview
This project currently consists of a single HTML file: `js-hack.html`. It is a lightweight, standalone web application. There are no additional scripts, build systems, or external dependencies present in the codebase as of October 2025.

## Architecture & Patterns
- **Single-file structure:** All logic, markup, and styles are contained within `js-hack.html`. There are no separate JavaScript or CSS files.
- **No frameworks:** The project does not use React, Vue, Angular, or any other frontend framework. All code is plain HTML, CSS, and JavaScript.
- **No module system:** There is no use of ES modules, CommonJS, or bundlers.
- **No backend:** The project is purely client-side with no server or API integration.

## Developer Workflows
- **Editing:** Directly modify `js-hack.html` for all changes.
- **Testing:** Open `js-hack.html` in a web browser to test changes. There are no automated tests or test runners.
- **Debugging:** Use browser developer tools (F12) for inspecting and debugging code.
- **No build step:** There is no build or deployment process; the HTML file is served as-is.

## Project Conventions
- **Inline scripts and styles:** All JavaScript and CSS are expected to be written within `<script>` and `<style>` tags inside the HTML file.
- **Minimal external dependencies:** Avoid adding external libraries unless absolutely necessary. If required, use CDN links in the HTML `<head>`.
- **Self-contained features:** Any new functionality should be added in a way that keeps the project easy to understand and maintain as a single file.

## Examples
- To add a new feature, insert a `<script>` block at the end of `js-hack.html`.
- For styling, use a `<style>` block in the `<head>` or inline styles.
- Reference DOM elements directly using `document.getElementById` or similar vanilla JS methods.

## Key File
- `js-hack.html`: The only file in the project. All code changes should be made here.

---

**If the project expands to include more files or dependencies, update this document to reflect new conventions and workflows.**
