# Rate Limiting Test Plan
**Date:** October 28, 2025  
**Purpose:** Verify Amazon Product Fees API rate limiting works correctly before 5K production test

---

## ✅ Implementation Complete

### Changes Made

1. **Dedicated Rate Limiter Created**
   - File: `server/purchasing/analyzer.ts`
   - Configuration: 1 req/sec (very conservative)
   - Features: Circuit breaker, retry logic, exponential backoff
   - Event logging for monitoring

2. **Single Product Analysis**
   - Updated `analyzePurchasingOpportunity()` function
   - Wraps `getProductFees()` in `feesRateLimiter.executeRequest()`
   - Graceful fallback to estimates on API errors

3. **Bulk Analysis with Batch Pacing**
   - Updated `analyzeBulkOpportunities()` function
   - Batch size: 100 products per batch
   - Inter-batch pause: 30 seconds
   - Rate-limited fee API calls in loop

4. **Comprehensive Monitoring**
   - Progress logging every 10 products
   - Batch summaries with rate limiter status
   - Time estimates and completion statistics
   - New endpoint: `GET /api/purchasing/rate-limit-status`

---

## 🧪 Test Procedure

### Phase 1: Small Batch Test (10-50 Products)

**Objective:** Verify rate limiter works without errors

**Steps:**

1. **Check Current Product Count**
   ```bash
   # Count products with Amazon data
   curl http://localhost:5000/api/purchasing/stats
   ```

2. **Run Small Batch Analysis**
   ```bash
   # Analyze first 50 products
   curl -X POST http://localhost:5000/api/purchasing/analyze-bulk \
     -H "Content-Type: application/json" \
     -d '{"limit": 50}'
   ```

3. **Monitor Progress**
   - Watch server logs in real-time
   - Look for progress updates every 10 products
   - Check for rate limiter status logs

4. **Check Rate Limiter Status**
   ```bash
   # Check during analysis
   curl http://localhost:5000/api/purchasing/rate-limit-status
   ```

**Expected Results:**
- ✅ No 429 errors in logs
- ✅ Circuit breaker remains closed
- ✅ Steady progress at ~1 product/sec
- ✅ Completion time: ~50-60 seconds
- ✅ Success message with statistics

**Success Criteria:**
- Zero 429 (Too Many Requests) errors
- Zero circuit breaker activations
- API calls complete successfully or gracefully fall back to estimates
- Rate limiter queue stays < 10 items

---

### Phase 2: Medium Batch Test (100 Products)

**Objective:** Verify batch pacing works correctly

**Steps:**

1. **Run 100 Product Analysis**
   ```bash
   curl -X POST http://localhost:5000/api/purchasing/analyze-bulk \
     -H "Content-Type: application/json" \
     -d '{"limit": 100}'
   ```

2. **Monitor Batch Transition**
   - Watch for "Batch 1/1 complete" message
   - Check rate limiter status at batch boundary
   - Verify no pause (only 1 batch)

3. **Verify Results**
   ```bash
   curl http://localhost:5000/api/purchasing/opportunities
   ```

**Expected Results:**
- ✅ Single batch completes
- ✅ No inter-batch pause (only 1 batch)
- ✅ Completion time: ~100-120 seconds
- ✅ All products analyzed successfully

**Success Criteria:**
- Completion time aligns with 1 req/sec rate
- No sustained throttling
- Zero 429 errors
- Accurate opportunity count

---

### Phase 3: Multi-Batch Test (200-500 Products)

**Objective:** Verify batch pacing and inter-batch pauses work

**Steps:**

1. **Run Multi-Batch Analysis**
   ```bash
   # Test with 250 products (3 batches)
   curl -X POST http://localhost:5000/api/purchasing/analyze-bulk \
     -H "Content-Type: application/json" \
     -d '{"limit": 250}'
   ```

2. **Observe Batch Behavior**
   - Watch for batch transitions
   - Verify 30-second pause between batches
   - Monitor rate limiter status during pauses

3. **Log Analysis**
   - Check for batch summaries
   - Verify progress tracking accuracy
   - Review API call vs fallback ratio

**Expected Results:**
- ✅ 3 batches (100 + 100 + 50)
- ✅ 30-second pauses between batches 1→2 and 2→3
- ✅ Total time: ~4-5 minutes (250 sec analysis + 60 sec pauses)
- ✅ Rate limiter stays healthy throughout

**Success Criteria:**
- Batch pauses observed in logs
- No 429 errors across batches
- Circuit breaker never opens
- Consistent ~1 req/sec rate

---

## 📊 Monitoring During Testing

### Server Logs to Watch For

**Good Signs ✅**
```
[Analyzer] ===== BULK ANALYSIS STARTING =====
[Analyzer] Found X products with Amazon data to analyze
[Analyzer] Progress: 10/X (X%) | API calls: X | Fallbacks: X | Est. Xmin remaining
[Analyzer] Batch complete: X total opportunities created
[Analyzer] Rate Limiter Status: Queue=0, Active=1, Tokens=2, CircuitOpen=false
[Analyzer] Pausing 30s before next batch to respect rate limits...
[Analyzer] ===== BULK ANALYSIS COMPLETE =====
[Analyzer] No 429 errors detected - rate limiting working correctly!
```

**Warning Signs ⚠️**
```
[Fees API] Queue: 50 requests pending  # Queue building up
[Fees API] Retrying request (attempt 2, delay 2000ms)  # Retries happening
Rate limit exceeded  # 429 errors occurring
```

**Critical Issues 🚨**
```
[Fees API] CIRCUIT BREAKER OPEN - 5 consecutive failures  # System protecting itself
429 Too Many Requests  # Rate limit hit
Failed to authenticate  # Auth problems
```

### Rate Limiter Status Endpoint

**During Analysis:**
```bash
curl http://localhost:5000/api/purchasing/rate-limit-status
```

**Healthy Response:**
```json
{
  "success": true,
  "rateLimiter": {
    "queueLength": 2,
    "activeRequests": 1,
    "availableTokens": 1,
    "circuitBreakerOpen": false,
    "failureCount": 0,
    "maxRequestsPerSecond": 1,
    "status": "HEALTHY"
  },
  "timestamp": "2025-10-28T17:30:00.000Z"
}
```

**Warning Response:**
```json
{
  "rateLimiter": {
    "queueLength": 55,
    "status": "BUSY"  // Queue > 50
  }
}
```

**Critical Response:**
```json
{
  "rateLimiter": {
    "circuitBreakerOpen": true,
    "failureCount": 5,
    "status": "CIRCUIT_OPEN"
  }
}
```

---

## 🎯 Success Metrics

### Phase 1 (50 products)
- [ ] Zero 429 errors
- [ ] Completion time: 50-70 seconds
- [ ] Circuit breaker: Closed
- [ ] Fallback rate: < 10%

### Phase 2 (100 products)
- [ ] Zero 429 errors
- [ ] Completion time: 100-120 seconds
- [ ] Rate limiter queue: < 10 items
- [ ] Success rate: > 90%

### Phase 3 (250 products)
- [ ] Zero 429 errors
- [ ] 30-second batch pauses observed
- [ ] Completion time: 4-5 minutes
- [ ] No circuit breaker activations

---

## 🚀 Production Readiness Checklist

After successful testing:

- [ ] **Small batch (50) passed** - Rate limiting works
- [ ] **Medium batch (100) passed** - Single batch handling works
- [ ] **Multi-batch (250) passed** - Batch pacing works
- [ ] **Zero 429 errors** across all tests
- [ ] **Circuit breaker never opened**
- [ ] **Monitoring endpoint functional**
- [ ] **Log output is clear and informative**

**If all checks pass:** ✅ **READY FOR 5,000 PRODUCT TEST**

---

## 📋 Test Results Template

```
## Test Results - [Date]

### Phase 1: 50 Products
- Start time: [timestamp]
- End time: [timestamp]
- Duration: [X seconds]
- Products analyzed: X/50
- API calls: X
- Fallbacks: X
- 429 errors: [0 expected]
- Circuit breaker: [Closed expected]
- Status: ✅ PASS / ❌ FAIL

### Phase 2: 100 Products
- Duration: [X seconds]
- Products analyzed: X/100
- 429 errors: [0 expected]
- Status: ✅ PASS / ❌ FAIL

### Phase 3: 250 Products
- Batches: [3 expected]
- Duration: [4-5 min expected]
- Inter-batch pauses: [2 observed expected]
- 429 errors: [0 expected]
- Status: ✅ PASS / ❌ FAIL

### Overall Assessment
Status: ✅ READY FOR PRODUCTION / ⚠️ NEEDS FIXES
Notes: [Any observations]
```

---

## 🔧 Troubleshooting

### Issue: 429 Errors Occurring

**Diagnosis:**
- Rate limiter not working correctly
- Rate too aggressive for API

**Solution:**
1. Check rate limiter configuration (should be 1 req/sec)
2. Verify `feesRateLimiter.executeRequest()` is being called
3. Reduce rate to 0.5 req/sec if needed

### Issue: Circuit Breaker Opening

**Diagnosis:**
- Multiple consecutive failures
- API authentication issues

**Solution:**
1. Check Amazon SP-API credentials
2. Verify access token generation working
3. Review error messages in logs
4. Increase circuit breaker threshold if needed

### Issue: Very Slow Progress

**Diagnosis:**
- Rate limiting working TOO well
- Queue building up

**Solution:**
1. This is actually GOOD - means we're being conservative
2. Monitor fallback rate - if high, investigate API issues
3. For production, consider increasing to 1.5 req/sec if no 429s

---

## 📞 Next Steps After Testing

### If Tests Pass ✅

1. **Update Deployment Assessment**
   - Mark rate limiting as VERIFIED
   - Update risk level to LOW for 5K test

2. **Plan 5K Production Test**
   - Schedule deployment window
   - Set up monitoring alerts
   - Prepare rollback plan

3. **Document Results**
   - Save test logs
   - Record completion times
   - Note any warnings or edge cases

### If Tests Fail ❌

1. **Review Failure Details**
   - Identify which phase failed
   - Collect error messages
   - Check rate limiter logs

2. **Apply Fixes**
   - Adjust rate limiter configuration
   - Fix authentication issues
   - Update error handling

3. **Re-test**
   - Start from Phase 1
   - Verify fixes work
   - Document changes

---

**Document Version:** 1.0  
**Status:** Ready for Testing  
**Next Action:** Execute Phase 1 Test
