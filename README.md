# create-darkroom

Scaffold a [darkroom.engineering](https://darkroom.engineering) project:

```sh
bun create darkroom my-project
# or
npm create darkroom@latest my-project
```

You'll be asked which starter to use and — for satus — which integrations to keep:

- **[satus](https://github.com/darkroomengineering/satus)** — Next.js, React 19, Tailwind v4. Integrations: Sanity, Shopify, WebGL, HubSpot, Mailchimp.
- **[novus](https://github.com/darkroomengineering/novus)** — React Router (framework mode).

## How it works

The CLI is a thin orchestrator. It clones the starter you pick, installs dependencies, then hands off to the starter's own `setup:project` script for integration selection — all integration knowledge lives (and is tested) in each starter repo, so this package rarely needs updating.

For satus, the starter's git ref is recorded into the new project's `package.json` (`satus.ref`) before history is stripped, so integrations removed at setup can be restored later with `bun run satus add <plugin>`.

The clone's git history is replaced with a fresh `git init` + initial commit.

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

Non-interactive example (CI):

```sh
bun create darkroom my-project --starter satus --keep sanity,shopify --clean-homepage
```

## Requirements

- [bun](https://bun.sh) — darkroom starters use bun as their package manager and script runner
- git
- Node 20+ (only when invoked via `npm create`)
