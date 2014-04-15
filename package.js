Package.describe({
  summary: 'Utilities for publishing relationships'
});

Package.on_use(function (api) {
  api.add_files('publish.js', 'server');
  api.export('Publisher', 'server');
});
