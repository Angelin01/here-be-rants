import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSearch, type Entry } from './search.ts';

function entry(path: string, title: string, body: string, description = ''): Entry {
  return { url: `https://example.com${path}`, path, title, description, body };
}

const ENTRIES = [
  entry('/posts/fixed-timesteps/', 'Fixed timesteps', 'Physics at a steady rate, served in a café.'),
  entry('/posts/one-carp/', 'On losing a fortress to one carp', 'It came out of the brook.'),
  entry('/posts/fishing/', 'Gone fishing', 'Nothing bites but the occasional carp.'),
  entry('/about/', 'About', 'Somebody who writes about physics.'),
  entry('/posts/', 'Posts', ''),
];
const search = createSearch(ENTRIES);
const titles = (query: string) => search(query).map(e => e.title);

test('given a word from the title or body, when searching, then those posts are found', () => {
  assert.deepEqual(titles('timesteps'), ['Fixed timesteps']);
  assert.deepEqual(titles('brook'), ['On losing a fortress to one carp']);
});

test('given a typo, when searching, then the post is still found', () => {
  assert.deepEqual(titles('timestpes'), ['Fixed timesteps']);
});

test('given different case or missing accents, when searching, then the post is still found', () => {
  assert.deepEqual(titles('FIXED'), ['Fixed timesteps']);
  assert.deepEqual(titles('cafe'), ['Fixed timesteps']);
});

test('given several words, when searching, then every one of them has to match', () => {
  assert.deepEqual(titles('steady physics'), ['Fixed timesteps']);
  assert.deepEqual(titles('steady dragons'), []);
});

test('given words split between the title and the body, when searching, then the post is found', () => {
  assert.deepEqual(titles('fixed physics'), ['Fixed timesteps']);
  assert.deepEqual(titles('carp brook'), ['On losing a fortress to one carp']);
});

test('given a word in one title and another body, when searching, then the title match ranks first', () => {
  assert.deepEqual(titles('carp'), ['On losing a fortress to one carp', 'Gone fishing']);
});

test('given a word deep in a long body, when searching, then the post is found', () => {
  const long = createSearch([entry('/posts/long/', 'Long', `${'filler words here. '.repeat(200)}a lonely carp`)]);
  assert.deepEqual(long('carp').map(e => e.title), ['Long']);
});

test('given a word only on non-post pages, when searching, then nothing is found', () => {
  assert.deepEqual(titles('somebody'), []);
});

test('given an empty or blank query, when searching, then nothing is returned', () => {
  assert.deepEqual(titles(''), []);
  assert.deepEqual(titles('   '), []);
});
