---
"emdash": patch
"@emdash-cms/admin": patch
---

Stops the admin sidebar from polling `/_emdash/api/admin/comments/counts` on sites where no collection has comments enabled. The comment inbox link and its pending-count badge now appear only when at least one collection accepts comments.
