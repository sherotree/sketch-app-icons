export interface Copy {
  searchLabel: string
  searchPlaceholder: string
  clearSearch: string
  regionLabel: string
  suggestionsLabel: string
  suggestions: readonly string[]
  recent: string
  removeRecent: string
  loading: string
  resultCount: (count: number) => string
  noResults: string
  noResultsHint: string
  errorTitle: string
  errorHint: string
  retry: string
  resultsLabel: string
  idleTitle: string
  idleBody: string
  insert: string
  inserting: string
  inserted: string
  insertFailed: string
  noDocument: string
  rights: string
  privacy: string
  privacyTitle: string
  privacyBody: string
  privacyLocal: string
  privacyPolicy: string
  webTool: string
  close: string
  selectedLabel: string
}

export const copy: Copy = {
  searchLabel: 'Search apps',
  searchPlaceholder: 'Search apps, e.g. Notion',
  clearSearch: 'Clear search',
  regionLabel: 'App Store region',
  suggestionsLabel: 'Try a search',
  suggestions: ['Notion', 'Figma', 'Spotify', 'Linear', 'Slack', 'Things'],
  recent: 'Recent',
  removeRecent: 'Remove',
  loading: 'Searching the App Store',
  resultCount: count => (count === 1 ? '1 app' : `${count} apps`),
  noResults: 'No apps found',
  noResultsHint: 'Try another name, or switch the store region.',
  errorTitle: 'Search unavailable',
  errorHint: 'Check your connection and try again.',
  retry: 'Try again',
  resultsLabel: 'Search results',
  idleTitle: 'Find an app icon',
  idleBody: 'Search by name, pick a result, then insert a PNG.',
  insert: 'Insert PNG',
  inserting: 'Inserting…',
  inserted: 'Inserted',
  insertFailed: 'Could not insert this icon. Try again.',
  noDocument: 'Open a Sketch document to insert an icon.',
  rights: 'Icons belong to their publishers. Get permission before you publish them.',
  privacy: 'Privacy',
  privacyTitle: 'What this plugin sends',
  privacyBody:
    'The name you search and the region you pick are sent to Apple’s App Store search. Uwarp does not receive those searches. Icon files are downloaded from Apple only when you insert one.',
  privacyLocal: 'Your region and recent searches stay in Sketch. Removing the plugin clears them.',
  privacyPolicy: 'Privacy policy',
  webTool: 'Open the web version',
  close: 'Close',
  selectedLabel: 'Selected app',
}
