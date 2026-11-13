# Study Notes

One page that links to all of my course notes and study guides: **https://namaray.github.io/study-notes/**

## How it works

`build.mjs` lists my public repos and keeps every one that

- is tagged `study-guide` or `course-notes`, and
- has GitHub Pages turned on.

It writes `dist/index.html` from `template.html`, and the workflow in `.github/workflows/pages.yml` deploys it to GitHub Pages. The workflow runs on every push and once a day, so a new guide shows up within 24 hours of being tagged. To pick it up straight away, run the workflow by hand from the Actions tab.

## Adding a guide

1. Give the repo the `study-guide` topic and turn on GitHub Pages.
2. Name it with the course code (e.g. `CSE-3811-Artificial-Intelligence`) so the code and title are read from the name.
3. If the name doesn't say enough, add an entry to `overrides.json` (`code`, `title`, `subject`, `summary`).

The text after the colon in the repo description becomes the card's summary.

## Building locally

```bash
node build.mjs
```

Set `GITHUB_TOKEN` to avoid the API's anonymous rate limit. Output goes to `dist/`.
