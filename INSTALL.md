# Installation Guide for Estimate Genie

## Quick Fix for "command not found" Errors

If you're getting "command not found" when trying to run `npm` or `node`, it means Node.js is either:
1. Not installed on your system
2. Not in your PATH environment variable

## Step 1: Check if Node.js is Installed

Run this command in your terminal:
```bash
./check-node.sh
```

Or manually check:
```bash
node --version
npm --version
```

## Step 2: Install Node.js (if not installed)

### Option A: Using Homebrew (Recommended for macOS)
```bash
# Install Homebrew if you don't have it
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js
brew install node
```

### Option B: Official Installer
1. Visit https://nodejs.org/
2. Download the LTS (Long Term Support) version
3. Run the installer
4. Restart your terminal

### Option C: Using nvm (Node Version Manager)
```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Restart terminal or run:
source ~/.zshrc

# Install Node.js LTS
nvm install --lts
nvm use --lts
```

## Step 3: Verify Installation

After installing, restart your terminal and verify:
```bash
node --version  # Should show v20.x.x or higher
npm --version   # Should show 9.x.x or higher
```

## Step 4: Install Project Dependencies

Once Node.js is installed:
```bash
cd "/Users/gtsiranidi/Dropbox/Mac (2)/Documents/New project/Estimate-Genie"
npm install
```

## Step 5: Start the Server

```bash
npm run dev
```

Then open http://localhost:3000 in your browser.

## Troubleshooting

### If Node.js is installed but still not found:

1. **Find where Node.js is installed:**
   ```bash
   which node
   # or
   find /usr -name "node" 2>/dev/null
   find /opt -name "node" 2>/dev/null
   ```

2. **Add to PATH (temporary):**
   ```bash
   export PATH="/usr/local/bin:$PATH"
   export PATH="/opt/homebrew/bin:$PATH"
   ```

3. **Add to PATH permanently:**
   Edit `~/.zshrc` (or `~/.bash_profile` if using bash):
   ```bash
   echo 'export PATH="/usr/local/bin:$PATH"' >> ~/.zshrc
   echo 'export PATH="/opt/homebrew/bin:$PATH"' >> ~/.zshrc
   source ~/.zshrc
   ```

### If using nvm:
Make sure nvm is loaded in your shell:
```bash
echo 'export NVM_DIR="$HOME/.nvm"' >> ~/.zshrc
echo '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"' >> ~/.zshrc
source ~/.zshrc
```

## Need Help?

If you're still having issues, run the diagnostic script:
```bash
./check-node.sh
```

This will show you exactly what's installed and where.
