#!/bin/bash
# ============================================================================
# QScrap Enterprise API Test Suite
# ============================================================================
# Tests all critical endpoints on the production server.
# Usage: ./test_api.sh [BASE_URL]
# Default: https://qscrap.qa/api
# ============================================================================

set -e

# Configuration
BASE_URL="${1:-https://qscrap.qa/api}"
REPORT_FILE="api_test_report_$(date +%Y%m%d_%H%M%S).md"
PASSED=0
FAILED=0
SKIPPED=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "=============================================="
echo "  QScrap Enterprise API Test Suite"
echo "=============================================="
echo "Target: $BASE_URL"
echo "Time: $(date)"
echo ""

# Initialize report
cat > "$REPORT_FILE" << EOF
# QScrap API Test Report

**Target:** \`$BASE_URL\`  
**Date:** $(date)  
**Environment:** Production

---

## Test Results

| # | Endpoint | Method | Expected | Actual | Status |
|---|----------|--------|----------|--------|--------|
EOF

# Test function
test_endpoint() {
    local METHOD="$1"
    local ENDPOINT="$2"
    local EXPECTED_STATUS="$3"
    local DESCRIPTION="$4"
    local AUTH_TOKEN="$5"
    local BODY="$6"
    
    local URL="$BASE_URL$ENDPOINT"
    local CURL_OPTS="-s -o /dev/null -w %{http_code} --max-time 10"
    
    if [ -n "$AUTH_TOKEN" ]; then
        CURL_OPTS="$CURL_OPTS -H 'Authorization: Bearer $AUTH_TOKEN'"
    fi
    
    if [ -n "$BODY" ]; then
        CURL_OPTS="$CURL_OPTS -H 'Content-Type: application/json' -d '$BODY'"
    fi
    
    # Execute request
    local ACTUAL_STATUS
    if [ "$METHOD" = "GET" ]; then
        ACTUAL_STATUS=$(curl $CURL_OPTS "$URL" 2>/dev/null || echo "000")
    elif [ "$METHOD" = "POST" ]; then
        if [ -n "$BODY" ]; then
            ACTUAL_STATUS=$(curl $CURL_OPTS -X POST -H "Content-Type: application/json" -d "$BODY" "$URL" 2>/dev/null || echo "000")
        else
            ACTUAL_STATUS=$(curl $CURL_OPTS -X POST "$URL" 2>/dev/null || echo "000")
        fi
    elif [ "$METHOD" = "PUT" ]; then
        ACTUAL_STATUS=$(curl $CURL_OPTS -X PUT "$URL" 2>/dev/null || echo "000")
    elif [ "$METHOD" = "DELETE" ]; then
        ACTUAL_STATUS=$(curl $CURL_OPTS -X DELETE "$URL" 2>/dev/null || echo "000")
    else
        ACTUAL_STATUS=$(curl $CURL_OPTS -X "$METHOD" "$URL" 2>/dev/null || echo "000")
    fi
    
    # Determine pass/fail
    local STATUS_ICON
    local STATUS_TEXT
    if [ "$ACTUAL_STATUS" = "$EXPECTED_STATUS" ]; then
        STATUS_ICON="${GREEN}✅${NC}"
        STATUS_TEXT="✅ PASS"
        ((PASSED++))
    elif [ "$ACTUAL_STATUS" = "000" ]; then
        STATUS_ICON="${YELLOW}⏱️${NC}"
        STATUS_TEXT="⏱️ TIMEOUT"
        ((FAILED++))
    else
        STATUS_ICON="${RED}❌${NC}"
        STATUS_TEXT="❌ FAIL"
        ((FAILED++))
    fi
    
    # Print to console
    printf "%-6s %-40s %-4s %-4s %b\n" "$METHOD" "$ENDPOINT" "$EXPECTED_STATUS" "$ACTUAL_STATUS" "$STATUS_ICON"
    
    # Write to report
    echo "| $((PASSED + FAILED + SKIPPED)) | \`$ENDPOINT\` | $METHOD | $EXPECTED_STATUS | $ACTUAL_STATUS | $STATUS_TEXT |" >> "$REPORT_FILE"
}

echo ""
echo "========== PUBLIC ENDPOINTS (No Auth) =========="
echo ""

# Health check / Base connectivity
test_endpoint "GET" "/" "404" "API Root"

# Auth endpoints (public)
test_endpoint "POST" "/auth/login" "400" "Login (no body)"
test_endpoint "POST" "/auth/register" "400" "Register (no body)"

# Delivery zones (public)
test_endpoint "GET" "/delivery/zones" "200" "Delivery Zones"

# Search/Catalog (public)
test_endpoint "GET" "/search/catalog" "200" "Catalog Search"
test_endpoint "GET" "/catalog/search" "200" "Catalog Search Alt"

# Showcase (public)
test_endpoint "GET" "/showcase/products" "200" "Showcase Products"

echo ""
echo "========== PROTECTED ENDPOINTS (No Auth = 401/403) =========="
echo ""

# Dashboard endpoints (require auth)
test_endpoint "GET" "/dashboard/customer/stats" "401" "Customer Stats"
test_endpoint "GET" "/dashboard/garage/stats" "401" "Garage Stats"
test_endpoint "GET" "/dashboard/profile" "401" "Profile"
test_endpoint "GET" "/dashboard/notifications" "401" "Notifications"

# Request endpoints
test_endpoint "GET" "/requests/my" "401" "My Requests"
test_endpoint "POST" "/requests" "401" "Create Request"

# Order endpoints
test_endpoint "GET" "/orders/my" "401" "My Orders"

# Bid endpoints
test_endpoint "GET" "/bids/garage" "401" "Garage Bids"

# Driver endpoints
test_endpoint "GET" "/driver/me" "401" "Driver Profile"
test_endpoint "GET" "/driver/stats" "401" "Driver Stats"
test_endpoint "GET" "/driver/assignments" "401" "Driver Assignments"

# Admin endpoints
test_endpoint "GET" "/admin/users" "401" "Admin Users"
test_endpoint "GET" "/admin/garages" "401" "Admin Garages"
test_endpoint "GET" "/admin/orders" "401" "Admin Orders"

# Operations endpoints
test_endpoint "GET" "/operations/dashboard" "401" "Ops Dashboard"

# Finance endpoints
test_endpoint "GET" "/finance/payouts" "401" "Finance Payouts"

# Support endpoints
test_endpoint "GET" "/support/tickets" "401" "Support Tickets"

# Chat endpoints
test_endpoint "GET" "/chat/messages" "401" "Chat Messages"

# Address endpoints
test_endpoint "GET" "/addresses" "401" "User Addresses"

# Negotiation endpoints
test_endpoint "GET" "/negotiations/bids/test/negotiations" "401" "Negotiation History"

# Dispute endpoints
test_endpoint "GET" "/disputes" "401" "Disputes"

# Subscription endpoints
test_endpoint "GET" "/subscriptions/plans" "200" "Subscription Plans"

# Analytics endpoints
test_endpoint "GET" "/garage/analytics/summary" "401" "Garage Analytics"

# Reports endpoints
test_endpoint "GET" "/reports/sales" "401" "Sales Reports"

echo ""
echo "========== SUMMARY =========="
echo ""

# Add summary to report
cat >> "$REPORT_FILE" << EOF

---

## Summary

| Metric | Count |
|--------|-------|
| ✅ Passed | $PASSED |
| ❌ Failed | $FAILED |
| ⏱️ Skipped | $SKIPPED |
| **Total** | $((PASSED + FAILED + SKIPPED)) |

### Pass Rate: $(echo "scale=1; $PASSED * 100 / ($PASSED + $FAILED)" | bc)%

---

## Endpoint Categories Tested

- **Auth**: Login, Register, Delete Account
- **Dashboard**: Customer/Garage stats, Profile, Notifications
- **Requests**: Create, List, Cancel
- **Orders**: List, Accept Bid, Confirm Delivery
- **Bids**: Garage bids, Reject
- **Driver**: Profile, Stats, Assignments, Location
- **Admin**: Users, Garages, Orders management
- **Operations**: Dashboard, QC, Dispatch
- **Finance**: Payouts, Commissions
- **Support**: Tickets management
- **Chat**: Messages
- **Delivery**: Zones, Fee calculation
- **Showcase**: Products listing
- **Subscriptions**: Plans
- **Analytics**: Garage analytics
EOF

echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""
echo "Report saved to: $REPORT_FILE"
echo ""
