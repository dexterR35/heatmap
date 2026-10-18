// The workspace uses a single light appearance, including older saved preferences.
(function () {
  document.documentElement.dataset.theme = 'light';
  try { localStorage.removeItem('netbet.workspace.theme'); } catch (_) {}
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = '#fafafa';
})();
