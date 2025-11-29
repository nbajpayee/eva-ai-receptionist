# Archived Documentation

This directory contains historical documentation from Eva AI's development phases. These files are preserved for reference but are not part of the active codebase.

## Why Archive Instead of Delete?

These documents capture important architectural decisions, migration strategies, and implementation details that may be valuable for:
- Understanding the evolution of the system
- Future audits or compliance reviews
- Reference during similar refactoring efforts
- Historical context for team onboarding

## Contents

### Phase 2 Omnichannel Migration (Complete - Nov 10, 2025)

**Migration completed successfully. All 77 legacy call sessions migrated to new conversations schema.**

| File | Purpose | Status |
|------|---------|--------|
| `OMNICHANNEL_MIGRATION.md` | Original migration plan and architecture for Phase 2 | ✅ Complete |
| `MIGRATION_SUCCESS.md` | Post-migration validation report | ✅ Complete |
| `CUSTOMER_LINKAGE_TEST.md` | Customer relationship testing during migration | ✅ Complete |
| `DUAL_WRITE_VALIDATION.md` | Dual-write strategy validation during cutover | ✅ Complete |

**Current Status**: System now uses unified `conversations` schema for voice, SMS, and email. Legacy `call_sessions` and `call_events` schemas have been removed.

**For Current Implementation**: See `CLAUDE.md` and `README.md` Phase 2 sections.

---

### Research & Outbound Campaigns (Not Yet Implemented)

**These features were designed for Phase 2.5+ but postponed to focus on core booking functionality.**

| File | Purpose | Status |
|------|---------|--------|
| `RESEARCH_OUTBOUND_IMPLEMENTATION.md` | Outbound SMS/email campaign implementation plan | ⏳ Deferred |
| `RESEARCH_PHASE2_COMPLETE.md` | Research campaign completion report | ⏳ Deferred |
| `RESEARCH_IMPLEMENTATION_REVIEW.md` | Research feature implementation review | ⏳ Deferred |
| `MESSAGING_CONSOLE_MVP_SPEC.md` | Messaging console MVP specification (31KB) | ⏳ Deferred |

**Future Plans**: These features are on the roadmap for Phase 3 when customer outreach and retention becomes a priority. The research and design work is complete; implementation postponed.

**For Current Roadmap**: See `TODO.md` "Up Next" section.

---

## When to Reference These Files

### Use `OMNICHANNEL_MIGRATION.md` when:
- Understanding why the conversations schema was designed this way
- Planning similar migrations for other multi-channel features
- Debugging edge cases in channel-specific handling
- Writing technical documentation about the system's evolution

### Use Research Campaign Files when:
- Planning Phase 3 outbound campaigns
- Designing customer segmentation features
- Implementing multi-channel outreach
- Building campaign analytics

---

## Active Documentation

For current system documentation, reference:

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Master documentation for Claude Code development sessions |
| `README.md` | Project overview, setup, architecture |
| `BOOKING_ARCHITECTURE.md` | Current booking system implementation details |
| `TODO.md` | Active roadmap and sprint planning |
| `DEPLOYMENT.md` | Production deployment guide |

---

## Cleanup History

**Archived**: November 29, 2025
**Reason**: Codebase cleanup to reduce root directory clutter (57 MD files → 11 core files)
**Decision**: Archive instead of delete to preserve historical context

**Files Deleted** (low-value historical docs):
- Round-based debugging logs (5 files)
- Authentication duplicates (4 files)
- Test planning docs (3 files)
- Session summaries (4 files)
- Security checklists (4 files)
- Implementation summaries (4 files)
- Deployment context (2 files)
- Legacy code: `frontend/app.js`, `frontend/index.html`, `ava_database.db`, migration scripts

**Total Impact**: ~40 files removed/archived, repository significantly cleaner and more navigable.

---

**Last Updated**: November 29, 2025
**Maintained By**: Development Team
