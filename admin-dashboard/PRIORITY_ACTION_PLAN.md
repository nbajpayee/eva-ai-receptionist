# Admin Dashboard - Priority Action Plan

**Date:** November 22, 2025
**Current Grade:** B- (78/100)
**Target Grade:** A (90+)
**Timeline:** 4-6 weeks to production-ready

---

## 🚨 P0 - CRITICAL (Must Complete Before Production)

**Block deployment until these are resolved**

### 1. Testing Infrastructure & Coverage
**Estimated Time:** 1.5 weeks | **Owner:** TBD

**Tasks:**
- [ ] Set up Jest + React Testing Library configuration
- [ ] Add Cypress or Playwright for E2E testing
- [ ] Write unit tests for:
  - [ ] Auth context (`src/contexts/auth-context.tsx`)
  - [ ] API routes (`src/app/api/admin/*`)
  - [ ] Customer CRUD operations
  - [ ] Messaging console core logic
- [ ] Write integration tests for:
  - [ ] Login/logout flow
  - [ ] Customer create/edit/delete
  - [ ] Appointment booking
- [ ] Write E2E tests for:
  - [ ] Complete user journey (login → view dashboard → manage customer)
  - [ ] Messaging flow
  - [ ] Voice session
- [ ] Set up CI/CD to run tests on every PR
- [ ] Target: 80%+ code coverage for critical paths

**Acceptance Criteria:**
- All critical user flows have E2E test coverage
- Unit tests pass in CI/CD
- No deployment without passing tests

---

### 2. Security Hardening
**Estimated Time:** 1 week | **Owner:** TBD

**Tasks:**
- [ ] **Supabase RLS Policies**
  - [ ] Create RLS policies for `customers` table
  - [ ] Create RLS policies for `appointments` table
  - [ ] Create RLS policies for `conversations` table
  - [ ] Create RLS policies for `communication_messages` table
  - [ ] Test: User A cannot access User B's data

- [ ] **CSRF Protection**
  - [ ] Add CSRF token generation middleware
  - [ ] Add CSRF validation to all POST/PUT/DELETE routes
  - [ ] Test: Request without token is rejected

- [ ] **Rate Limiting**
  - [ ] Implement rate limiting middleware (e.g., `express-rate-limit`)
  - [ ] Apply to all API routes (100 req/min per IP)
  - [ ] Apply stricter limits to auth routes (10 req/min)

- [ ] **Remove Placeholder Credentials**
  - [ ] Fix `src/lib/supabase/client.ts:18-24`
  - [ ] Add runtime env validation to fail fast if credentials missing
  - [ ] Update deployment docs

- [ ] **Remove Sensitive Logging**
  - [ ] Remove session token logging in `src/contexts/auth-context.tsx:62`
  - [ ] Add log sanitization middleware
  - [ ] Audit all files for accidental PII logging

**Acceptance Criteria:**
- RLS policies tested and verified in Supabase dashboard
- CSRF attacks blocked in security testing
- Rate limit tested with load tool (e.g., `ab`, `wrk`)
- No placeholder credentials in codebase
- No PII in logs

---

### 3. Error Monitoring & Production Logging
**Estimated Time:** 3 days | **Owner:** TBD

**Tasks:**
- [ ] **Sentry Integration**
  - [ ] Install `@sentry/nextjs`
  - [ ] Configure Sentry DSN in environment variables
  - [ ] Add Sentry error boundary to root layout
  - [ ] Test error reporting (trigger test error)

- [ ] **Remove Console Logs**
  - [ ] Replace all `console.log` in `src/contexts/auth-context.tsx` (15+ instances)
  - [ ] Replace all `console.log` in other files
  - [ ] Add ESLint rule to prevent new console.log

- [ ] **Proper Logging Library**
  - [ ] Install `pino` or `winston`
  - [ ] Create logging utility with levels (info, warn, error)
  - [ ] Update all error catches to log properly

- [ ] **Environment Validation**
  - [ ] Create startup validation for all required env vars
  - [ ] Fail fast if critical vars missing
  - [ ] Add helpful error messages

**Acceptance Criteria:**
- Errors appear in Sentry dashboard
- No console.log statements in production build
- Environment validation prevents startup with missing vars

---

### 4. Production Code Quality Fixes
**Estimated Time:** 3 days | **Owner:** TBD

**Tasks:**
- [ ] **Type Safety Improvements**
  - [ ] Install Zod for runtime validation
  - [ ] Add Zod schemas for:
    - [ ] Customer model
    - [ ] Appointment model
    - [ ] Conversation model
    - [ ] API request/response bodies
  - [ ] Replace unsafe type casts in `src/app/page.tsx:124`
  - [ ] Fix permissive types in `src/components/messaging/messaging-console.tsx:119`

- [ ] **Remove Dead Code**
  - [ ] Remove unused `formatTime` in `src/app/customers/[id]/page.tsx:60-68`
  - [ ] Remove unused `getAppOrigin` in `src/app/page.tsx:46-56`
  - [ ] Run linter to find other dead code

- [ ] **Error Handling Standardization**
  - [ ] Create error handling utility
  - [ ] Update all try/catch blocks to use standard error handling
  - [ ] Add proper error logging to all API routes

**Acceptance Criteria:**
- All API request/response bodies validated with Zod
- No type assertion errors in strict mode
- No dead code in codebase
- All errors logged consistently

---

## 🔥 P1 - HIGH PRIORITY (Complete Within 2 Weeks)

### 5. Data Fetching Architecture Upgrade
**Estimated Time:** 4 days | **Owner:** TBD

**Tasks:**
- [ ] Install `@tanstack/react-query`
- [ ] Set up QueryClientProvider in root layout
- [ ] Refactor data fetching in:
  - [ ] `src/app/page.tsx` (dashboard metrics)
  - [ ] `src/app/customers/page.tsx` (customer list)
  - [ ] `src/app/customers/[id]/page.tsx` (customer detail)
  - [ ] `src/components/messaging/messaging-console.tsx` (conversations)
- [ ] Add request deduplication
- [ ] Add abort controllers to all fetch calls
- [ ] Implement optimistic updates for:
  - [ ] Customer edits
  - [ ] Message sending
  - [ ] Appointment updates

**Acceptance Criteria:**
- All data fetching uses React Query
- Duplicate requests are deduplicated
- Optimistic updates provide instant feedback
- No race conditions in messaging console

---

### 6. Real-Time Updates (Replace Polling)
**Estimated Time:** 3 days | **Owner:** TBD

**Tasks:**
- [ ] Implement WebSocket endpoint in backend for:
  - [ ] Live conversation updates
  - [ ] Live status changes
  - [ ] New message notifications
- [ ] Create WebSocket hook in frontend
- [ ] Replace polling in:
  - [ ] `src/components/messaging/messaging-console.tsx:248-263`
  - [ ] Live status page
- [ ] Add connection health monitoring
- [ ] Add reconnection logic with exponential backoff
- [ ] Add visual indicator for connection status

**Acceptance Criteria:**
- Messages appear instantly without polling
- Connection status visible to user
- Automatic reconnection on disconnect

---

### 7. Accessibility Audit & Fixes
**Estimated Time:** 2 days | **Owner:** TBD

**Tasks:**
- [ ] Add aria-labels to all icon buttons:
  - [ ] `src/app/customers/[id]/page.tsx:335-336` (Back button)
  - [ ] All other icon-only buttons
- [ ] Fix color contrast issues:
  - [ ] `src/components/charts/call-volume-chart.tsx:40` (zinc-500)
  - [ ] Run axe-core to find other issues
- [ ] Test with screen reader (NVDA or VoiceOver)
- [ ] Add skip-to-content link
- [ ] Ensure keyboard navigation works for all interactive elements
- [ ] Add focus visible styles

**Acceptance Criteria:**
- WCAG AA compliance (automated test with axe)
- Screen reader can navigate entire app
- All interactive elements keyboard accessible

---

### 8. Performance Optimization
**Estimated Time:** 3 days | **Owner:** TBD

**Tasks:**
- [ ] **Code Splitting**
  - [ ] Lazy load chart components (Recharts)
  - [ ] Lazy load messaging console
  - [ ] Lazy load customer detail page components
  - [ ] Add loading fallbacks for lazy components

- [ ] **Bundle Size Optimization**
  - [ ] Run bundle analyzer (`@next/bundle-analyzer`)
  - [ ] Tree-shake unused chart types
  - [ ] Replace large dependencies if possible

- [ ] **Computation Optimization**
  - [ ] Add useMemo to filtered calls in `src/app/page.tsx:187-209`
  - [ ] Add useMemo to customer filtering
  - [ ] Memoize expensive chart data transformations

- [ ] **Image Optimization**
  - [ ] Replace `<img>` with `next/image` where applicable
  - [ ] Add proper width/height attributes

**Acceptance Criteria:**
- Bundle size reduced by 30%+
- Lighthouse performance score 90+
- No unnecessary re-renders (React DevTools profiler)

---

### 9. UX Improvements
**Estimated Time:** 2 days | **Owner:** TBD

**Tasks:**
- [ ] **Toast Notification System**
  - [ ] Install `sonner` or `react-hot-toast`
  - [ ] Replace all `alert()` calls with toasts
  - [ ] Replace all `confirm()` calls with modal dialogs

- [ ] **Loading States**
  - [ ] Audit all async operations for loading states
  - [ ] Add skeleton loaders where missing
  - [ ] Add spinner for long operations

- [ ] **Error Messages**
  - [ ] Audit all error messages for clarity
  - [ ] Provide actionable next steps in errors
  - [ ] Add retry buttons where appropriate

**Acceptance Criteria:**
- No browser alert()/confirm() dialogs
- All async operations have loading states
- Error messages are clear and actionable

---

## 📋 P2 - MEDIUM PRIORITY (Complete Within 1 Month)

### 10. Documentation
**Estimated Time:** 3 days | **Owner:** TBD

**Tasks:**
- [ ] Write comprehensive README for admin-dashboard
  - [ ] Architecture overview
  - [ ] Setup instructions
  - [ ] Development workflow
  - [ ] Deployment guide
- [ ] Add JSDoc comments to:
  - [ ] All exported components
  - [ ] All custom hooks
  - [ ] All utility functions
- [ ] Create architecture diagram (components, data flow)
- [ ] Document API routes with OpenAPI/Swagger

---

### 11. Component Refactoring
**Estimated Time:** 3 days | **Owner:** TBD

**Tasks:**
- [ ] Split `messaging-console.tsx` (750 lines) into:
  - [ ] ConversationList component
  - [ ] MessageList component
  - [ ] MessageInput component
  - [ ] ConversationHeader component
- [ ] Extract reusable hooks:
  - [ ] useConversations
  - [ ] useMessages
  - [ ] useCustomer
- [ ] Add Storybook for component documentation (optional)

---

### 12. Server-Side Pagination & Filtering
**Estimated Time:** 2 days | **Owner:** TBD

**Tasks:**
- [ ] Move customer filtering to backend
- [ ] Implement proper pagination UI:
  - [ ] Customers page
  - [ ] Calls page
  - [ ] Appointments page
- [ ] Add "Load More" or infinite scroll
- [ ] Add sorting controls (by date, name, etc.)

---

### 13. Feature Completeness
**Estimated Time:** 2 days | **Owner:** TBD

**Tasks:**
- [ ] Add CSV/PDF export with date range selection
- [ ] Implement advanced search (by phone, email, service, etc.)
- [ ] Add bulk actions (select multiple customers/appointments)
- [ ] Add appointment reminders configuration

---

## 🔮 P3 - LOW PRIORITY (Future Enhancements)

### 14. Analytics & Feature Flags
- [ ] Add PostHog or Mixpanel tracking
- [ ] Implement LaunchDarkly for feature flags
- [ ] Add visual regression testing (Percy, Chromatic)

### 15. Internationalization
- [ ] Add i18n support (`next-intl`)
- [ ] Translate all strings
- [ ] Add language switcher

### 16. Advanced Features
- [ ] Role-based UI enforcement (Owner, Staff, Provider views)
- [ ] Audit logs for all data changes
- [ ] Scheduled data exports
- [ ] Advanced analytics (cohort analysis, retention)

---

## Sprint Planning

### Sprint 1 (Week 1-2): Critical Security & Testing
- P0: Security Hardening (#2)
- P0: Error Monitoring (#3)
- P0: Testing Infrastructure (start) (#1)

### Sprint 2 (Week 3-4): Testing & Code Quality
- P0: Testing Infrastructure (complete) (#1)
- P0: Production Code Quality Fixes (#4)
- P1: Data Fetching Architecture (#5)

### Sprint 3 (Week 5-6): Performance & UX
- P1: Real-Time Updates (#6)
- P1: Accessibility Audit (#7)
- P1: Performance Optimization (#8)
- P1: UX Improvements (#9)

### Sprint 4 (Week 7-8): Polish & Documentation
- P2: Documentation (#10)
- P2: Component Refactoring (#11)
- P2: Server-Side Pagination (#12)
- P2: Feature Completeness (#13)

---

## Success Metrics

### Before Starting (Current State)
- ❌ Test Coverage: 0%
- ❌ Lighthouse Performance: Unknown
- ❌ Security Grade: D (Critical vulnerabilities)
- ❌ Bundle Size: ~2MB (estimated)
- ❌ Production Ready: NO

### After P0 Completion (Week 4)
- ✅ Test Coverage: 80%+
- ✅ Security Grade: B+ (RLS, CSRF, rate limiting)
- ✅ Error Monitoring: Active
- ✅ Production Ready: YES (with caveats)

### After P1 Completion (Week 6)
- ✅ Lighthouse Performance: 90+
- ✅ Accessibility: WCAG AA compliant
- ✅ Bundle Size: <1.5MB
- ✅ Real-time updates: Active
- ✅ Production Ready: YES (full confidence)

### After P2 Completion (Week 8)
- ✅ Documentation: Complete
- ✅ Component Quality: High
- ✅ Feature Completeness: 95%
- ✅ Overall Grade: A (90+)

---

## Risk Mitigation

| Risk | Mitigation Strategy |
|------|-------------------|
| Testing takes longer than expected | Start with critical paths only, expand coverage incrementally |
| RLS policies break existing functionality | Test thoroughly in staging before production |
| Performance optimization conflicts with features | Use feature flags to roll back if needed |
| Team bandwidth constraints | Prioritize P0 strictly, defer P2/P3 if necessary |

---

## Definition of Done (Production Checklist)

Before deploying to production with real patient data:

- [ ] All P0 tasks complete
- [ ] All tests passing in CI/CD
- [ ] Security audit passed
- [ ] Lighthouse score 90+ on all pages
- [ ] WCAG AA compliance verified
- [ ] Error monitoring active and tested
- [ ] Load testing completed (100+ concurrent users)
- [ ] Backup and recovery tested
- [ ] Incident response plan documented
- [ ] HIPAA compliance reviewed (if applicable)

---

## Notes

- **Do not skip P0 tasks** - These are blocking issues for production
- **P1 tasks significantly improve UX** - Highly recommended before launch
- **P2 tasks are "nice to have"** - Can be done post-launch
- **P3 tasks are future enhancements** - No immediate impact

**Current Recommendation:** Complete P0 + P1 (6 weeks) before production deployment with real patient data.
