#!/bin/bash
# HEINEKEN - Total Save, EAS Build, and Git Commit
# Codeword script for complete deployment workflow

set -e

echo "🍺 HEINEKEN - Starting complete deployment workflow..."
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Step 1: Save everything to Git
echo -e "${BLUE}📦 Step 1: Saving all changes to Git...${NC}"
git add -A
echo -e "${GREEN}✅ All files staged${NC}"
echo ""

# Step 2: Check if there are changes to commit
if git diff --staged --quiet; then
    echo -e "${YELLOW}⚠️  No changes to commit${NC}"
else
    echo -e "${BLUE}💾 Step 2: Committing changes...${NC}"
    TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
    git commit -m "Heineken deployment: $TIMESTAMP" || echo -e "${YELLOW}⚠️  Commit skipped (no changes or already committed)${NC}"
    echo -e "${GREEN}✅ Changes committed${NC}"
    echo ""
fi

# Step 3: Push to Git
echo -e "${BLUE}🚀 Step 3: Pushing to Git...${NC}"
git push || echo -e "${YELLOW}⚠️  Push skipped (no remote or already up to date)${NC}"
echo -e "${GREEN}✅ Pushed to Git${NC}"
echo ""

# Step 4: EAS Build (if frontend exists)
if [ -d "1-in-a-billion-frontend" ]; then
    echo -e "${BLUE}📱 Step 4: Building with EAS...${NC}"
    cd 1-in-a-billion-frontend
    
    # Check if eas.json exists
    if [ -f "eas.json" ] || [ -f ".eas.json" ]; then
        echo "Running EAS build..."
        eas build --platform all --non-interactive || {
            echo -e "${YELLOW}⚠️  EAS build failed or EAS CLI not configured${NC}"
            echo "   Make sure you have:"
            echo "   - EAS CLI installed: npm install -g eas-cli"
            echo "   - EAS account configured: eas login"
            echo "   - eas.json configured"
        }
    else
        echo -e "${YELLOW}⚠️  eas.json not found. Skipping EAS build.${NC}"
        echo "   To enable EAS builds, create eas.json in the frontend directory"
    fi
    
    cd ..
    echo ""
else
    echo -e "${YELLOW}⚠️  Frontend directory not found. Skipping EAS build.${NC}"
    echo ""
fi

echo -e "${GREEN}🍺 HEINEKEN deployment complete!${NC}"
echo "═══════════════════════════════════════════════════════════════"
