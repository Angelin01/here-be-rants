import Fuse from 'fuse.js';

// Fuse's threshold works per field, so weak mixed matches ("cafe" finding "carp") still come back. 0 is perfect
const MAX_SCORE = 0.5;

// One entry of Zola's search index, see [search] in zola.toml
export interface Entry {
  url: string;
  path: string;
  title: string;
  description: string;
  body: string;
}

// The index has every page, About and the section pages included. Only posts are worth finding
function isPost(entry: Entry): boolean {
  return entry.path.startsWith('/posts/') && entry.path !== '/posts/';
}

export function createSearch(entries: Entry[]): (query: string) => Entry[] {
  // The posts section is transparent, so Zola indexes every post twice, once per section
  const posts = [...new Map(entries.filter(isPost).map(entry => [entry.path, entry])).values()];

  const fuse = new Fuse(posts, {
    keys: [
      { name: 'title', weight: 3 },
      { name: 'description', weight: 2 },
      { name: 'body', weight: 1 },
      // Extended search wants every word in the same field, this one lets them come from different ones
      { name: 'all', weight: 1, getFn: entry => [entry.title, entry.description, entry.body].join(' ') },
    ],
    // Bodies are long, a match near the end is as good as one at the start
    ignoreLocation: true,
    // Otherwise a match in a long post scores worse than the same match in a short one
    ignoreFieldNorm: true,
    ignoreDiacritics: true,
    // Space separated words all have to match, each one still fuzzily
    useExtendedSearch: true,
    threshold: 0.35,
    minMatchCharLength: 2,
    includeScore: true,
  });

  return query => {
    if (!query.trim()) {
      return [];
    }

    return fuse.search(query).filter(result => result.score! <= MAX_SCORE).map(result => result.item);
  };
}
