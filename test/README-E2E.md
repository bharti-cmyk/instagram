# End-to-End (E2E) Testing Guide

## Overview

End-to-End tests verify that your entire application works correctly from the HTTP request level down to the database. Unlike unit tests that test individual functions in isolation, E2E tests test the complete flow of your application.

## What E2E Tests Cover

### 1. **HTTP Request/Response Flow**
- Tests actual HTTP endpoints
- Verifies correct status codes (200, 201, 400, 401, 404, etc.)
- Validates response body structure and content
- Tests request headers (Authorization, Content-Type, etc.)

### 2. **Authentication & Authorization**
- JWT token generation and validation
- Protected route access control
- Token refresh mechanisms
- Logout functionality

### 3. **Database Integration**
- Data persistence in MySQL
- Data retrieval and updates
- Transaction handling
- Data validation at the database level

### 4. **Redis Integration**
- Token storage and retrieval
- Session management
- Cache operations

### 5. **Business Logic Flow**
- Complete user registration → login → profile update flow
- Password change workflows
- Error handling across the entire stack

## Test Structure

### Test Categories

1. **Registration Tests** (`/auth/register`)
   - Successful user registration
   - Duplicate username handling
   - Invalid data validation

2. **Login Tests** (`/auth/login`)
   - Successful authentication
   - Invalid credentials handling
   - Non-existent user handling

3. **Logout Tests** (`/auth/logout`)
   - Successful logout with valid token
   - Invalid token handling
   - Missing token handling

4. **Token Refresh Tests** (`/auth/refresh`)
   - Token refresh with valid refresh token
   - Invalid refresh token handling

5. **Password Management** (`/auth/change-password`)
   - Successful password change
   - Incorrect old password handling
   - Unauthenticated access prevention

6. **Profile Management** (`/auth/profile`)
   - Profile retrieval with authentication
   - Profile updates
   - Unauthenticated access prevention

7. **Password Reset** (`/auth/forgot-password`)
   - Reset token generation
   - Non-existent email handling

8. **Protected Routes**
   - Access with valid tokens
   - Access without tokens
   - Access with invalid tokens

9. **Database Integration**
   - Data persistence verification
   - Redis token storage verification

## Running E2E Tests

### Prerequisites

1. **Database Setup**
   ```bash
   # Ensure your MySQL database is running
   # Update .env file with test database credentials
   ```

2. **Redis Setup**
   ```bash
   # Ensure Redis is running
   # Default: localhost:6379
   ```

3. **Environment Variables**
   ```env
   # Test database
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=instagram_test

   # Redis
   REDIS_HOST=localhost
   REDIS_PORT=6379

   # JWT Secrets
   JWT_SECRET=your_jwt_secret
   JWT_REFRESH_SECRET=your_refresh_secret

   # Email (for password reset tests)
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_app_password
   TEST_RECEIVER=test@example.com
   ```

### Running Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run specific E2E test file
npm run test:e2e -- test/auth.e2e-spec.ts

# Run with verbose output
npm run test:e2e -- --verbose

# Run with coverage
npm run test:e2e -- --coverage
```

## Test Data Management

### Automatic Cleanup

The E2E tests include automatic cleanup mechanisms:

```typescript
// Before all tests
beforeAll(async () => {
  // Clean up any existing test data
  await cleanupTestData();
});

// After all tests
afterAll(async () => {
  // Clean up test data created during tests
  await cleanupTestData();
  await app.close();
});
```

### Test Data Isolation

- Each test uses unique usernames/emails to avoid conflicts
- Test data is cleaned up between test runs
- Redis keys are cleared after tests

## Key Differences from Unit Tests

| Aspect | Unit Tests | E2E Tests |
|--------|------------|-----------|
| **Scope** | Individual functions/methods | Complete HTTP request flow |
| **Dependencies** | Mocked | Real (database, Redis, etc.) |
| **Speed** | Fast | Slower (real I/O) |
| **Isolation** | High | Lower (shared resources) |
| **Coverage** | Business logic | Integration points |
| **Setup** | Simple mocks | Database/Redis setup |

## Best Practices

### 1. **Test Independence**
- Each test should be independent
- Clean up data between tests
- Use unique identifiers for test data

### 2. **Realistic Test Data**
- Use realistic but test-specific data
- Avoid hardcoded IDs
- Test with various data scenarios

### 3. **Error Scenarios**
- Test both success and failure paths
- Verify correct error messages
- Test edge cases and invalid inputs

### 4. **Database State**
- Verify data is actually persisted
- Check database state after operations
- Test data integrity

### 5. **Performance Considerations**
- E2E tests are slower than unit tests
- Run them in CI/CD pipeline
- Consider parallel execution for large test suites

## Debugging E2E Tests

### 1. **Database Inspection**
```sql
-- Check test users
SELECT * FROM Users WHERE username LIKE '%e2e%';

-- Check Redis keys
redis-cli KEYS "refresh:*"
```

### 2. **Logging**
```typescript
// Add console.log for debugging
console.log('Response:', res.body);
console.log('Status:', res.status);
```

### 3. **Test Isolation**
```typescript
// Use unique test data
const testUser = {
  username: `testuser_${Date.now()}`,
  email: `test_${Date.now()}@example.com`,
  // ...
};
```

## Common Issues

### 1. **Database Connection**
- Ensure test database exists
- Check database credentials
- Verify database is accessible

### 2. **Redis Connection**
- Ensure Redis is running
- Check Redis connection settings
- Verify Redis port accessibility

### 3. **Environment Variables**
- Ensure all required env vars are set
- Check for typos in variable names
- Verify JWT secrets are configured

### 4. **Test Data Conflicts**
- Use unique identifiers
- Clean up data properly
- Avoid hardcoded test data

## Integration with CI/CD

```yaml
# Example GitHub Actions workflow
- name: Run E2E Tests
  run: |
    npm run test:e2e
  env:
    DB_HOST: localhost
    DB_USER: root
    DB_PASSWORD: ${{ secrets.DB_PASSWORD }}
    DB_NAME: instagram_test
    REDIS_HOST: localhost
    JWT_SECRET: ${{ secrets.JWT_SECRET }}
    JWT_REFRESH_SECRET: ${{ secrets.JWT_REFRESH_SECRET }}
```

## Next Steps

1. **Add More Test Scenarios**
   - File upload tests
   - Complex business logic flows
   - Performance tests

2. **Test Data Factories**
   - Create reusable test data generators
   - Implement test data builders

3. **Visual Testing**
   - Add screenshot testing
   - Implement visual regression tests

4. **Load Testing**
   - Add performance benchmarks
   - Test concurrent user scenarios 