# Script subscription bundles

ScriptVault accepts a curated `==UserSubscribe==` header when the source is
opened from an HTTPS URL. The header may declare `@name`, `@description`,
`@version`, `@author`, one or more `@connect` hosts, and one or more
`@scriptUrl` entries. The install page fetches and parses every member, shows
its metadata, grants, risk summary, and effective network scope, then waits
for one explicit confirmation before writing anything.

The effective member `@connect` list is the intersection of the member's own
list and the bundle list. A bundle can therefore narrow a member's scope, but
never widen it. A member with no overlapping host is installed with no extra
`@connect` entries. Closed or malformed members fail the whole review.

Bundle refreshes reuse the normal update-review queue. New members are queued
as subscription installs, changed members use the normal update diff, and
members removed from the bundle become explicit uninstall proposals. No
member is silently removed during refresh.

The bundle source and member URLs are HTTPS-only. Each member still goes
through the standard parser, trust receipt, dependency, registration, and
quarantine gates used by a direct install.
