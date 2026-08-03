#!/usr/bin/env node
/**
 * create-darkroom — scaffold a darkroom.engineering project.
 *
 *   bun create darkroom [name] [options]
 *   npm create darkroom@latest -- [name] [options]
 *
 * Clones a starter (satus or novus) at a git ref, strips the starter's own repo
 * metadata, then delegates integration selection to the starter's in-repo
 * `setup:project` script. This CLI deliberately knows nothing about individual
 * integrations — that logic lives (and is tested) in each starter, so the CLI
 * never drifts.
 *
 * Options:
 *   --starter <satus|novus>   Skip the starter prompt
 *   --ref <branch|tag>        Clone a specific ref (default: main)
 *   --preset <key>            Pass-through to setup:project (non-interactive)
 *                             satus: editorial|studio|boutique|gallery|blank
 *   --keep <id,id,...>        Pass-through to setup:project ('' = lean build)
 *                             satus: sanity,shopify,hubspot,mailchimp,webgl,theatre
 *   --clean-homepage          Pass-through to setup:project
 *   --skip-setup              Clone + install only, run setup:project later
 *   --skip-install            Skip dependency installation
 */

import { spawnSync } from 'node:child_process'
import {
  existsSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as p from '@clack/prompts'
import pc from 'picocolors'

const STARTERS = {
  satus: {
    repo: 'https://github.com/darkroomengineering/satus.git',
    label: 'Satūs — Next.js',
    hint: 'Next.js 16, React 19, Tailwind v4, integrations: Sanity, Shopify, HubSpot, Mailchimp, WebGL, Theatre.js',
    hasSetup: true,
    note: undefined,
  },
  novus: {
    repo: 'https://github.com/darkroomengineering/novus.git',
    label: 'Novus — React Router',
    hint: 'React Router 7, React 19, Tailwind v4, Vite 8',
    hasSetup: false,
    // novus boots the bundled marketing site by default; a real project has to
    // opt into its own routes. Surfaced here because nothing else tells you.
    note: 'novus serves the bundled `example/` site until you point `appDirectory` at `app/` in react-router.config.ts',
  },
} as const

type StarterId = keyof typeof STARTERS

/**
 * Files that describe the *starter repo* rather than a project built from it.
 * They are harmless in the starter and wrong in a clone: FUNDING points at
 * darkroom's sponsors, the Slack and dependabot-automerge workflows are pinned
 * to darkroom's Vercel team and branch protection, and the changelog belongs to
 * the template's own history. Paths are relative to the project root; missing
 * entries are skipped, so this list can safely name files from either starter.
 *
 * LICENSE is deliberately NOT here. The starters are MIT, which requires the
 * notice to travel with substantial portions of the code — a scaffold is one.
 * Replace it by hand if the project ships under different terms.
 */
const STARTER_ONLY_PATHS = [
  '.github/FUNDING.yml',
  '.github/workflows/lighthouse-to-slack.yml',
  '.github/workflows/automerge-dependabot.yml',
  'CHANGELOG.md',
  'plans',
] as const

const VALUE_FLAGS = ['--starter', '--ref', '--preset', '--keep'] as const
const BOOLEAN_FLAGS = [
  '--clean-homepage',
  '--skip-setup',
  '--skip-install',
] as const

interface Args {
  name?: string
  starter?: StarterId
  ref: string
  preset?: string
  keep?: string
  cleanHomepage: boolean
  skipSetup: boolean
  skipInstall: boolean
}

/** Parse argv, failing loudly on unknown flags and flags missing a value. */
export function parseArgs(argv: string[]): Args {
  const positional: string[] = []
  const values = new Map<string, string>()
  const booleans = new Set<string>()

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string

    if ((VALUE_FLAGS as readonly string[]).includes(arg)) {
      const value = argv[i + 1]
      if (value === undefined || (value.startsWith('--') && value !== '--')) {
        throw new Error(`${arg} requires a value`)
      }
      values.set(arg, value)
      i++
    } else if ((BOOLEAN_FLAGS as readonly string[]).includes(arg)) {
      booleans.add(arg)
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown flag: ${arg}`)
    } else {
      positional.push(arg)
    }
  }

  if (positional.length > 1) {
    throw new Error(`Expected one project name, got: ${positional.join(', ')}`)
  }

  const starter = values.get('--starter')
  if (starter !== undefined && !(starter in STARTERS)) {
    throw new Error(
      `Unknown starter "${starter}" — expected ${Object.keys(STARTERS).join(' or ')}`,
    )
  }

  if (values.has('--preset') && values.has('--keep')) {
    throw new Error('--preset and --keep are mutually exclusive')
  }

  return {
    name: positional[0],
    starter: starter as StarterId | undefined,
    ref: values.get('--ref') ?? 'main',
    preset: values.get('--preset'),
    keep: values.get('--keep'),
    cleanHomepage: booleans.has('--clean-homepage'),
    skipSetup: booleans.has('--skip-setup'),
    skipInstall: booleans.has('--skip-install'),
  }
}

const NAME_PATTERN = /^[a-z0-9][a-z0-9._-]*$/

function validateName(name: string): string | undefined {
  if (!NAME_PATTERN.test(name)) {
    return 'Use lowercase letters, numbers, dots, dashes and underscores (must start alphanumeric)'
  }
  if (existsSync(resolve(process.cwd(), name))) {
    return `Directory "${name}" already exists`
  }
  return undefined
}

function commandExists(command: string): boolean {
  return spawnSync(command, ['--version'], { stdio: 'ignore' }).status === 0
}

/** Run a command with inherited stdio; returns true on exit code 0. */
function run(command: string, args: string[], cwd?: string): boolean {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' })
  return result.status === 0
}

function fail(message: string): never {
  p.cancel(message)
  process.exit(1)
}

async function promptName(): Promise<string> {
  const answer = await p.text({
    message: 'Project name?',
    placeholder: 'my-project',
    validate: (value) => (value ? validateName(value) : 'Name is required'),
  })
  if (p.isCancel(answer)) fail('Cancelled')
  return answer
}

async function promptStarter(): Promise<StarterId> {
  const answer = await p.select({
    message: 'Which starter?',
    options: (Object.keys(STARTERS) as StarterId[]).map((id) => ({
      value: id,
      label: STARTERS[id].label,
      hint: STARTERS[id].hint,
    })),
  })
  if (p.isCancel(answer)) fail('Cancelled')
  return answer
}

/**
 * Rewrite the cloned package.json into a fresh project manifest.
 *
 * `description` is dropped rather than rewritten — inheriting it would leave a
 * new project describing itself as the starter. `license` stays: it matches the
 * LICENSE file the scaffold keeps for MIT attribution.
 */
function personalizePackageJson(projectPath: string, name: string): void {
  const pkgPath = join(projectPath, 'package.json')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  pkg.name = name
  pkg.version = '0.1.0'
  pkg.private = true
  delete pkg.description
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
}

/** Delete the starter's own repo metadata from the new project. */
function removeStarterOnlyPaths(projectPath: string): void {
  for (const relative of STARTER_ONLY_PATHS) {
    rmSync(join(projectPath, relative), { recursive: true, force: true })
  }
}

async function main(): Promise<void> {
  let args: Args
  try {
    args = parseArgs(process.argv.slice(2))
  } catch (error) {
    console.error(pc.red((error as Error).message))
    process.exit(1)
  }

  p.intro(pc.inverse(' create-darkroom '))

  if (args.name !== undefined) {
    const nameError = validateName(args.name)
    if (nameError) fail(nameError)
  }

  const name = args.name ?? (await promptName())
  const starterId = args.starter ?? (await promptStarter())
  const starter = STARTERS[starterId]

  // These only mean something to a starter that ships setup:project. Accepting
  // them silently would let a CI invocation think it configured integrations
  // that were never applied.
  if (!starter.hasSetup) {
    const unsupported = [
      args.preset !== undefined && '--preset',
      args.keep !== undefined && '--keep',
      args.cleanHomepage && '--clean-homepage',
    ].filter((flag): flag is string => flag !== false)

    if (unsupported.length > 0) {
      fail(
        `${unsupported.join(', ')} ${unsupported.length === 1 ? 'is' : 'are'} not supported by ${starterId} — it has no integration setup step`,
      )
    }
  }

  const projectPath = resolve(process.cwd(), name)

  if (!commandExists('git')) {
    fail('git is required — install it from https://git-scm.com')
  }
  if (!commandExists('bun')) {
    fail(
      'bun is required by darkroom starters — install it from https://bun.sh',
    )
  }

  // 1. Clone the starter. History is stripped in step 4, once setup has run.
  p.log.step(`Cloning ${starter.label} (${args.ref})…`)
  const cloned = run('git', [
    'clone',
    '--depth',
    '1',
    '--branch',
    args.ref,
    starter.repo,
    projectPath,
  ])
  if (!cloned) {
    fail(`Failed to clone ${starter.repo} at ref "${args.ref}"`)
  }

  personalizePackageJson(projectPath, name)
  removeStarterOnlyPaths(projectPath)

  // 2. Install — required before setup:project, which imports dependencies.
  if (!args.skipInstall) {
    p.log.step('Installing dependencies…')
    if (!run('bun', ['install'], projectPath)) {
      fail('bun install failed')
    }
  }

  // 3. Delegate integration selection to the starter's own setup script.
  const runSetup = starter.hasSetup && !args.skipSetup && !args.skipInstall
  if (runSetup) {
    const setupArgs = ['run', 'setup:project']
    if (args.preset !== undefined) setupArgs.push('--preset', args.preset)
    if (args.keep !== undefined) setupArgs.push('--keep', args.keep)
    if (args.cleanHomepage) setupArgs.push('--clean-homepage')

    if (!run('bun', setupArgs, projectPath)) {
      fail('setup:project failed — the clone is intact, re-run it manually')
    }
  } else if (starter.hasSetup) {
    p.log.info('Skipping integration setup — run `bun run setup:project` later')
  }

  // 4. Fresh git history.
  rmSync(join(projectPath, '.git'), { recursive: true, force: true })
  run('git', ['init', '--quiet'], projectPath)
  run('git', ['add', '-A'], projectPath)
  const committed = run(
    'git',
    ['commit', '--quiet', '-m', 'Initial commit from create-darkroom'],
    projectPath,
  )
  if (!committed) {
    p.log.warn(
      'Could not create the initial commit (missing git identity?) — changes are staged',
    )
  }

  if (starter.note !== undefined) {
    p.log.info(starter.note)
  }

  p.outro(
    `Done. Next steps:\n\n  ${pc.cyan(`cd ${name}`)}\n  ${pc.cyan('bun dev')}`,
  )
}

/**
 * True when this file is the process entry point rather than an import.
 * `process.argv[1]` is the `.bin` symlink npm installs, so both sides are
 * resolved through realpath before comparing.
 */
function isEntryPoint(): boolean {
  const entry = process.argv[1]
  if (entry === undefined) return false
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url))
  } catch {
    return false
  }
}

if (isEntryPoint()) {
  main().catch((error) => {
    console.error(
      pc.red(error instanceof Error ? error.message : String(error)),
    )
    process.exit(1)
  })
}
