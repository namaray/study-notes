// Builds dist/index.html from every public repo of OWNER that is tagged
// `study-guide` or `course-notes` and has GitHub Pages turned on.
// Run: GITHUB_TOKEN=... node build.mjs   (token optional locally; raises the rate limit)

import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";

const OWNER = process.env.GITHUB_REPOSITORY_OWNER || process.env.OWNER || "namaray";
const SELF = (process.env.GITHUB_REPOSITORY || "").split("/")[1] || "study-notes";
const TOPICS = ["study-guide", "course-notes"];
const HIDDEN_TAGS = new Set(["study-guide", "course-notes", "uiu", "igcse"]);

const SUBJECTS = {
  cse: "Computer Science",
  math: "Mathematics",
  phy: "Physics",
  igcse: "IGCSE",
  other: "Other",
};

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

async function fetchRepos() {
  const headers = { Accept: "application/vnd.github+json", "User-Agent": "study-notes-build" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const repos = [];
  for (let page = 1; ; page++) {
    const res = await fetch(
      `https://api.github.com/users/${OWNER}/repos?type=owner&per_page=100&page=${page}`,
      { headers },
    );
    if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
    const batch = await res.json();
    repos.push(...batch);
    if (batch.length < 100) return repos;
  }
}

function describe(repo, override) {
  const m = repo.name.match(/(CSE|MATH|PHY)[-_ ]?(\d{4})/i);
  const code = m ? `${m[1].toUpperCase()} ${m[2]}` : null;
  const subject = m ? m[1].toLowerCase() : "other";

  const title = repo.name
    .replace(/(CSE|MATH|PHY)[-_ ]?\d{4}/i, "")
    .replace(/study[-_ ]?guide|notes/gi, "")
    .split(/[-_]+/)
    .filter(Boolean)
    .join(" ")
    .replace(/\band\b/g, "&");

  // "UIU MATH 2201 study guide: coordinate geometry, ..." -> "Coordinate geometry, ..."
  const after = (repo.description || "").split(":")[1]?.trim().replace(/\.$/, "");
  const summary = after ? after[0].toUpperCase() + after.slice(1) : "";

  const flat = (s) => s.toLowerCase().replace(/[^a-z]/g, "");
  const tags = (repo.topics || []).filter(
    (t) => !HIDDEN_TAGS.has(t) && flat(t) !== flat(title),
  );

  return {
    name: repo.name,
    code,
    subject,
    title: title || repo.name,
    summary,
    tags,
    url: `https://${OWNER.toLowerCase()}.github.io/${repo.name}/`,
    source: repo.html_url,
    pushed: repo.pushed_at,
    ...override,
  };
}

function card(g) {
  const updated = new Date(g.pushed).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  const search = [g.code, g.title, g.summary, g.name, ...g.tags].join(" ").toLowerCase();
  return `
      <article class="card" data-subject="${g.subject}" data-search="${esc(search)}">
        <div class="card-top">
          <span class="code">${esc(g.code || "Notes")}</span>
          <time datetime="${esc(g.pushed)}" title="Last updated">${updated}</time>
        </div>
        <h3><a class="stretch" href="${esc(g.url)}">${esc(g.title)}</a></h3>
        ${g.summary ? `<p class="summary">${esc(g.summary)}</p>` : ""}
        ${g.tags.length ? `<ul class="tags">${g.tags.map((t) => `<li>${esc(t.replace(/-/g, " "))}</li>`).join("")}</ul>` : ""}
        <div class="card-foot">
          <span class="open">Open notes <span aria-hidden="true">→</span></span>
          <a class="source" href="${esc(g.source)}">Source</a>
        </div>
      </article>`;
}

const overrides = JSON.parse(await readFile(new URL("./overrides.json", import.meta.url), "utf8"));
const guides = (await fetchRepos())
  .filter((r) => !r.private && !r.fork && !r.archived && r.has_pages && r.name !== SELF)
  .filter((r) => (r.topics || []).some((t) => TOPICS.includes(t)))
  .map((r) => describe(r, overrides[r.name]))
  .sort((a, b) => (a.code || a.title).localeCompare(b.code || b.title, "en", { numeric: true }));

const present = Object.keys(SUBJECTS).filter((s) => guides.some((g) => g.subject === s));

const sections = present
  .map((s) => {
    const list = guides.filter((g) => g.subject === s);
    return `
    <section class="group" data-subject="${s}">
      <h2>${SUBJECTS[s]} <span class="count">${list.length}</span></h2>
      <div class="grid">${list.map(card).join("")}
      </div>
    </section>`;
  })
  .join("\n");

const chips = [`<button class="chip" aria-pressed="true" data-filter="all">All</button>`]
  .concat(present.map((s) => `<button class="chip" aria-pressed="false" data-filter="${s}">${SUBJECTS[s]}</button>`))
  .join("\n        ");

const built = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

const html = (await readFile(new URL("./template.html", import.meta.url), "utf8"))
  .replace("{{COUNT}}", guides.length)
  .replace("{{SUBJECT_COUNT}}", present.length)
  .replace("{{CHIPS}}", chips)
  .replace("{{SECTIONS}}", sections)
  .replace("{{BUILT}}", built)
  .replaceAll("{{OWNER}}", OWNER);

await mkdir(new URL("./dist/", import.meta.url), { recursive: true });
await writeFile(new URL("./dist/index.html", import.meta.url), html);
await copyFile(new URL("./favicon.svg", import.meta.url), new URL("./dist/favicon.svg", import.meta.url));
console.log(`Built ${guides.length} guides: ${guides.map((g) => g.code || g.name).join(", ")}`);
