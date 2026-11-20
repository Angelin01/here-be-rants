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
pnpm dev   # zola serve on :1111, drafts included
```

Posts are simple markdown and go in `content/posts/`. The `content/posts/kitchen-sink/` post, however, is a test draft
with every markdown element possible and should never be published.

## Check it

Check:

```sh
# typecheck + every page, both browsers, 3 widths
pnpm check
# one browser
pnpm check firefox
```

It fails if any block element falls off the character grid, or if axe finds accessibility problems. One page also gets
checked with JavaScript disabled because for some reason I care about that. Screenshots are placed in `shots/` for
manual checking if needed.
