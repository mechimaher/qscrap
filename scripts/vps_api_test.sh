#!/bin/bash
# QScrap VPS API Test Script
# Run this directly on the VPS: ./vps_api_test.sh

BASE_URL="http://localhost:3000/api"
PASSED=0
FAILED=0

echo "=============================================="
echo "  QScrap VPS API Test Suite"
echo "=============================================="
echo "Target: $BASE_URL"
echo "Time: $(date)"
echo ""

test_endpoint() {
    local METHOD="$1"
    local ENDPOINT="$2"
    local EXPECTED="$3"
    local DESC="$4"
    
    if [ "$METHOD" = "POST" ]; then
        ACTUAL=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL$ENDPOINT" 2>/dev/null)
    else
        ACTUAL=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$ENDPOINT" 2>/dev/null)
    fi
    
    if [ "$ACTUAL" = "$EXPECTED" ]; then
        echo "✅ $METHOD $ENDPOINT → $ACTUAL (expected $EXPECTED)"
        ((PASSED++))
    else
        echo "❌ $METHOD $ENDPOINT → $ACTUAL (expected $EXPECTED)"
        ((FAILED++))
    fi
}

echo "=== PUBLIC ENDPOINTS ==="
test_endpoint "GET" "/delivery/zones" "200" "Delivery zones"
test_endpoint "GET" "/subscriptions/plans" "200" "Subscription plans"
test_endpoint "GET" "/showcase/products" "200" "Showcase products"
test_endpoint "POST" "/auth/login" "400" "Login (no body)"
test_endpoint "POST" "/auth/register" "400" "Register (no body)"

echo ""
echo "=== PROTECTED ENDPOINTS (expect 401) ==="
test_endpoint "GET" "/dashboard/customer/stats" "401" "Customer stats"
test_endpoint "GET" "/dashboard/garage/stats" "401" "Garage stats"
test_endpoint "GET" "/dashboard/profile" "401" "Profile"
test_endpoint "GET" "/dashboard/notifications" "401" "Notifications"
test_endpoint "GET" "/requests/my" "401" "My requests"
test_endpoint "GET" "/orders/my" "401" "My orders"
test_endpoint "GET" "/driver/me" "401" "Driver profile"
test_endpoint "GET" "/driver/stats" "401" "Driver stats"
test_endpoint "GET" "/driver/assignments" "401" "Driver assignments"
test_endpoint "GET" "/admin/users" "401" "Admin users"
test_endpoint "GET" "/admin/garages" "401" "Admin garages"
test_endpoint "GET" "/operations/dashboard" "401" "Ops dashboard"
test_endpoint "GET" "/finance/payouts" "401" "Finance payouts"
test_endpoint "GET" "/support/tickets" "401" "Support tickets"
test_endpoint "GET" "/addresses" "401" "User addresses"

echo ""
echo "=============================================="
echo "  SUMMARY"
echo "=============================================="
echo "✅ Passed: $PASSED"
echo "❌ Failed: $FAILED"
TOTAL=$((PASSED + FAILED))
RATE=$(echo "scale=1; $PASSED * 100 / $TOTAL" | bc)
echo "📊 Pass Rate: $RATE%"
echo ""
