# Deployment Context Questionnaire

**Purpose:** This information is needed to complete P0 checklist items (health checks, alerts, backup verification).

**Instructions:** Fill in the blanks below. If you don't know an answer, mark it "UNKNOWN" and we'll help you find it.

---

## 1. Backend Deployment

### **Hosting Provider:**
```
[ ] Railway
[ ] Render
[ ] Fly.io
[ ] AWS ECS/Fargate
[ ] Google Cloud Run
[ ] Azure Container Apps
[ ] Self-hosted VM
[ ] Other: ___________________
```

### **Deployment URL:**
```
Production HTTP URL:  https://___________________
Production WebSocket: wss://____________________
```

### **Number of Instances/Workers:**
```
How many backend processes are running?
[ ] Single instance (1 process)
[ ] Multiple instances (specify: ___ processes)
[ ] Auto-scaling (min: ___, max: ___)
[ ] Unknown
```

### **How do you deploy?**
```
[ ] Git push to main branch (auto-deploy)
[ ] Manual deploy via web dashboard
[ ] CI/CD pipeline (GitHub Actions, CircleCI, etc.)
[ ] Docker image push
[ ] Other: ___________________
```

---

## 2. Database

### **Database Provider:**
```
[ ] Supabase (https://supabase.com)
[ ] Self-hosted PostgreSQL on VM
[ ] AWS RDS
[ ] Google Cloud SQL
[ ] Azure Database for PostgreSQL
[ ] Other: ___________________
```

### **If Supabase:**
```
Project URL: https://___________________.supabase.co
Plan:
  [ ] Free tier
  [ ] Pro ($25/month)
  [ ] Team
  [ ] Enterprise
  [ ] Unknown

Are automatic backups enabled?
  [ ] Yes (check: Project → Database → Backups)
  [ ] No
  [ ] Unknown
```

### **If Self-hosted PostgreSQL:**
```
Host: ___________________
Port: ___________________
Database name: ___________________

Backup strategy:
  [ ] pg_dump cron job (where stored: ___________________)
  [ ] Continuous archiving (WAL)
  [ ] Cloud provider snapshots
  [ ] No backups configured yet
  [ ] Unknown
```

### **Connection Pooling:**
```
Do you have connection pooling configured?
  [ ] Yes - using PgBouncer
  [ ] Yes - using Supabase built-in pooler
  [ ] Yes - other: ___________________
  [ ] No
  [ ] Unknown

Max connections allowed: ___________________
```

---

## 3. Monitoring & Logging

### **Where are backend logs visible?**
```
[ ] Hosting provider dashboard (Railway/Render logs)
[ ] CloudWatch (AWS)
[ ] Google Cloud Logging
[ ] Papertrail
[ ] Logtail
[ ] Just `docker logs` on the VM
[ ] Unknown
```

### **Log retention period:**
```
How long are logs kept?
  [ ] 7 days
  [ ] 30 days
  [ ] 90 days
  [ ] Forever
  [ ] Unknown
```

### **Do you have error tracking setup?**
```
[ ] Yes - Sentry
[ ] Yes - Rollbar
[ ] Yes - Bugsnag
[ ] Yes - other: ___________________
[ ] No (we should add this!)
[ ] Unknown
```

---

## 4. Alerting

### **Do you currently have alerts configured?**
```
[ ] Yes - describe: ___________________
[ ] No (we'll set this up)
[ ] Unknown
```

### **Preferred alert method:**
```
[ ] Email
[ ] SMS
[ ] Slack
[ ] PagerDuty
[ ] Discord webhook
[ ] Other: ___________________
```

### **Who should receive alerts?**
```
Primary contact:
  Name: ___________________
  Email: ___________________
  Phone (optional): ___________________

Secondary contact (optional):
  Name: ___________________
  Email: ___________________
```

---

## 5. Twilio (Voice/SMS)

### **Twilio Account:**
```
Phone number: ___________________

Where is Twilio webhook configured?
  [ ] In Twilio console (Phone Numbers → Configure)
  [ ] Not configured yet
  [ ] Unknown

Current webhook URL: https://___________________/api/sms/inbound
```

### **Voice call routing:**
```
How are voice calls currently handled?
  [ ] Direct WebSocket to /ws/voice/{session_id}
  [ ] Through Twilio Media Streams
  [ ] Not set up yet
  [ ] Other: ___________________
```

---

## 6. Google Calendar

### **Calendar credentials:**
```
Where are credentials.json and token.json stored?
  [ ] In backend/ directory (committed to git)
  [ ] In backend/ directory (gitignored, manually uploaded)
  [ ] As environment variables (base64 encoded)
  [ ] As Railway/Render secrets
  [ ] Other: ___________________
  [ ] Unknown
```

### **Calendar ID:**
```
GOOGLE_CALENDAR_ID: ___________________@group.calendar.google.com

Is this calendar dedicated to Eva or shared?
  [ ] Dedicated to Eva only
  [ ] Shared with other services
```

---

## 7. Demo Timeline

### **When is the demo?**
```
Date: ___________________
Time: ___________________
Timezone: ___________________

Is this a live demo or recorded?
  [ ] Live demo to customer
  [ ] Recorded demo for later
  [ ] Internal testing only
```

### **Who will attend?**
```
Internal team: ___________________
External attendees: ___________________
```

---

## 8. Testing Access

### **Do you have a staging environment?**
```
[ ] Yes - URL: https://___________________
[ ] No (we test in production carefully)
[ ] Unknown
```

### **Can we run load tests against production?**
```
[ ] Yes, but only during off-hours (specify: ___________________)
[ ] Yes, anytime
[ ] No, create staging first
[ ] Unknown
```

---

## 9. Current Issues (If Any)

### **Are there any known issues right now?**
```
[ ] No known issues
[ ] Yes - describe:
  1. ___________________
  2. ___________________
  3. ___________________
```

### **What's your biggest concern about the demo?**
```
___________________
___________________
___________________
```

---

## Next Steps After Completing This Form

Once you fill this out, we can:

1. **Configure health checks** (15-30 min)
   - Set up `/health/ready` endpoint monitoring
   - Enable auto-restart on failures

2. **Set up alerts** (15-30 min)
   - Configure crash/restart notifications
   - Set up 5xx error spike detection

3. **Verify backups** (30 min)
   - Check backup configuration
   - Document restore procedure
   - Test restore if time permits

4. **Prepare test environment** (15 min)
   - Get WebSocket URL ready for load test
   - Get Twilio number ready for smoke tests

5. **Create custom runbook** (30 min)
   - "If X goes wrong during demo, do Y"
   - Specific to your infrastructure

---

## How to Submit

You can either:

1. **Fill this out inline** and share the file
2. **Answer in a message** with section numbers
3. **Schedule a 15-min call** to walk through it together

**Estimated time to complete:** 15-20 minutes

