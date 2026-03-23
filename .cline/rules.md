# Juice Shop Security Development Rules

## Mandatory Security Rules

### Code Submission Requirements

#### 🔴 CRITICAL RULES (Must Follow)
1. **No Hardcoded Secrets**
   - Never commit passwords, API keys, tokens, or certificates
   - Use environment variables for all sensitive configuration
   - Validate no secrets in pre-commit hooks before commit

2. **Authentication Required**
   - All API endpoints must implement authentication
   - Rate limiting on authentication endpoints
   - Secure session management with HttpOnly, Secure cookies

3. **Input Validation Mandatory**
   - Validate all user inputs using whitelisting
   - Sanitize inputs before processing
   - Use parameterized queries for database operations

4. **Output Encoding Required**
   - Context-aware encoding for all user-generated content
   - CSP headers to prevent XSS
   - No use of `innerHTML` or `eval()` with user input

#### 🟡 HIGH PRIORITY RULES
5. **Authorization Implementation**
   - Every endpoint must have proper authorization checks
   - Follow principle of least privilege
   - Validate user permissions for all resource access

6. **Error Handling Security**
   - Generic error messages for users
   - Detailed errors only in logs
   - No stack traces or internal system exposure

7. **Security Headers Required**
   - Implement all OWASP recommended security headers
   - HSTS for HTTPS environments
   - Proper CORS configuration

8. **Logging Security Events**
   - Log authentication attempts (success/failure)
   - Log authorization failures
   - Log security-relevant events for audit trail

### Development Process Rules

#### 🟢 MEDIUM PRIORITY RULES
9. **Security Testing Required**
   - Write security test cases for new features
   - Run `security/tests/security.test.js` before commits
   - Validate tests cover authentication, authorization, and input validation

10. **Dependency Management**
    - Run `npm audit` before adding new dependencies
    - Update vulnerable dependencies promptly
    - Review security implications of third-party packages

11. **Code Review Security Checklist**
    - Review must include security validation
    - Check all rules above are followed
    - Document security decisions and trade-offs

12. **Documentation Requirements**
    - Update security specifications for new features
    - Document security assumptions and requirements
    - Include security considerations in API documentation

## File-Specific Rules

### Authentication Files (`/security/specs/auth.yaml`)
- All authentication flows must be documented
- Password policies must meet minimum requirements
- MFA implementation details must be specified
- Session timeout and invalidation rules defined

### Input Validation Files (`/security/specs/input-validation.yaml`)
- Validation rules for all input types documented
- Sanitization procedures specified
- Error handling for invalid inputs defined
- Maximum input lengths and formats specified

### Security Policies (`/security/policies/enforcement.md`)
- All policy violations must be documented
- Enforcement mechanisms clearly defined
- Exception process documented with justification
- Regular policy review schedule established

### Test Files (`/security/tests/security.test.js`)
- Test coverage must include all security controls
- Tests must validate both positive and negative cases
- Performance impact of security controls tested
- Tests updated when security requirements change

### Pre-commit Hooks (`/security/hooks/pre-commit.sh`)
- Hook must be executable and linked in git config
- All critical security checks must pass before commit
- Hook failures must block commits
- Hook failures logged for later review

## Violation Handling

### Critical Violations (🔴)
- **Action**: Block commit immediately
- **Resolution**: Must fix before resubmission
- **Escalation**: Report to security team
- **Documentation**: Record in security audit log

### High Priority Violations (🟡)
- **Action**: Warn but allow commit with explicit acknowledgment
- **Resolution**: Fix before next release
- **Tracking**: Create security ticket
- **Review**: Security team review required

### Medium Priority Violations (🟢)
- **Action**: Log warning
- **Resolution**: Address in next sprint
- **Documentation**: Note in technical debt
- **Monitoring**: Track for trends

## Exception Process

### Requesting Exceptions
1. **Document Justification**
   - Explain why rule cannot be followed
   - Document alternative security controls
   - Risk assessment and mitigation plan

2. **Security Review**
   - Security team evaluates exception request
   - Risk assessment performed
   - Alternative solutions considered

3. **Approval Process**
   - Security team lead approval required
   - Exception documented with expiry date
   - Regular review of exception status

### Exception Categories
- **Temporary Exception**: Limited duration, specific project needs
- **Permanent Exception**: Incompatible with system architecture
- **Educational Exception**: For Juice Shop training purposes

## Quality Assurance Rules

### Security Testing Mandates
1. **Automated Security Tests**
   - All security specifications must have automated tests
   - Tests must run in CI/CD pipeline
   - Test failures must block deployment

2. **Manual Security Review**
   - Security review for all major features
   - Penetration testing before releases
   - Regular security assessments

3. **Security Regression Testing**
   - Retest security controls after changes
   - Validate no new vulnerabilities introduced
   - Performance impact assessment

### Code Quality Standards
1. **Security Code Reviews**
   - Peer review focused on security
   - Security checklist completion required
   - Documentation of security decisions

2. **Static Analysis Integration**
   - Security linters enabled in IDE
   - CI/CD pipeline includes security scanning
   - All findings addressed before release

## Monitoring and Compliance

### Continuous Security Monitoring
1. **Security Metrics**
   - Track security rule compliance
   - Monitor vulnerability trends
   - Measure security test coverage

2. **Audit Trail**
   - All security decisions documented
   - Changes to security controls tracked
   - Exception requests logged

### Compliance Validation
1. **Regular Security Audits**
   - Quarterly security assessments
   - Compliance with documented rules
   - Gap analysis and remediation planning

2. **Security Training**
   - Team training on security rules
   - Update training when rules change
   - Competency validation

## Enforcement Mechanisms

### Automated Enforcement
- Pre-commit hooks prevent critical violations
- CI/CD pipeline validates security requirements
- Automated scanning for security issues

### Manual Enforcement
- Code review security validation
- Security team approval for exceptions
- Regular security assessments

### Progressive Discipline
1. First violation: Education and remediation
2. Repeated violations: Additional training
3. Chronic violations: Process restrictions

## Rule Updates

### Rule Modification Process
1. **Proposal**: Security team proposes changes
2. **Review**: Stakeholders review impact
3. **Approval**: Security team lead approval
4. **Communication**: Team training on changes
5. **Implementation**: Update tools and processes

### Rule Categories
- **Mandatory Rules**: Cannot be violated without exception
- **Guidelines**: Best practices with flexibility
- **Recommendations**: Optional security improvements

## Success Metrics

### Security Health Indicators
- Reduction in security vulnerabilities
- Improved security test coverage
- Faster security issue resolution
- Increased security awareness

### Quality Metrics
- Code review completion rate
- Security rule compliance percentage
- Security test pass rate
- Vulnerability response time

By following these rules, we ensure the Juice Shop maintains strong security controls while serving its educational mission of security awareness training.