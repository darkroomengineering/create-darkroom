import { describe, expect, test } from 'bun:test'
import { parseArgs } from './index.js'

describe('parseArgs', () => {
  test('defaults with no arguments', () => {
    expect(parseArgs([])).toEqual({
      name: undefined,
      starter: undefined,
      ref: 'main',
      preset: undefined,
      keep: undefined,
      cleanHomepage: false,
      skipSetup: false,
      skipInstall: false,
    })
  })

  test('reads the project name from the single positional', () => {
    expect(parseArgs(['my-project']).name).toBe('my-project')
  })

  test('reads value flags', () => {
    const args = parseArgs([
      'app',
      '--starter',
      'satus',
      '--ref',
      'v2.0.1',
      '--preset',
      'editorial',
    ])
    expect(args).toMatchObject({
      name: 'app',
      starter: 'satus',
      ref: 'v2.0.1',
      preset: 'editorial',
    })
  })

  test('reads boolean flags', () => {
    const args = parseArgs([
      '--clean-homepage',
      '--skip-setup',
      '--skip-install',
    ])
    expect(args).toMatchObject({
      cleanHomepage: true,
      skipSetup: true,
      skipInstall: true,
    })
  })

  test('accepts an empty --keep as the lean build', () => {
    expect(parseArgs(['--keep', '']).keep).toBe('')
  })

  test('accepts a comma-separated --keep', () => {
    expect(parseArgs(['--keep', 'sanity,webgl']).keep).toBe('sanity,webgl')
  })

  test('order of flags does not matter', () => {
    expect(parseArgs(['--starter', 'novus', 'app'])).toMatchObject({
      name: 'app',
      starter: 'novus',
    })
  })

  const rejections: [label: string, argv: string[], message: string][] = [
    ['unknown flag', ['--bogus'], 'Unknown flag: --bogus'],
    ['missing value', ['--ref'], '--ref requires a value'],
    [
      'value swallowed by the next flag',
      ['--ref', '--skip-install'],
      '--ref requires a value',
    ],
    [
      'unknown starter',
      ['--starter', 'nextjs'],
      'Unknown starter "nextjs" — expected satus or novus',
    ],
    [
      'preset and keep together',
      ['--preset', 'studio', '--keep', 'sanity'],
      '--preset and --keep are mutually exclusive',
    ],
    [
      'two positionals',
      ['one', 'two'],
      'Expected one project name, got: one, two',
    ],
  ]

  test.each(rejections)('rejects %s', (_label, argv, message) => {
    expect(() => parseArgs(argv)).toThrow(message)
  })
})
