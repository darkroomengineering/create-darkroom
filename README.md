# create-darkroom

Scaffold a [darkroom.engineering](https://darkroom.engineering) project:

```sh
bun create darkroom my-project
# or
npm create darkroom@latest my-project
```

You'll be asked which starter to use and — for satus — which integrations to keep:

- **[satus](https://github.com/darkroomengineering/satus)** — Next.js 16, React 19, Tailwind v4. Integrations: Sanity, Shopify, HubSpot, Mailchimp, WebGL, Theatre.js.
- **[novus](https://github.com/darkroomengineering/novus)** — React Router 7 (framework mode), React 19, Tailwind v4, Vite 8.

## How it works

The CLI is a thin orchestrator. It clones the starter you pick, installs dependencies, then hands off to the starter's own `setup:project` script for integration selection — all integration knowledge lives (and is tested) in each starter repo, so this package rarely needs updating.

On top of the clone it does three things:

1. Rewrites `package.json` — sets your project name, resets the version to `0.1.0`, marks it `private`, and drops the starter's `description` and `license` so your project doesn't inherit them.
2. Deletes the starter's own repo metadata — `.github/FUNDING.yml`, the Slack and dependabot-automerge workflows (both pinned to darkroom's Vercel team and branch protection), `CHANGELOG.md`, `LICENSE`, and `plans/`. The starter's CI, dependabot config and PR template are kept.
3. Replaces the clone's git history with a fresh `git init` + initial commit.

## Options

```
bun create darkroom [name] [options]

--starter <satus|novus>   Skip the starter prompt
--ref <branch|tag>        Clone a specific ref (default: main)
--preset <key>            Non-interactive: use a satus preset
--keep <id,id,...>        Non-interactive: keep an explicit integration set ('' = lean)
--clean-homepage          Replace the satus landing page with a blank homepage
--skip-setup              Clone + install only; run `bun run setup:project` later
--skip-install            Skip dependency installation (implies --skip-setup)
```

`--preset` and `--keep` are mutually exclusive, and both are satus-only — novus ships no integration picker.

| `--preset` | Keeps |
| --- | --- |
| `editorial` | sanity, hubspot, mailchimp |
| `boutique` | shopify, hubspot, mailchimp |
| `studio` | everything |
| `gallery` | everything |
| `blank` | nothing |

Valid `--keep` ids: `sanity`, `shopify`, `hubspot`, `mailchimp`, `webgl`, `theatre`. Keeping `theatre` also keeps `webgl`, which it depends on.

Non-interactive example (CI):

```sh
bun create darkroom my-project --starter satus --keep sanity,shopify --clean-homepage
```

Pin a starter release instead of tracking `main`:

```sh
bun create darkroom my-project --starter satus --ref v2.0.1
```

## After scaffolding

- **satus** — `bun dev`. Re-run `bun run setup:project` any time to change the integration set.
- **novus** — `bun dev` serves the bundled `example/` marketing site. Point `appDirectory` at `app/` in `react-router.config.ts` and delete `example/` to start on your own routes.

## Requirements

- [bun](https://bun.sh) ≥ 1.3.5 — darkroom starters use bun as their package manager and script runner
- git
- Node ≥ 22 — required by both starters, and by `npm create` when you invoke it that way
