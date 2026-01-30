# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.

### How to Report

1. **Do NOT** open a public GitHub issue for security vulnerabilities
2. Email security concerns to the maintainers (see repository owner contact)
3. Or use GitHub's private vulnerability reporting feature:
   - Go to the Security tab of this repository
   - Click "Report a vulnerability"
   - Fill out the form with details

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### What to Expect

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 1 week
- **Resolution Timeline**: Depends on severity
  - Critical: Within 7 days
  - High: Within 30 days
  - Medium/Low: Within 90 days

### Safe Harbor

We consider security research conducted in good faith to be authorized. We will not pursue legal action against researchers who:

- Make a good faith effort to avoid privacy violations, data destruction, or service interruption
- Only interact with accounts they own or have explicit permission to test
- Do not exploit vulnerabilities beyond what is necessary to demonstrate the issue
- Report vulnerabilities promptly and do not disclose publicly until we've had time to address them

## Security Measures

This project implements several security measures:

- **Input validation**: All user inputs are validated and sanitized
- **Authentication**: Secure token-based authentication with proper expiration
- **Authorization**: Role-based access controls on all endpoints
- **Dependency scanning**: Automated vulnerability scanning via Dependabot and CodeQL
- **Secret management**: No secrets are committed to the repository
- **HTTPS only**: All production traffic is encrypted

## Security-Related Configuration

When deploying, ensure you:

1. Set strong, unique values for all secrets (`CAPTURE_SHARED_SECRET`, `POLAR_WEBHOOK_SECRET`, etc.)
2. Use HTTPS for all public endpoints
3. Keep all dependencies up to date
4. Review and apply security updates promptly
5. Use environment variables for all sensitive configuration
