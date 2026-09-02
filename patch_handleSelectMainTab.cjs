const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');
code = code.replace(
  `    if (tab === 'announcements') {
      navigateToPath('/notices');
      return;
    }
    if (tab === 'resources') {
      navigateToPath('/resources');
      return;
    }

    setAppMainTab(tab);`,
  `    setAppMainTab(tab);

    if (tab === 'announcements') {
      navigateToPath('/notices');
      return;
    }
    if (tab === 'resources') {
      navigateToPath('/resources');
      return;
    }`
);
fs.writeFileSync('src/App.tsx', code);
