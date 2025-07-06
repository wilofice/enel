# Follow Up Job

This background task scans recent messages to suggest conversations that need attention.

Two simple rules are applied:

1. **Unanswered questions** – if a contact sent a message containing a `?` and no reply was sent afterwards, the job records a follow up.
2. **Catch ups** – contacts that have not exchanged any message for 30 days are also listed.

Results are stored in the `FollowUps` table and shown on the dashboard. Run the job manually with:

```
node src/followUpJob.js
```

It is also included in `masterJob.js` so scheduled runs can call that script once per day.
