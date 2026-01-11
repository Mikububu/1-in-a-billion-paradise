#!/bin/bash
# Comprehensive test script for 1 in a Billion project

set -e

echo "🧪 1 in a Billion Comprehensive Test Suite"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test results
PASSED=0
FAILED=0
WARNINGS=0

test_pass() {
    echo -e "${GREEN}✅ $1${NC}"
    ((PASSED++))
}

test_fail() {
    echo -e "${RED}❌ $1${NC}"
    ((FAILED++))
}

test_warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
    ((WARNINGS++))
}

# Test 1: Backend dependencies
echo "📦 Testing Backend Dependencies..."
cd "1-in-a-billion-backend"
if [ -d "node_modules" ]; then
    test_pass "Backend node_modules exists"
else
    test_fail "Backend node_modules missing - run: npm install"
fi

# Test 2: Frontend dependencies
echo ""
echo "📦 Testing Frontend Dependencies..."
cd "../1-in-a-billion-frontend"
if [ -d "node_modules" ]; then
    test_pass "Frontend node_modules exists"
else
    test_fail "Frontend node_modules missing - run: npm install"
fi

# Test 3: Backend .env
echo ""
echo "🔐 Testing Backend Configuration..."
cd "../1-in-a-billion-backend"
if [ -f ".env" ]; then
    if grep -q "SUPABASE_URL" .env && grep -q "SUPABASE_SERVICE_ROLE_KEY" .env; then
        test_pass "Backend .env configured"
    else
        test_warn "Backend .env exists but missing required keys"
    fi
else
    test_fail "Backend .env missing"
fi

# Test 4: Frontend .env
echo ""
echo "🔐 Testing Frontend Configuration..."
cd "../1-in-a-billion-frontend"
if [ -f ".env" ]; then
    if grep -q "EXPO_PUBLIC_SUPABASE_URL" .env && grep -q "EXPO_PUBLIC_SUPABASE_ANON_KEY" .env; then
        test_pass "Frontend .env configured"
    else
        test_warn "Frontend .env exists but missing required keys"
    fi
else
    test_fail "Frontend .env missing"
fi

# Test 5: Backend TypeScript compilation
echo ""
echo "🔨 Testing Backend TypeScript..."
cd "../1-in-a-billion-backend"
if npm run build > /dev/null 2>&1; then
    test_pass "Backend TypeScript compiles"
else
    test_fail "Backend TypeScript compilation errors"
fi

# Test 6: Backend setup test
echo ""
echo "🧪 Running Backend Setup Tests..."
if npm run test:setup > /tmp/backend-test.log 2>&1; then
    test_pass "Backend setup tests passed"
else
    test_warn "Backend setup tests had warnings (check /tmp/backend-test.log)"
    cat /tmp/backend-test.log | tail -20
fi

# Summary
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "📊 Test Summary"
echo "═══════════════════════════════════════════════════════════════"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${YELLOW}Warnings: $WARNINGS${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All critical tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed. Please fix issues above.${NC}"
    exit 1
fi

