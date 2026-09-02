const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');
code = code.replace(
  `    if (routeState) {
      if (tab === 'challenges') {
        navigateToPath('/challenges');
      } else if (tab === 'members') {
        navigateToPath('/members');
      } else {
        navigateToPath('/');
      }
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }`,
  `    if (tab === 'challenges') {
      navigateToPath('/challenges');
    } else if (tab === 'members') {
      navigateToPath('/members');
    } else {
      if (routeState) navigateToPath('/');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }`
);
fs.writeFileSync('src/App.tsx', code);
