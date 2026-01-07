#!/usr/bin/env python3
"""QScrap VPS API Test Suite - Run tests directly on VPS via SSH"""
import paramiko

host = "147.93.89.153"
user = "root"
password = "QScrap@2026byMaher"

# API tests to run on VPS
TEST_SCRIPT = '''
#!/bin/bash
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
    
    if [ "$METHOD" = "POST" ]; then
        ACTUAL=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL$ENDPOINT" 2>/dev/null)
    else
        ACTUAL=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$ENDPOINT" 2>/dev/null)
    fi
    
    if [ "$ACTUAL" = "$EXPECTED" ]; then
        echo "✅ $METHOD $ENDPOINT → $ACTUAL"
        ((PASSED++))
    else
        echo "❌ $METHOD $ENDPOINT → $ACTUAL (expected $EXPECTED)"
        ((FAILED++))
    fi
}

echo "=== PUBLIC ENDPOINTS ==="
test_endpoint "GET" "/delivery/zones" "200"
test_endpoint "GET" "/subscriptions/plans" "200"
test_endpoint "GET" "/showcase/products" "200"
test_endpoint "POST" "/auth/login" "400"
test_endpoint "POST" "/auth/register" "400"

echo ""
echo "=== PROTECTED ENDPOINTS (expect 401) ==="
test_endpoint "GET" "/dashboard/customer/stats" "401"
test_endpoint "GET" "/dashboard/garage/stats" "401"
test_endpoint "GET" "/dashboard/profile" "401"
test_endpoint "GET" "/dashboard/notifications" "401"
test_endpoint "GET" "/requests/my" "401"
test_endpoint "GET" "/orders/my" "401"
test_endpoint "GET" "/driver/me" "401"
test_endpoint "GET" "/driver/stats" "401"
test_endpoint "GET" "/driver/assignments" "401"
test_endpoint "GET" "/admin/users" "401"
test_endpoint "GET" "/admin/garages" "401"
test_endpoint "GET" "/operations/dashboard" "401"
test_endpoint "GET" "/finance/payouts" "401"
test_endpoint "GET" "/support/tickets" "401"
test_endpoint "GET" "/addresses" "401"

echo ""
echo "=============================================="
TOTAL=$((PASSED + FAILED))
echo "✅ Passed: $PASSED / $TOTAL"
echo "❌ Failed: $FAILED / $TOTAL"
if [ $TOTAL -gt 0 ]; then
    RATE=$(echo "scale=1; $PASSED * 100 / $TOTAL" | bc)
    echo "📊 Pass Rate: $RATE%"
fi
echo "=============================================="
'''

try:
    print("🔌 Connecting to VPS...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=user, password=password, timeout=30)
    
    print("✅ Connected! Running API tests...\n")
    
    # Execute the test script
    stdin, stdout, stderr = client.exec_command(f"bash -c '{TEST_SCRIPT}'", timeout=60)
    
    # Print output
    output = stdout.read().decode()
    errors = stderr.read().decode()
    
    print(output)
    if errors:
        print("STDERR:", errors)
    
    client.close()
    print("\n🔌 Disconnected from VPS")
    
except Exception as e:
    print(f"❌ Error: {e}")
