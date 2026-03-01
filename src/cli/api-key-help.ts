function shellProfile(): string {
  const shell = process.env['SHELL'] ?? '';
  if (shell.endsWith('/zsh')) return '~/.zshrc';
  if (shell.endsWith('/bash')) return '~/.bashrc';
  if (shell.endsWith('/fish')) return '~/.config/fish/config.fish';
  return '~/.bashrc or ~/.zshrc';
}

function unixInstructions(): string {
  const profile = shellProfile();

  return (
    '\n  Missing API key\n\n' +
    '  cc-intel uses Claude to extract knowledge from your sessions.\n' +
    '  You need an Anthropic API key (costs ~$0.001 per extraction).\n\n' +
    '  Step 1 - Get a key:\n' +
    '    https://console.anthropic.com/settings/keys\n\n' +
    '  Step 2 - Add the key to your shell (run these two commands):\n\n' +
    `    echo 'export ANTHROPIC_API_KEY=sk-ant-api03-your-key-here' >> ${profile}\n` +
    `    source ${profile}\n\n` +
    '  Your key is stored locally in your shell profile and never\n' +
    '  sent anywhere except the Anthropic API.\n'
  );
}

function windowsInstructions(): string {
  return (
    '\n  Missing API key\n\n' +
    '  cc-intel uses Claude to extract knowledge from your sessions.\n' +
    '  You need an Anthropic API key (costs ~$0.001 per extraction).\n\n' +
    '  Step 1 - Get a key:\n' +
    '    https://console.anthropic.com/settings/keys\n\n' +
    '  Step 2 - Add it as an environment variable:\n\n' +
    '    Option A - Via Windows Settings (recommended):\n' +
    '      1. Open Start and search "Environment Variables"\n' +
    '      2. Click "Edit the system environment variables"\n' +
    '      3. Click "Environment Variables..." button\n' +
    '      4. Under "User variables", click "New"\n' +
    '      5. Set Name:  ANTHROPIC_API_KEY\n' +
    '             Value: sk-ant-api03-your-key-here\n' +
    '      6. Click OK and restart your terminal\n\n' +
    '    Option B - Via PowerShell (permanent):\n' +
    '      [System.Environment]::SetEnvironmentVariable(\n' +
    '        "ANTHROPIC_API_KEY", "sk-ant-api03-your-key-here", "User"\n' +
    '      )\n' +
    '      Then restart your terminal.\n\n' +
    '  Your key is stored locally and never sent anywhere\n' +
    '  except the Anthropic API.\n'
  );
}

export function formatApiKeyHelp(): string {
  return process.platform === 'win32' ? windowsInstructions() : unixInstructions();
}
