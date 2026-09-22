# churnmap

Every codebase has a handful of files that eat most of the team's time. They're
big, everybody touches them, and they're where the bugs and merge conflicts keep
coming from. `churnmap` reads your git history and tells you which ones they are.

```
npx churnmap
```

```
  #           score  commits  lines  authors  owner   last  file
  1  ██████████ 100       52   1451        3    44%  today  src/billing/invoice.ts
  2  ██████····  57       39    838        3    41%  today  src/api/routes.ts
  3  ████······  37       24    923        3    50%  today  src/ui/Checkout.tsx
  4  ███·······  27       29    328        3    48%  today  src/billing/tax.ts
  5  █·········  11       14    263        3    43%  today  src/api/auth.ts
  6  █·········   7       18     57        3    56%  today  src/config.ts

  Change together
   72%  29x  src/billing/invoice.ts <-> src/billing/tax.ts
   63%  24x  src/billing/invoice.ts <-> src/ui/Checkout.tsx
   53%  14x  src/api/auth.ts <-> src/api/routes.ts

  121 commits, 8 files. score = commits x sqrt(lines), 100 is the worst file.
```

No dependencies, no config, no upload of your code anywhere. It shells out to
`git log`, counts lines in your working tree, and prints a table. Works on
Linux, macOS and Windows with Node 18 or newer.

## Why these two numbers

A file that's large but never changes is fine, nobody has to read it. A file
that changes every day but is 40 lines long is fine too. The trouble is when
both are true: a big file that keeps getting edited is where people lose
context, step on each other, and ship regressions. This idea comes from Adam
Tornhill's *Your Code as a Crime Scene*, and it holds up well in practice.

The score is `commits * sqrt(lines)`, scaled so the worst file is 100. The
square root keeps one giant generated file from drowning out everything else.

## Reading the table

- **commits** is how many non-merge commits touched the file.
- **lines** is the current size on disk. Files that no longer exist are skipped.
- **authors** is how many different people changed it.
- **owner** is the share of commits made by the most active author. When it's
  80% or more on a file with some history, it's highlighted: one person holds
  most of the knowledge about that file.
- **last** is how long ago it last changed.

`--coupling` adds pairs of files that tend to change in the same commit. Some
of that is expected (a component and its test). The surprising pairs, like a
billing module that moves whenever the checkout UI does, usually point at a
missing abstraction. Commits touching more than 30 files are ignored here,
since mass renames and reformatting say nothing about design.

## Usage

```
churnmap [options] [path]

  -n, --top <n>          how many files to show (default 15)
  -s, --since <when>     only look at history after this, e.g. "6 months ago"
  -x, --exclude <glob>   skip matching files, repeatable
      --no-default-excludes
                         don't skip lockfiles, source maps and minified files
  -c, --coupling         also list files that usually change together
      --min-shared <n>   minimum shared commits for a coupled pair (default 5)
  -C <dir>               run as if started in <dir>
      --json             machine-readable output
```

Some things worth trying:

```sh
# what's been hurting lately, not five years ago
churnmap --since "6 months ago"

# just the backend, ignoring tests
churnmap services/api -x "*_test.go"

# feed it into something else
churnmap --json --top 50 | jq '.hotspots[] | select(.authors == 1)'
```

Exclude patterns follow `.gitignore` rules loosely: `*.md` matches at any depth,
`docs/` matches a directory, and anything containing a slash is anchored to the
repo root. Lockfiles, `*.min.js`, `*.map` and `*.snap` are skipped unless you
pass `--no-default-excludes`.

Colors turn off automatically when output isn't a terminal, or when `NO_COLOR`
is set.

## Install

```
npm install -g churnmap
```

Or run it straight from a checkout:

```
git clone https://github.com/himi9046-hub/churnmap
node churnmap/bin/churnmap.js -C path/to/repo
```

## Limitations

- Renames aren't followed, so a file that was moved recently starts its history
  from the move. This keeps `git log` fast on large repos.
- Line count is a rough proxy for complexity. It's crude, but it's also
  language-agnostic and good enough to rank files against each other.
- Authors are grouped by name, so if people commit under several spellings, add
  a `.mailmap`. Git applies it automatically.

## License

MIT
