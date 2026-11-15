# Security

This beta is designed for one private account per instance. Use HTTPS through a
reverse proxy, change the random bootstrap password after first login, keep the
data volume private, and back it up before upgrades. Do not publish the backend
HTTP port directly to the Internet.

Upload and progress routes require authentication. The public health endpoint
and course material do not contain user records. Login throttling uses the
direct socket address; behind a reverse proxy the limit is shared. Add rate
limiting at the proxy if needed; arbitrary forwarded IP headers are not trusted.

For a suspected vulnerability, use this repository's private vulnerability
reporting feature if enabled. Do not post passwords, databases, personal
artwork, or exploitable private deployment details in public issues.
