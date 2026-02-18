#!/bin/bash

# ============================================
# QScrap Test Runner Script
# ============================================
# Usage:
#   ./run-tests.sh              - Run all tests
#   ./run-tests.sh unit         - Run only unit tests
#   ./run-tests.sh integration  - Run only integration tests
#   ./run-tests.sh coverage     - Run tests with coverage report
#   ./run-tests.sh watch        - Run tests in watch mode
#   ./run-tests.sh ci           - Run tests for CI (with coverage)
# ============================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print header
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   QScrap Test Suite${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed${NC}"
    exit 1
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
fi

# Function to run tests
run_tests() {
    local test_type=$1

    case $test_type in
        "unit")
            echo -e "${YELLOW}Running Unit Tests...${NC}"
            echo ""
            npm test -- --testPathPattern="src/.*\\.test\\.ts" --testPathIgnorePatterns="tests/contract"
            ;;
        "integration")
            echo -e "${YELLOW}Running Integration Tests...${NC}"
            echo ""
            npm test -- --testPathPattern="tests/contract" --runInBand
            ;;
        "coverage")
            echo -e "${YELLOW}Running Tests with Coverage...${NC}"
            echo ""
            npm test -- --coverage --coverageReporters=text --coverageReporters=lcov --coverageReporters=html
            echo ""
            echo -e "${BLUE}Coverage report generated at: coverage/index.html${NC}"
            ;;
        "watch")
            echo -e "${YELLOW}Running Tests in Watch Mode...${NC}"
            echo ""
            npm test -- --watch
            ;;
        "ci")
            echo -e "${YELLOW}Running Tests for CI...${NC}"
            echo ""
            npm test -- --coverage --ci --coverageReporters=text --coverageReporters=lcov --coverageReporters=clover
            ;;
        *)
            echo -e "${YELLOW}Running All Tests...${NC}"
            echo ""
            npm test
            ;;
    esac
}

# Check test database connection
check_db() {
    echo -e "${YELLOW}Checking database connection...${NC}"
    
    # Set test environment variables
    export NODE_ENV=test
    export DB_HOST=${TEST_DB_HOST:-localhost}
    export DB_PORT=${TEST_DB_PORT:-5432}
    export DB_USER=${TEST_DB_USER:-postgres}
    export DB_PASSWORD=${TEST_DB_PASSWORD:-password}
    export DB_NAME=${TEST_DB_NAME:-qscrap_test}
    
    # Try to connect to database
    if command -v psql &> /dev/null; then
        if PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT 1" &> /dev/null; then
            echo -e "${GREEN}✓ Database connection successful${NC}"
        else
            echo -e "${YELLOW}⚠ Database connection failed. Some tests may fail.${NC}"
            echo -e "${YELLOW}  To create test database:${NC}"
            echo -e "${YELLOW}  createdb -h $DB_HOST -U $DB_USER $DB_NAME${NC}"
        fi
    else
        echo -e "${YELLOW}⚠ psql not found. Skipping database check.${NC}"
    fi
    echo ""
}

# Main execution
case "${1:-all}" in
    "unit")
        check_db
        run_tests "unit"
        ;;
    "integration")
        check_db
        run_tests "integration"
        ;;
    "coverage"|"cov")
        check_db
        run_tests "coverage"
        ;;
    "watch"|"w")
        check_db
        run_tests "watch"
        ;;
    "ci")
        run_tests "ci"
        ;;
    "all"|"")
        check_db
        run_tests "all"
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        echo ""
        echo "Usage:"
        echo "  ./run-tests.sh              - Run all tests"
        echo "  ./run-tests.sh unit         - Run only unit tests"
        echo "  ./run-tests.sh integration  - Run only integration tests"
        echo "  ./run-tests.sh coverage     - Run tests with coverage report"
        echo "  ./run-tests.sh watch        - Run tests in watch mode"
        echo "  ./run-tests.sh ci           - Run tests for CI"
        exit 1
        ;;
esac

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✓ Test run completed${NC}"
echo -e "${BLUE}========================================${NC}"
