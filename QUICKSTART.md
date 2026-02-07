# Quick Start Guide

## The Problem You're Having

You're getting "command not found" errors because **Node.js is not installed** on your system.

## The Solution (3 Steps)

### Step 1: Install Node.js

**Option A - Official Installer (Easiest):**
1. Go to https://nodejs.org/
2. Download the **LTS version** (recommended)
3. Run the installer
4. Restart your terminal

**Option B - Homebrew (if you have it):**
```bash
brew install node
```

**Option C - Using nvm (for developers):**
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.zshrc
nvm install --lts
```

### Step 2: Verify Installation

Open a new terminal and run:
```bash
node --version   # Should show v20.x.x or higher
npm --version    # Should show 9.x.x or higher
```

If these commands work, you're ready!

### Step 3: Install and Run

```bash
# Navigate to project directory
cd "/Users/gtsiranidi/Dropbox/Mac (2)/Documents/New project/Estimate-Genie"

# Install dependencies
npm install

# Start the server
npm run dev
```

Then open http://localhost:3000 in your browser.

## What Was Fixed

✅ Removed redundant/unused code
✅ Fixed all import paths
✅ Added comprehensive error handling
✅ Verified all dependencies
✅ Added server startup error handling
✅ Created proper configuration files

## Still Having Issues?

Run the diagnostic script:
```bash
./check-node.sh
```

This will tell you exactly what's wrong and how to fix it.

## Need Help?

Check these files:
- `FIXES.md` - Detailed list of all fixes
- `INSTALL.md` - Complete installation guide
- `README.md` - Full documentation
