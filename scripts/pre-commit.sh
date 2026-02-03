#!/bin/bash
# ============================================
# QScrap Pre-commit Hook
# Blocks debug/test junk before commit
# Install: cp scripts/pre-commit.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
# ============================================

set -e

echo "🔍 Running pre-commit checks..."

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ERRORS=0

# ============================================
# 1. Check for debug files
# ============================================
DEBUG_FILES=$(git diff --cached --name-only | grep -E "^debug_|\.debug\." || true)
if [ -n "$DEBUG_FILES" ]; then
    echo -e "${RED}❌ Debug files detected:${NC}"
    echo "$DEBUG_FILES"
    ERRORS=$((ERRORS + 1))
fi

# ============================================
# 2. Check for console.log in staged .ts files
# ============================================
STAGED_TS=$(git diff --cached --name-only --diff-filter=ACM | grep "\.ts$" | grep -v "\.test\." | grep -v "\.spec\." || true)
if [ -n "$STAGED_TS" ]; then
    CONSOLE_LOGS=$(echo "$STAGED_TS" | xargs grep -l "console\.log" 2>/dev/null || true)
    if [ -n "$CONSOLE_LOGS" ]; then
        echo -e "${YELLOW}⚠️ console.log found in staged files:${NC}"
        echo "$CONSOLE_LOGS"
        # Warning only, not blocking
    fi
fi

# ============================================
# 3. Check for hardcoded secrets patterns
# ============================================
SECRET_PATTERNS="password\s*=\s*['\"][^'\"]+['\"]|api_key\s*=\s*['\"][^'\"]+['\"]|secret\s*=\s*['\"][^'\"]+['\"]"
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM || true)
if [ -n "$STAGED_FILES" ]; then
    SECRETS=$(echo "$STAGED_FILES" | xargs grep -lEi "$SECRET_PATTERNS" 2>/dev/null | grep -v "\.example\|\.sample\|\.md" || true)
    if [ -n "$SECRETS" ]; then
        echo -e "${RED}❌ Potential hardcoded secrets detected:${NC}"
        echo "$SECRETS"
        ERRORS=$((ERRORS + 1))
    fi
fi

# ============================================
# 4. Check for large files
# ============================================
LARGE_FILES=$(git diff --cached --name-only --diff-filter=ACM | xargs -I {} sh -c 'test -f "{}" && du -k "{}" | awk "\$1 > 5000 { print \$2 }"' 2>/dev/null || true)
if [ -n "$LARGE_FILES" ]; then
    echo -e "${YELLOW}⚠️ Large files (>5MB) detected:${NC}"
    echo "$LARGE_FILES"
fi

# ============================================
# 5. Check for merge conflict markers
# ============================================
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM || true)
if [ -n "$STAGED_FILES" ]; then
    CONFLICT_MARKERS=$(echo "$STAGED_FILES" | xargs grep -l "^<<<<<<< \|^=======$\|^>>>>>>> " 2>/dev/null || true)
    if [ -n "$CONFLICT_MARKERS" ]; then
        echo -e "${RED}❌ Merge conflict markers found:${NC}"
        echo "$CONFLICT_MARKERS"
        ERRORS=$((ERRORS + 1))
    fi
fi

# ============================================
# Summary
# ============================================
if [ $ERRORS -gt 0 ]; then
    echo ""
    echo -e "${RED}❌ Pre-commit failed with $ERRORS error(s)${NC}"
    echo "Fix the issues above or use 'git commit --no-verify' to bypass"
    exit 1
else
    echo -e "${GREEN}✅ Pre-commit checks passed${NC}"
    exit 0
fi
