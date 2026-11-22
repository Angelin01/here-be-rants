import { createSearch, type Entry } from './search.ts';

type Search = (query: string) => Entry[];

const box = document.querySelector<HTMLInputElement>('#search');
const listing = document.getElementById('listing')!;
const results = document.getElementById('results')!;
const noResults = document.getElementById('no-results')!;
const dates: Record<string, string> = JSON.parse(document.getElementById('post-dates')?.textContent ?? '{}');

let search: Promise<Search> | null = null;

// Fetched on the first keystroke, so readers who never search never download it
function loadSearch(url: string): Promise<Search> {
  search ??= fetch(url).then(response => response.json()).then(createSearch);
  return search;
}

// Same markup as post_list.html. Built with textContent, so a title can never inject HTML
function resultRow(entry: Entry): HTMLLIElement {
  const link = document.createElement('a');
  link.href = entry.url;
  link.textContent = entry.title;

  const dots = document.createElement('span');
  dots.className = 'dots';

  const time = document.createElement('time');
  const date = dates[entry.path] ?? '';
  time.dateTime = date;
  time.textContent = date.replaceAll('-', '.');

  const row = document.createElement('li');
  row.append(link, dots, time);
  return row;
}

function showListing() {
  listing.hidden = false;
  results.hidden = true;
  noResults.hidden = true;
}

async function update(input: HTMLInputElement) {
  if (!input.value.trim()) {
    showListing();
    return;
  }

  let run: Search;
  try {
    run = await loadSearch(input.dataset.index!);
  } catch {
    // Keep the listing rather than claim nothing matches, and try again on the next keystroke
    search = null;
    return;
  }

  // Read after the await, so a slow first fetch still searches for what's typed now
  const hits = run(input.value);
  if (!input.value.trim()) {
    showListing();
    return;
  }

  results.replaceChildren(...hits.map(resultRow));
  listing.hidden = true;
  results.hidden = hits.length === 0;
  noResults.hidden = hits.length > 0;
}

function main() {
  if (!box) {
    return;
  }

  box.closest<HTMLElement>('.search')!.hidden = false;
  box.addEventListener('input', () => update(box));
}

main();
