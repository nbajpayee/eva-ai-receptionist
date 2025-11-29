# Customer Linkage Test Plan

**Date:** November 10, 2025
**Issue:** Customer ID not being linked to conversations despite contact info being provided
**Status:** 🔧 **FIX APPLIED - READY FOR TESTING**

## Root Cause Analysis

### Problem Flow
1. User books appointment during voice call
2. `realtime_client.py` stores name/phone/email in `session_data['customer_data']`
3. `analytics.end_call_session()` looks up customer by phone
4. If customer exists, it links `call_session.customer_id`
5. **BUT:** If customer doesn't exist, no customer is created
6. **AND:** `customer_id` was never added back to `session_data['customer_data']`
7. `main.py` tries to extract `customer_id` from `customer_data` → not found
8. Result: `conversation.customer_id` remains NULL

### Files Analyzed
- `backend/realtime_client.py` lines 294-300: Sets customer_data (name, phone, email)
- `backend/calendar_service.py` lines 147-222: Books to Google Calendar (no DB interaction)
- `backend/analytics.py` lines 109-127: Looks up/links customer (but didn't create)
- `backend/main.py` lines 140-151: Tries to extract customer_id (was missing)

## Fixes Applied

### Fix #1: Customer Creation in analytics.py
**File:** `backend/analytics.py` lines 115-127

**Before:**
```python
# Link to customer if identified
if customer_data.get('phone'):
    customer = db.query(Customer).filter(
        Customer.phone == customer_data['phone']
    ).first()
    if customer:
        call_session.customer_id = customer.id
```

**After:**
```python
# Link to customer if identified (create if doesn't exist)
if customer_data.get('phone'):
    customer = db.query(Customer).filter(
        Customer.phone == customer_data['phone']
    ).first()

    if not customer:
        # Create new customer
        customer = Customer(
            name=customer_data.get('name', 'Unknown'),
            phone=customer_data.get('phone'),
            email=customer_data.get('email'),
            is_new_client=True
        )
        db.add(customer)
        db.flush()  # Get the ID without committing
        print(f"✨ Created new customer: {customer.name} (ID: {customer.id})")

    call_session.customer_id = customer.id
```

### Fix #2: Extract customer_id from call_session in main.py
**File:** `backend/main.py` lines 131-151

**Before:**
```python
# 1. Update legacy call_session
AnalyticsService.end_call_session(...)

# 2. Update new conversation schema
customer_data = session_data.get('customer_data', {})
customer_id = customer_data.get('customer_id')  # ❌ Never set!
```

**After:**
```python
# 1. Update legacy call_session (this also looks up/links customer)
updated_call_session = AnalyticsService.end_call_session(...)

# 2. Update new conversation schema
# Extract customer ID from the updated call_session
customer_id = updated_call_session.customer_id if updated_call_session else None

# Update conversation with customer ID if identified
if customer_id:
    conversation.customer_id = customer_id
    print(f"🔗 Linked conversation {conversation.id} to customer {customer_id}")
    db.commit()
else:
    print(f"⚠️  No customer linked for session {session_id}")
```

## Test Plan

### Pre-Test Verification
- [x] Backend reloaded successfully
- [x] Check current customer count in database
- [x] Check current conversation count
- [ ] Establish baseline for test

### Test Scenario
**Objective:** Book an appointment with contact info and verify customer is created/linked

**Steps:**
1. Open voice interface (`frontend/index.html` or Next.js)
2. Start call
3. Say: "I'd like to book a Botox appointment"
4. When asked for name: "My name is Sarah Johnson"
5. When asked for phone: "My phone number is 555-123-4567"
6. When asked for email: "sarah.johnson@email.com"
7. Complete booking for a specific date/time
8. End call

**Expected Behavior:**
1. ✅ Customer created with name "Sarah Johnson", phone "555-123-4567"
2. ✅ `call_session.customer_id` points to new customer
3. ✅ `conversation.customer_id` points to same customer
4. ✅ Console shows: "✨ Created new customer: Sarah Johnson (ID: X)"
5. ✅ Console shows: "🔗 Linked conversation Y to customer X"
6. ✅ Dashboard shows customer name in conversation list

**Verification Queries:**
```python
# After call, check customer was created
customer = db.query(Customer).filter(
    Customer.phone == "555-123-4567"
).first()
print(f"Customer ID: {customer.id if customer else 'NOT FOUND'}")

# Check conversation is linked
conversation = db.query(Conversation).order_by(
    Conversation.created_at.desc()
).first()
print(f"Conversation customer_id: {conversation.customer_id}")

# Verify they match
if customer and conversation and customer.id == conversation.customer_id:
    print("✅ CUSTOMER LINKAGE WORKING!")
else:
    print("❌ Customer linkage still broken")
```

### Alternative Test (if no phone provided)
If user doesn't provide contact info during call:
- ✅ `customer_id` should remain NULL
- ✅ Console should show: "⚠️  No customer linked for session {session_id}"
- ✅ This is expected behavior (not an error)

## Current Database State

**Before Fix:**
- Total customers: 2 (Emily Parker, Jason Rivera)
- Total conversations: 80
- Latest conversation customer_id: NULL (from previous test)

**After This Test:**
- Expected customers: 3 (added Sarah Johnson)
- Expected conversations: 81
- Expected latest conversation customer_id: 3 (linked to Sarah)

## Validation Checklist
- [ ] New customer created in database
- [ ] Legacy `call_session.customer_id` populated
- [ ] New `conversation.customer_id` populated
- [ ] Both IDs match
- [ ] Console logs show creation and linkage messages
- [ ] Admin dashboard displays customer name
- [ ] No errors in backend logs

## Rollback Plan
If test fails, the fixes are in:
- `backend/analytics.py` lines 115-127
- `backend/main.py` lines 131-151

Simply revert those sections to restore previous behavior.
