# ALL-44 final database readback

Read back from linked Supabase after the authenticated final run.

| Check | Result |
| --- | ---: |
| Remaining submissions for final batch | 0 |
| Remaining final-run candidates | 0 |
| Manual cleanup audit rows in the final window | 5 |
| Rate-limit attempts across final evidence runs | 5 |
| Stale self-granted app-admin recruiting snapshots | 0 |

The same two-file batch was replayed with the original batch key. The replay
did not add rate attempts or duplicate candidates. Additional final-revision
runs brought both the cleanup-audit and rate-attempt totals to five.
