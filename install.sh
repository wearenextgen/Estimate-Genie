#!/bin/bash
# Install script for Estimate Genie dependencies

echo "Installing Estimate Genie dependencies..."
echo ""

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo "❌ Error: npm is not found in PATH."
    echo ""
    echo "Node.js is not installed or not in your PATH."
    echo ""
    echo "Quick fix options:"
    echo ""
    echo "1. If you have Homebrew installed:"
    echo "   brew install node"
    echo ""
    echo "2. Download from official site:"
    echo "   Visit https://nodejs.org/ and download the LTS version"
    echo ""
    echo "3. Run diagnostic script to check your system:"
    echo "   ./check-node.sh"
    echo ""
    echo "4. See INSTALL.md for detailed instructions"
    echo ""
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "Warning: Node.js version 20+ is recommended."
    echo "Current version: $(node -v)"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Install dependencies
echo "Running npm install..."
npm install

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Dependencies installed successfully!"
    echo ""
    echo "To start the server, run:"
    echo "  npm run dev"
    echo ""
    echo "Then open http://localhost:3000 in your browser"
else
    echo ""
    echo "❌ Installation failed. Please check the error messages above."
    exit 1
fi
