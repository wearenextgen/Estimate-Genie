#!/bin/bash
# Diagnostic script to check Node.js installation

echo "=== Node.js Installation Checker ==="
echo ""

# Check various locations
echo "Checking for Node.js in common locations:"

# Standard locations
LOCATIONS=(
    "/usr/local/bin/node"
    "/opt/homebrew/bin/node"
    "/usr/bin/node"
    "$HOME/.nvm/versions/node/*/bin/node"
    "$HOME/.fnm/node-versions/*/installation/bin/node"
)

FOUND=false
for loc in "${LOCATIONS[@]}"; do
    if [ -f "$loc" ] || compgen -G "$loc" > /dev/null 2>&1; then
        echo "  ✓ Found: $loc"
        if [ -f "$loc" ]; then
            VERSION=$("$loc" -v 2>/dev/null)
            echo "    Version: $VERSION"
            FOUND=true
        fi
    fi
done

# Check PATH
echo ""
echo "Checking PATH:"
echo "  PATH=$PATH"
echo ""

# Try to find node in PATH
if command -v node &> /dev/null; then
    echo "✓ Node.js found in PATH: $(which node)"
    echo "  Version: $(node -v)"
    FOUND=true
elif command -v npm &> /dev/null; then
    echo "✓ npm found in PATH: $(which npm)"
    echo "  But node command not found (unusual)"
else
    echo "✗ Node.js not found in PATH"
fi

echo ""
if [ "$FOUND" = false ]; then
    echo "=== Node.js is NOT installed ==="
    echo ""
    echo "To install Node.js, choose one of these methods:"
    echo ""
    echo "1. Homebrew (Recommended for macOS):"
    echo "   brew install node"
    echo ""
    echo "2. Official Installer:"
    echo "   Visit https://nodejs.org/ and download the LTS version"
    echo ""
    echo "3. Using nvm (Node Version Manager):"
    echo "   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
    echo "   Then: nvm install --lts"
    echo ""
else
    echo "=== Node.js is installed ==="
    echo ""
    echo "If you're still getting 'command not found', try:"
    echo "  1. Restart your terminal"
    echo "  2. Run: source ~/.zshrc (or ~/.bash_profile)"
    echo "  3. Check if Node.js path is in your PATH variable"
fi
