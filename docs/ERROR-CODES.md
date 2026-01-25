# QSCRAP Error Code Taxonomy
# From Senior Expert Review: "You need a standard error taxonomy"

## Authentication Errors (AUTH_XXX)
AUTH_001: Invalid credentials
AUTH_002: Token expired
AUTH_003: Token invalid
AUTH_004: Refresh token expired
AUTH_005: OTP expired
AUTH_006: OTP invalid
AUTH_007: Account suspended
AUTH_008: Account not verified
AUTH_009: Insufficient permissions

## User Errors (USR_XXX)
USR_001: User not found
USR_002: Phone number already registered
USR_003: Email already registered
USR_004: Invalid phone format
USR_005: Profile update failed

## Order Errors (ORD_XXX)
ORD_001: Order not found
ORD_002: Cannot cancel paid order
ORD_003: Invalid status transition
ORD_004: Order already completed
ORD_005: Order not ready for delivery
ORD_006: Already reviewed

## Request Errors (REQ_XXX)
REQ_001: Request not found
REQ_002: Request expired
REQ_003: Request already has accepted bid
REQ_004: Cannot modify closed request
REQ_005: Invalid part category

## Bid Errors (BID_XXX)
BID_001: Bid not found
BID_002: Cannot bid on own request
BID_003: Bid already submitted
BID_004: Bid limit exceeded
BID_005: Request closed for bidding
BID_006: Subscription required

## Payment Errors (PAY_XXX)
PAY_001: Payment failed
PAY_002: Payment intent not found
PAY_003: Insufficient funds
PAY_004: Card declined
PAY_005: Payment already processed
PAY_006: Refund failed
PAY_007: Refund amount exceeds original

## Payout Errors (PYO_XXX)
PYO_001: Payout not found
PYO_002: Invalid payout status
PYO_003: Already confirmed
PYO_004: Already disputed
PYO_005: Password verification failed

## Delivery Errors (DEL_XXX)
DEL_001: Assignment not found
DEL_002: Driver not available
DEL_003: Invalid delivery zone
DEL_004: Already assigned
DEL_005: Cannot reassign completed delivery

## Garage Errors (GAR_XXX)
GAR_001: Garage not found
GAR_002: Garage not approved
GAR_003: Subscription expired
GAR_004: Demo period ended

## Driver Errors (DRV_XXX)
DRV_001: Driver not found
DRV_002: Driver not available
DRV_003: Driver already assigned
DRV_004: Invalid location data

## Validation Errors (VAL_XXX)
VAL_001: Required field missing
VAL_002: Invalid format
VAL_003: Value out of range
VAL_004: File too large
VAL_005: Invalid file type

## System Errors (SYS_XXX)
SYS_001: Database connection failed
SYS_002: External service unavailable
SYS_003: Rate limit exceeded
SYS_004: Internal server error
SYS_005: Service temporarily unavailable
