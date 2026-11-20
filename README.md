# here-be-rants

A ranty blog about ranty things. Built with [Zola](https://www.getzola.org/) and a lot of JS/TS hate. Plus love for ASCII style art.

## Run it

Needs Zola 0.23.6 and pnpm.

Setup:

```
pnpm install
# For tests
pnpm exec playwright install chromium firefox
```

Run:

```sh
pnpm dev   # tsc --watch + zola serve on :1111, drafts included
```

Posts are simple markdown and go in `content/posts/`. The `content/posts/kitchen-sink/` post, however, is a test draft
with every markdown element possible and should never be published.

## Check it

Check:

```sh
# typecheck + unit tests + every page, both browsers, 3 widths
pnpm check
# one browser
pnpm check firefox
# unit tests only
pnpm test
```

It fails if any block element falls off the character grid, or if axe finds accessibility problems. One page also gets
checked with JavaScript disabled because for some reason I care about that. Screenshots are placed in `shots/` for
manual checking if needed.

## How it works

- All chars are on a 16px square grid, with a 16px font and 9px cells. See `static/css/site.css`.
- `src/castle.ts` builds the castle as rows of text.
- `src/walls.ts` measures the page, moves the content into the courtyard area and paints the castle behind it. It
  repaints on resize and when the content changes height.
- Each page's castle and fluff is random, but seeded by its title/path.
- `tsc` compiles `src/` to `static/js/`. This is simple enough we don't need a bundler. `tools/` and the tests are run
  by Node directly.
