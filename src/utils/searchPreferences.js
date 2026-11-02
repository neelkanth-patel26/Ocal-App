export function searchEngineKey(isPrivate = false) {
  return isPrivate ? 'ocal-private-engine' : 'ocal-engine';
}

export function getSearchEngine(isPrivate = false) {
  return localStorage.getItem(searchEngineKey(isPrivate)) || (isPrivate ? 'DuckDuckGo' : 'Google');
}
