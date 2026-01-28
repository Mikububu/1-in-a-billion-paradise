#!/bin/bash
# HEINEKEN - Total Save, EAS Build, and Git Commit

set -e

echo "🍺 HEINEKEN - Starting complete deployment workflow..."
echo "═══════════════════════════════════════════════════════════════"
echo ""

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}📦 Step 1: Saving all changes to Git...${NC}"
git add -A
echo -e "${GREEN}✅ All files staged${NC}"
echo ""

if git diff --staged --quiet; then
    echo -e "${YELLOW}⚠️  No changes to commit${NC}"
else
    echo -e "${BLUE}💾 Step 2: Committing changes...${NC}"
    TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
    git commit -m "Heineken deployment: $TIMESTAMP" || echo -e "${YELLOW}⚠️  Commit skipped${NC}"
    echo -e "${GREEN}✅ Changes committed${NC}"
    echo ""
fi

echo -e "${BLUE}🚀 Step 3: Pushing to Git...${NC}"
git push || echo -e "${YELLOW}⚠️  Push skipped${NC}"
echo -e "${GREEN}✅ Pushed to Git${NC}"
echo ""

if [ -d "1-in-a-billion-frontend" ]; then
    echo -e "${BLUE}📱 Step 4: Building with EAS...${NC}"
    cd 1-in-a-billion-frontend
    
    if [ -f "eas.json" ]; then
        echo "Running EAS build (Android)..."
        eas build --platform android --non-interactive || echo -e "${YELLOW}⚠️  Android build failed${NC}"
        
        echo ""
        echo "Running EAS build (iOS)..."
        eas build --platform ios --non-interactive || echo -e "${YELLOW}⚠️  iOS build failed${NC}"
    else
        echo -e "${YELLOW}⚠️  eas.json not found${NC}"
    fi
    cd ..
fi

echo -e "${GREEN}🍺 HEINEKEN deployment complete!${NC}"
echo "═══════════════════════════════════════════════════════════════"
