#!/bin/bash

# Juice Shop Pre-commit Security Hook
# This script runs security checks before allowing commits to proceed

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(git rev-parse --show-toplevel)"
SEURITY_DIR="$PROJECT_ROOT/security"
LOG_FILE="$PROJECT_ROOT/.git/security-check.log"

# Create log file directory
mkdir -p "$(dirname "$LOG_FILE")"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[SECURITY CHECK]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[FAIL]${NC} $1"
}

# Function to log results
log_result() {
    local status=$1
    local check=$2
    local message=$3
    echo "$(date '+%Y-%m-%d %H:%M:%S') [$status] $check: $message" >> "$LOG_FILE"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to get staged files
get_staged_files() {
    git diff --cached --name-only --diff-filter=ACM
}

# Function to check if file is security-relevant
is_security_relevant() {
    local file=$1
    local security_patterns=(
        "routes/.*\.js$"
        "controllers/.*\.js$"
        "middleware/.*\.js$"
        "models/.*\.js$"
        "app\.js$"
        "server\.js$"
        "package\.json$"
        "config/.*\.js$"
        "lib/.*\.js$"
        "src/.*\.ts$"
        "frontend/src/.*\.(js|ts|tsx)$"
        "dockerfile"
        "docker-compose.*\.yml$"
        "\.env.*"
    )

    for pattern in "${security_patterns[@]}"; do
        if echo "$file" | grep -qE "$pattern"; then
            return 0
        fi
    done
    return 1
}

print_status "Running pre-commit security checks..."

# Get list of staged files
staged_files=$(get_staged_files)
if [ -z "$staged_files" ]; then
    print_warning "No staged files found"
    exit 0
fi

# Filter security-relevant files
security_files=""
for file in $staged_files; do
    if is_security_relevant "$file"; then
        security_files="$security_files $file"
    fi
done

if [ -z "$security_files" ]; then
    print_success "No security-relevant files in commit"
    exit 0
fi

print_status "Found security-relevant files: $security_files"

# Initialize counters
checks_passed=0
checks_failed=0
checks_warned=0

# 1. Check for hardcoded secrets and sensitive data
print_status "Checking for hardcoded secrets..."

secret_patterns=(
    "password\s*=\s*['\"][^'\"]{8,}['\"]"
    "api[_-]?key\s*=\s*['\"][^'\"]{16,}['\"]"
    "secret[_-]?key\s*=\s*['\"][^'\"]{16,}['\"]"
    "token\s*=\s*['\"][^'\"]{16,}['\"]"
    "private[_-]?key"
    "aws_[a-z_]+_key"
    "mongodb://[^@]+:[^@]+@"
    "mysql://[^@]+:[^@]+@"
    "postgresql://[^@]+:[^@]+@"
    "-----BEGIN [A-Z ]+-----"
    "sk_test_[a-zA-Z0-9]{24,}"
    "ghp_[a-zA-Z0-9]{36}"
)

has_secrets=false
for file in $security_files; do
    if [ -f "$PROJECT_ROOT/$file" ]; then
        for pattern in "${secret_patterns[@]}"; do
            if grep -rnE "$pattern" "$PROJECT_ROOT/$file" 2>/dev/null; then
                print_error "Potential secret found in $file matching pattern: $pattern"
                has_secrets=true
                log_result "FAIL" "Secret Scan" "Secret found in $file"
            fi
        done
    fi
done

if [ "$has_secrets" = false ]; then
    print_success "No hardcoded secrets detected"
    log_result "PASS" "Secret Scan" "No secrets found"
    ((checks_passed++))
else
    ((checks_failed++))
fi

# 2. Check for common vulnerabilities in JavaScript/TypeScript code
print_status "Analyzing code for common vulnerabilities..."

vulnerability_patterns=(
    "eval\("
    "Function\("
    "setTimeout\(.*[,].*["\']"
    "setInterval\(.*[,].*["\']"
    "innerHTML\s*="
    "outerHTML\s*="
    "document\.write\("
    "dangerouslySetInnerHTML"
    "crypto\.createHash\(['\"]md5['\"]"
    "crypto\.createHash\(['\"]sha1['\"]"
    "\.exec\("
    "child_process\.(exec|spawn)"
    "require\(['\"]child_process['\"]"
)

has_vulnerabilities=false
for file in $security_files; do
    if [[ "$file" =~ \.(js|ts|jsx|tsx)$ ]] && [ -f "$PROJECT_ROOT/$file" ]; then
        for pattern in "${vulnerability_patterns[@]}"; do
            if grep -rnE "$pattern" "$PROJECT_ROOT/$file" 2>/dev/null; then
                print_warning "Potential vulnerability in $file: $pattern"
                has_vulnerabilities=true
                log_result "WARN" "Vulnerability Scan" "Potential vulnerability in $file"
            fi
        done
    fi
done

if [ "$has_vulnerabilities" = false ]; then
    print_success "No obvious vulnerabilities detected"
    log_result "PASS" "Vulnerability Scan" "No vulnerabilities found"
    ((checks_passed++))
else
    ((checks_warned++))
fi

# 3. Check package.json for vulnerable dependencies
if [[ " $security_files " =~ " package.json " ]] && [ -f "$PROJECT_ROOT/package.json" ]; then
    print_status "Checking package.json for security issues..."

    # Check for known vulnerable packages
    vulnerable_packages=(
        "ejs.*[<]3\.1\.6"
        "lodash.*[<]4\.17\.21"
        "request.*[<]2\.88\.2"
        "node-forge.*[<]1\.3\.0"
        "axios.*[<]0\.21\.1"
        "minimist.*[<]1\.2\.6"
        "node-fetch.*[<]2\.6\.7"
    )

    has_vulnerable_deps=false
    for package_pattern in "${vulnerable_packages[@]}"; do
        if grep -E "\"$package_pattern\"" "$PROJECT_ROOT/package.json"; then
            print_error "Vulnerable package version detected: $package_pattern"
            has_vulnerable_deps=true
            log_result "FAIL" "Dependency Check" "Vulnerable package: $package_pattern"
        fi
    done

    if [ "$has_vulnerable_deps" = false ]; then
        print_success "No obviously vulnerable packages detected"
        log_result "PASS" "Dependency Check" "No vulnerabilities found"
        ((checks_passed++))
    else
        ((checks_failed++))
    fi
fi

# 4. Run npm audit if available and package.json is modified
if [[ " $security_files " =~ " package.json " ]] && command_exists npm; then
    print_status "Running npm audit..."

    if npm audit --audit-level=high >/dev/null 2>&1; then
        print_success "npm audit passed"
        log_result "PASS" "NPM Audit" "No high vulnerabilities found"
        ((checks_passed++))
    else
        print_warning "npm audit found vulnerabilities"
        npm audit --audit-level=high || true
        log_result "WARN" "NPM Audit" "Vulnerabilities found"
        ((checks_warned++))
    fi
fi

# 5. Check for security configuration files
print_status "Checking security configuration..."

security_files_required=(
    "SECURITY.md"
    ".gitignore"
    "package.json"
)

config_issues=false
for required_file in "${security_files_required[@]}"; do
    if [ ! -f "$PROJECT_ROOT/$required_file" ]; then
        if [ "$required_file" = "SECURITY.md" ]; then
            print_warning "SECURITY.md file missing - consider adding one"
            log_result "WARN" "Config Check" "SECURITY.md missing"
            ((checks_warned++))
        fi
    else
        if [ "$required_file" = ".gitignore" ]; then
            # Check for common security entries in .gitignore
            ignore_entries=(
                ".env"
                "*.key"
                "*.pem"
                "*.p12"
                "node_modules"
                ".DS_Store"
                "*.log"
            )

            for entry in "${ignore_entries[@]}"; do
                if ! grep -q "^$entry" "$PROJECT_ROOT/.gitignore"; then
                    print_warning "$entry not found in .gitignore"
                    log_result "WARN" "Gitignore Check" "$entry not ignored"
                    config_issues=true
                fi
            done
        fi
    fi
done

if [ "$config_issues" = false ]; then
    print_success "Security configuration looks good"
    log_result "PASS" "Config Check" "Configuration OK"
    ((checks_passed++))
fi

# 6. Check Docker files for security best practices
docker_files=""
for file in $security_files; do
    if [[ "$file" =~ (Dockerfile|docker-compose.*\.yml)$ ]]; then
        docker_files="$docker_files $file"
    fi
done

if [ -n "$docker_files" ]; then
    print_status "Checking Docker configuration for security..."

    docker_issues=false
    for docker_file in $docker_files; do
        if [ -f "$PROJECT_ROOT/$docker_file" ]; then
            # Check for running as root
            if grep -qi "USER.*root" "$PROJECT_ROOT/$docker_file"; then
                print_warning "Container running as root in $docker_file"
                log_result "WARN" "Docker Check" "Running as root in $docker_file"
                docker_issues=true
            fi

            # Check for exposing ports
            if grep -q "EXPOSE 22" "$PROJECT_ROOT/$docker_file"; then
                print_warning "SSH port exposed in $docker_file"
                log_result "WARN" "Docker Check" "SSH exposed in $docker_file"
                docker_issues=true
            fi
        fi
    done

    if [ "$docker_issues" = false ]; then
        print_success "Docker configuration looks secure"
        log_result "PASS" "Docker Check" "Docker config OK"
        ((checks_passed++))
    else
        ((checks_warned++))
    fi
fi

# 7. Run ESLint security rules if available
if command_exists eslint && [ -f "$PROJECT_ROOT/.eslintrc.js" ]; then
    print_status "Running ESLint security rules..."

    eslint_files=""
    for file in $security_files; do
        if [[ "$file" =~ \.(js|ts|jsx|tsx)$ ]]; then
            eslint_files="$eslint_files $PROJECT_ROOT/$file"
        fi
    done

    if [ -n "$eslint_files" ]; then
        if eslint $eslint_files --config "$PROJECT_ROOT/.eslintrc.js" 2>/dev/null; then
            print_success "ESLint security rules passed"
            log_result "PASS" "ESLint Check" "No security issues found"
            ((checks_passed++))
        else
            print_warning "ESLint found potential security issues"
            log_result "WARN" "ESLint Check" "Security issues found"
            ((checks_warned++))
        fi
    fi
fi

# 8. Check for proper error handling
print_status "Checking error handling practices..."

error_handling_patterns=(
    "console\.log\(.*error"
    "console\.error\("
    "throw\s+new\s+Error\("
    "catch\s*\([^)]*\)\s*\{"
)

error_issues=false
for file in $security_files; do
    if [[ "$file" =~ \.(js|ts|jsx|tsx)$ ]] && [ -f "$PROJECT_ROOT/$file" ]; then
        # Check for console.error that might expose sensitive info
        if grep -n "console\.error.*\(password|token|secret|key\)" "$PROJECT_ROOT/$file" 2>/dev/null; then
            print_error "Potential sensitive data in console.error in $file"
            error_issues=true
            log_result "FAIL" "Error Handling" "Sensitive data in console.error in $file"
        fi
    fi
done

if [ "$error_issues" = false ]; then
    print_success "Error handling looks secure"
    log_result "PASS" "Error Handling" "Error handling OK"
    ((checks_passed++))
else
    ((checks_failed++))
fi

# 9. Check authentication and authorization patterns
print_status "Checking authentication/authorization patterns..."

auth_files=""
for file in $security_files; do
    if [[ "$file" =~ (routes|controllers|middleware) ]]; then
        auth_files="$auth_files $file"
    fi
done

auth_issues=false
if [ -n "$auth_files" ]; then
    for file in $auth_files; do
        if [ -f "$PROJECT_ROOT/$file" ]; then
            # Check for routes without authentication
            if grep -n "app\.\(get|post|put|delete\).*function.*req.*res" "$PROJECT_ROOT/$file" 2>/dev/null; then
                if ! grep -qn "requireAuthentication\|isLoggedIn\|authenticate" "$PROJECT_ROOT/$file" 2>/dev/null; then
                    print_warning "Potential unauthenticated route in $file"
                    log_result "WARN" "Auth Check" "Potential unauthenticated route in $file"
                    auth_issues=true
                fi
            fi
        fi
    done
fi

if [ "$auth_issues" = false ]; then
    print_success "Authentication patterns look OK"
    log_result "PASS" "Auth Check" "Auth patterns OK"
    ((checks_passed++))
else
    ((checks_warned++))
fi

# 10. Check for input validation
print_status "Checking input validation..."

validation_issues=false
for file in $security_files; do
    if [[ "$file" =~ \.(js|ts|jsx|tsx)$ ]] && [ -f "$PROJECT_ROOT/$file" ]; then
        # Check for req.body, req.query, req.params usage without validation
        if grep -n "req\.\(body|query|params\)\." "$PROJECT_ROOT/$file" 2>/dev/null; then
            if ! grep -qn "validate\|joi\|express-validator\|check" "$PROJECT_ROOT/$file" 2>/dev/null; then
                print_warning "Potential unvalidated input in $file"
                log_result "WARN" "Input Validation" "Potential unvalidated input in $file"
                validation_issues=true
            fi
        fi
    fi
done

if [ "$validation_issues" = false ]; then
    print_success "Input validation patterns look OK"
    log_result "PASS" "Input Validation" "Validation patterns OK"
    ((checks_passed++))
else
    ((checks_warned++))
fi

# Summary
echo
print_status "Security check summary:"
echo -e "  ${GREEN}Passed: $checks_passed${NC}"
echo -e "  ${YELLOW}Warnings: $checks_warned${NC}"
echo -e "  ${RED}Failed: $checks_failed${NC}"

# Log summary
log_result "SUMMARY" "Pre-commit Check" "Passed: $checks_passed, Warnings: $checks_warned, Failed: $checks_failed"

# Determine if commit should be blocked
if [ $checks_failed -gt 0 ]; then
    echo
    print_error "Commit blocked due to security failures!"
    echo "Please fix the security issues before committing."
    echo "Check the log file for details: $LOG_FILE"
    exit 1
elif [ $checks_warned -gt 0 ]; then
    echo
    print_warning "Commit allowed with security warnings!"
    echo "Consider addressing the security warnings for better security posture."
    echo "Check the log file for details: $LOG_FILE"
    exit 0
else
    echo
    print_success "All security checks passed! Commit allowed."
    exit 0
fi