// Keep existing bookmarks, public-letter fragments and administrator query strings.
const link = document.getElementById('destination');
if (link) {
  const target = new URL(link.href);
  target.search = location.search;
  target.hash = location.hash;
  link.href = target.href;
  location.replace(target.href);
}
