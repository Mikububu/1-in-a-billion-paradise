# 🍺 HEINEKEN - Complete Deployment Workflow

## Overview

**HEINEKEN** is a codeword/script that performs a complete deployment workflow:
1. **Total Save**: Stages all changes to Git (`git add -A`)
2. **Git Commit**: Commits all changes with timestamp
3. **Git Push**: Pushes to remote repository
4. **EAS Build**: Builds the mobile app using Expo Application Services

## Usage

### Run the Script

```bash
./heineken.sh
```

Or from anywhere in the project:

```bash
bash heineken.sh
```

### What It Does

1. **📦 Save Everything**
   - Stages all changes: `git add -A`
   - Includes all modified, new, and deleted files

2. **💾 Git Commit**
   - Commits with message: "Heineken deployment: [timestamp]"
   - Skips if no changes to commit

3. **🚀 Git Push**
   - Pushes to remote repository
   - Skips if no remote or already up to date

4. **📱 EAS Build**
   - Changes to `1-in-a-billion-frontend` directory
   - Runs `eas build --platform all`
   - Requires:
     - EAS CLI installed: `npm install -g eas-cli`
     - EAS account configured: `eas login`
     - `eas.json` file in frontend directory

## Prerequisites

### For Git Operations
- Git repository initialized
- Remote repository configured (optional, will skip if not available)

### For EAS Build
- EAS CLI installed globally:
  ```bash
  npm install -g eas-cli
  ```
- EAS account logged in:
  ```bash
  eas login
  ```
- `eas.json` configured in `1-in-a-billion-frontend/` directory

## Error Handling

The script uses `set -e` but includes graceful fallbacks:
- ✅ Continues if commit has no changes
- ✅ Continues if push fails (no remote)
- ✅ Continues if EAS build fails (logs warning)
- ✅ Continues if frontend directory doesn't exist

## Example Output

```
🍺 HEINEKEN - Starting complete deployment workflow...
═══════════════════════════════════════════════════════════════

📦 Step 1: Saving all changes to Git...
✅ All files staged

💾 Step 2: Committing changes...
✅ Changes committed

🚀 Step 3: Pushing to Git...
✅ Pushed to Git

📱 Step 4: Building with EAS...
Running EAS build...
✅ Build started

🍺 HEINEKEN deployment complete!
═══════════════════════════════════════════════════════════════
```

## Notes

- The script is safe to run multiple times
- It will skip steps if there's nothing to do
- EAS builds can take 10-30 minutes depending on platform
- Make sure you have EAS build credits/quota available

## Troubleshooting

### EAS Build Fails
- Check EAS CLI is installed: `eas --version`
- Check you're logged in: `eas whoami`
- Verify `eas.json` exists in frontend directory
- Check EAS account has build quota

### Git Push Fails
- Check remote is configured: `git remote -v`
- Check you have push permissions
- Verify network connection

### No Changes to Commit
- This is normal if everything is already committed
- The script will skip the commit step gracefully
