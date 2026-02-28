// Post-install banner — displayed after npm install in interactive terminals

try {
  if (process.stdout.isTTY) {
    const logo = `
                _       _       _
   ___ ___     (_)_ __ | |_ ___| |
  / __/ __|____| | '_ \\| __/ _ \\ |
 | (_| (_|_____| | | | | ||  __/ |
  \\___\\___|    |_|_| |_|\\__\\___|_|
`;

    process.stdout.write(logo);
    process.stdout.write('\n  Installed successfully!\n');
    process.stdout.write('  Run cc-intel --help to see all available commands.\n\n');
  }
} catch {
  // Silently ignore — banner is cosmetic
}
