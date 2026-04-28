#!/bin/bash
# Navigate to the directory where this script is located
cd "$(dirname "$0")"

echo "------------------------------------------------"
echo "Initializing VENOM Neural Link..."
echo "------------------------------------------------"

# Check if node_modules exists, if not install
if [ ! -d "node_modules" ]; then
    echo "First time setup: Installing dependencies..."
    npm install
fi

# Start the Venom Neural Link as a Native App
npm run app

echo "------------------------------------------------"
echo "VENOM is now active at http://localhost:3000"
echo "Close this window to terminate the link."
echo "------------------------------------------------"

# Keep the script running so the server doesn't die immediately
wait
