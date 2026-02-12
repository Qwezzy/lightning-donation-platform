# Design Document: Flash Aid Lightning Integration

## Overview

Flash Aid is a Lightning Network-based disaster relief donation platform that enables instant, zero-fee Bitcoin payments from donors to recipients through an NGO-operated hub node. The system architecture follows a 3-node topology: Alice (Donor) → Bob (Hub/NGO) → Charlie (Recipient/Merchant), leveraging the Lightning Network's HTLC mechanism for trustless payment routing with cryptographic proof of delivery.

The design focuses on:
- Robust Lightning Network integration using LND's gRPC API
- Zero-fee payment routing through the NGO hub
- Cryptographic proof of payment via preimage receipts
- Persistent donation tracking and history
- RESTful API for frontend integration
- Real-time payment status updates
- Error handling and recovery mechanisms

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend Layer                          │
│  ┌──────────────────────────────────────────────────────────┤
│  │  Donor Interface (HTML/CSS/JavaScript)                   │
│  │  - Donation form (amount input, description)             │
│  │  - Invoice display (payment request, QR code)            │
│  │  - Payment status polling                                │
│  │  - Proof display (preimage)                              │
│  └──────────────────┬───────────────────────────────────────┘
└───────────────────────┼─────────────────────────────────────┘
                        │
                        │ HTTP/JSON (REST API)
                        │
┌───────────────────────┼─────────────────────────────────────┐
│                       │      Backend API Layer              │
│  ┌────────────────────▼─────────────────────────────────┐   │
│  │         Express.js REST API Server                   │   │
│  │  POST /api/invoice    - Generate invoice             │   │
│  │  GET  /api/status/:hash - Check payment status       │   │
│  │  GET  /api/node       - Get node info                │   │
│  └────────────────────┬─────────────────────────────────┘   │
│                       │                                      │
│  ┌────────────────────▼─────────────────────────────────┐   │
│  │         Business Logic Layer                         │   │
│  │  ┌──────────────┐  ┌─────────────────────┐          │   │
│  │  │ Invoice      │  │ Donation Tracker    │          │   │
│  │  │ Generator    │  │ (Repository)        │          │   │
│  │  └──────────────┘  └─────────────────────┘          │   │
│  │  ┌──────────────┐  ┌─────────────────────┐          │   │
│  │  │ Proof        │  │ Status Monitor      │          │   │
│  │  │ Manager      │  │                     │          │   │
│  │  └──────────────┘  └─────────────────────┘          │   │
│  └────────────────────┬─────────────────────────────────┘   │
│                       │                                      │
│  ┌────────────────────▼─────────────────────────────────┐   │
│  │      Lightning Network Client Layer                  │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │  LND gRPC Client (ln-service)                  │  │   │
│  │  │  - Authentication (Macaroon + TLS)             │  │   │
│  │  │  - Connection Management                       │  │   │
│  │  │  - Invoice Operations                          │  │   │
│  │  │  - Channel Queries                             │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  └────────────────────┬─────────────────────────────────┘   │
└───────────────────────┼─────────────────────────────────────┘
                        │ gRPC (port 10009)
┌───────────────────────▼─────────────────────────────────────┐
│                  Lightning Network Layer                     │
│  ┌──────────┐      ┌──────────┐      ┌──────────┐          │
│  │  Alice   │◄────►│   Bob    │◄────►│ Charlie  │          │
│  │ (Donor)  │      │  (Hub)   │      │(Recipient)│          │
│  │   LND    │      │   LND    │      │   LND    │          │
│  └──────────┘      └──────────┘      └──────────┘          │
│       │                  │                  │               │
└───────┼──────────────────┼──────────────────┼───────────────┘
        │                  │                  │
┌───────▼──────────────────▼──────────────────▼───────────────┐
│              Bitcoin Core (Regtest Mode)                     │
└──────────────────────────────────────────────────────────────┘
```

### Technology Stack

- **Backend**: Node.js with Express.js
- **Lightning Integration**: `ln-service` library for LND gRPC communication
- **Data Persistence**: JSON file storage (backend/data/donations.json)
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Lightning Network**: LND (Lightning Network Daemon)
- **Bitcoin Layer**: Bitcoin Core in Regtest mode
- **QR Code Generation**: `qrcode` library (frontend)

### Design Patterns

1. **Repository Pattern**: Donation tracking uses a repository pattern for data persistence
2. **Service Layer**: Business logic separated from API routes
3. **Client Wrapper**: Lightning client wraps LND gRPC complexity
4. **Error Boundary**: Comprehensive error handling at each layer
5. **Polling Pattern**: Frontend polls backend for payment status updates

## Components and Interfaces

### 1. Lightning Network Client

The Lightning client provides a clean abstraction over LND's gRPC API using the `ln-service` library.

**Interface:**
```javascript
class LightningClient {
  constructor(config: {
    lndSocket: string,      // e.g., 'localhost:10009'
    tlsCertPath: string,    // Path to tls.cert
    macaroonPath: string    // Path to admin.macaroon
  })
  
  async connect(): Promise<{ lnd: AuthenticatedLnd }>
  async getNodeInfo(): Promise<NodeInfo>
  async listChannels(): Promise<Channel[]>
  async createInvoice(amount: number, description: string): Promise<Invoice>
  async lookupInvoice(paymentHash: string): Promise<InvoiceStatus>
  async subscribeToInvoice(paymentHash: string): AsyncIterator<InvoiceUpdate>
}
```

**Key Responsibilities:**
- Establish and maintain gRPC connection to LND using `ln-service.authenticatedLndGrpc()`
- Authenticate using macaroon and TLS certificate
- Provide typed interfaces for LND operations
- Handle connection errors and retries
- Translate LND responses to application domain objects

**Implementation Notes:**
- Use `ln-service` library methods: `getWalletInfo()`, `getChannels()`, `createInvoice()`, `getInvoice()`
- Read TLS cert and macaroon from file system on initialization
- Cache authenticated LND object for reuse
- Validate macaroon and TLS cert paths exist before connecting
- Implement exponential backoff for connection retries (1s, 2s, 4s, max 30s)

### 2. Invoice Generator

Handles creation and management of Lightning invoices for recipients.

**Interface:**
```javascript
class InvoiceGenerator {
  constructor(lightningClient: LightningClient)
  
  async generateInvoice(params: {
    amount: number,           // Amount in satoshis
    description: string,      // Invoice description
    expirySeconds?: number    // Optional expiry (default 3600)
  }): Promise<{
    paymentRequest: string,   // BOLT11 invoice string
    paymentHash: string,      // Payment hash (hex)
    expiresAt: Date          // Expiration timestamp
  }>
  
  async checkInvoiceStatus(paymentHash: string): Promise<{
    settled: boolean,
    preimage?: string,
    settledAt?: Date,
    expiresAt: Date
  }>
}
```

**Key Responsibilities:**
- Create Lightning invoices with specified amounts and descriptions
- Set appropriate expiry times (default 3600 seconds / 1 hour)
- Monitor invoice settlement status
- Extract preimage upon payment completion
- Validate invoice parameters (amount >= 1 satoshi)

**Implementation Notes:**
- Use `ln-service.createInvoice()` with parameters: `tokens` (amount), `description`, `expires_at`
- Minimum amount: 1 satoshi
- Maximum amount: channel capacity limit (validate before creation)
- Default expiry: 3600 seconds (1 hour)
- Return payment hash in hex format for tracking
- Use `ln-service.getInvoice()` to check settlement status

### 3. Donation Tracker

Manages donation records and persistent storage using the repository pattern.

**Interface:**
```javascript
class DonationTracker {
  constructor(storageFilePath: string)
  
  async createDonation(params: {
    amount: number,
    paymentHash: string,
    description: string,
    paymentRequest: string
  }): Promise<Donation>
  
  async updateDonationStatus(
    paymentHash: string,
    status: 'pending' | 'completed' | 'expired' | 'failed',
    metadata?: { preimage?: string, error?: string, completedAt?: Date }
  ): Promise<void>
  
  async getDonationByHash(paymentHash: string): Promise<Donation | null>
  
  async getAllDonations(): Promise<Donation[]>
  
  async loadFromDisk(): Promise<void>
  async saveToDisk(): Promise<void>
}
```

**Key Responsibilities:**
- Create donation records with initial "pending" status
- Update donation status as payments progress
- Store preimage for completed donations
- Persist donations to JSON file atomically
- Load donations on system startup
- Query donations by payment hash

**Implementation Notes:**
- Use atomic file writes with temp file + rename to prevent corruption
- Implement in-memory Map for fast lookups by payment hash
- Flush to disk after every update
- Handle concurrent access with async locks
- Validate donation data before persistence
- Create data directory if it doesn't exist
- Generate UUID for each donation record

### 4. Proof Manager

Manages cryptographic proof of payment delivery.

**Interface:**
```javascript
class ProofManager {
  constructor(donationTracker: DonationTracker)
  
  async storeProof(params: {
    paymentHash: string,
    preimage: string,
    completedAt: Date
  }): Promise<void>
  
  async getProof(paymentHash: string): Promise<{
    preimage: string,
    paymentHash: string,
    verified: boolean,
    donation: Donation
  }>
  
  verifyProof(paymentHash: string, preimage: string): boolean
}
```

**Key Responsibilities:**
- Store preimage receipts for completed payments
- Verify preimage hashes to payment hash using SHA256
- Associate proofs with donation records
- Provide proof retrieval for donors

**Implementation Notes:**
- Verify preimage using: `SHA256(Buffer.from(preimage, 'hex')).toString('hex') === paymentHash`
- Store proof in donation record via DonationTracker
- Validate proof integrity on retrieval
- Return full donation context with proof
- Use Node.js `crypto` module for SHA256 hashing

### 5. Status Monitor

Monitors invoice payment status and provides real-time updates.

**Interface:**
```javascript
class StatusMonitor {
  constructor(
    lightningClient: LightningClient,
    donationTracker: DonationTracker,
    proofManager: ProofManager
  )
  
  async checkPaymentStatus(paymentHash: string): Promise<{
    status: 'pending' | 'completed' | 'expired' | 'failed',
    preimage?: string,
    donation: Donation
  }>
  
  async startMonitoring(paymentHash: string): Promise<void>
  async stopMonitoring(paymentHash: string): Promise<void>
}
```

**Key Responsibilities:**
- Check invoice settlement status via Lightning client
- Update donation records when payment settles
- Store preimage when payment completes
- Handle invoice expiration
- Provide status for frontend polling

**Implementation Notes:**
- Use `ln-service.getInvoice()` to check current status
- Compare current time with invoice expiry to detect expiration
- When settled, extract preimage and update donation via ProofManager
- Cache status checks to avoid excessive LND queries (max 1 check per second per invoice)
- Clean up monitoring state after settlement or expiration

### 6. REST API Layer

Express.js API providing HTTP endpoints for frontend integration.

**Endpoints:**

```javascript
POST /api/invoice
  Body: { 
    amount: number,        // Amount in satoshis (min 1)
    description: string    // Invoice description
  }
  Response: { 
    paymentRequest: string,  // BOLT11 invoice
    paymentHash: string,     // Payment hash (hex)
    expiresAt: string,       // ISO timestamp
    amount: number           // Amount in satoshis
  }
  Status: 200 OK, 400 Bad Request, 500 Internal Server Error

GET /api/status/:paymentHash
  Response: { 
    status: 'pending' | 'completed' | 'expired' | 'failed',
    preimage?: string,       // Only if completed
    donation: {
      id: string,
      amount: number,
      description: string,
      createdAt: string,
      completedAt?: string
    }
  }
  Status: 200 OK, 404 Not Found, 500 Internal Server Error

GET /api/node
  Response: { 
    publicKey: string,
    alias: string,
    numChannels: number,
    numActiveChannels: number,
    synced: boolean
  }
  Status: 200 OK, 500 Internal Server Error
```

**Key Responsibilities:**
- Validate request parameters (amount >= 1, description non-empty)
- Route requests to appropriate service layer
- Handle errors and return appropriate HTTP status codes
- Format responses as JSON
- Implement CORS for frontend access
- Log all requests and errors

**Implementation Notes:**
- Use Express middleware for JSON parsing and CORS
- Validate inputs with custom middleware
- Return 400 for validation errors with descriptive messages
- Return 500 for internal errors with generic messages (log details)
- Return 404 for not found resources
- Use async/await with try-catch for error handling
- Set appropriate Content-Type headers

### 7. Frontend Donation Interface

Web interface for donors to create and pay invoices.

**Components:**

```javascript
// Main application state
const app = {
  currentInvoice: null,
  pollingInterval: null,
  
  // Generate invoice
  async createInvoice(amount, description): Promise<void>
  
  // Poll payment status
  async pollPaymentStatus(paymentHash): Promise<void>
  
  // Display QR code
  displayQRCode(paymentRequest): void
  
  // Update UI with status
  updateStatus(status, data): void
}
```

**Key Responsibilities:**
- Capture donation amount and description from form
- Request invoice from backend API
- Display payment request string and QR code
- Poll payment status every 2 seconds
- Display preimage when payment completes
- Show error messages for failures
- Provide mobile-responsive UI

**Implementation Notes:**
- Use `fetch()` API for HTTP requests
- Use `qrcode` library to generate QR codes on canvas element
- Implement polling with `setInterval()` (2 second intervals)
- Stop polling when payment settles or expires
- Display loading indicators during API calls
- Validate amount input (positive integer, min 1 satoshi)
- Clear previous invoice state before creating new one
- Use CSS Grid/Flexbox for responsive layout

## Data Models

### Donation Record

```javascript
{
  id: string,              // UUID v4
  amount: number,          // Amount in satoshis
  description: string,     // Payment description
  paymentHash: string,     // Lightning payment hash (hex)
  paymentRequest: string,  // BOLT11 invoice string
  preimage: string | null, // Proof of payment (null until settled)
  status: 'pending' | 'completed' | 'expired' | 'failed',
  error: string | null,    // Error message if failed
  createdAt: string,       // ISO 8601 timestamp
  completedAt: string | null, // ISO 8601 timestamp when settled
  expiresAt: string        // ISO 8601 timestamp for expiration
}
```

### Invoice

```javascript
{
  paymentRequest: string,  // BOLT11 invoice string
  paymentHash: string,     // Payment hash (hex)
  amount: number,          // Amount in satoshis
  description: string,     // Invoice description
  expiresAt: Date,         // Expiration timestamp
  settled: boolean,        // Payment status
  preimage: string | null  // Preimage if settled (hex)
}
```

### Channel

```javascript
{
  id: string,              // Channel ID
  capacity: number,        // Total capacity in satoshis
  localBalance: number,    // Local balance in satoshis
  remoteBalance: number,   // Remote balance in satoshis
  isActive: boolean,       // Channel active status
  remotePubkey: string,    // Remote node public key
  baseFee: number,         // Base fee in millisatoshis
  feeRate: number          // Fee rate in parts per million
}
```

### Node Info

```javascript
{
  publicKey: string,       // Node public key (hex)
  alias: string,           // Node alias
  numChannels: number,     // Total number of channels
  numActiveChannels: number, // Number of active channels
  synced: boolean          // Blockchain sync status
}
```

### API Error Response

```javascript
{
  error: string,           // Error message
  details?: string         // Optional detailed error information
}
```

## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: Lightning Client Connection with Valid Credentials

*For any* valid TLS certificate and macaroon credentials, when the Lightning client attempts to connect to LND, the connection SHALL succeed and return an authenticated LND object.

**Validates: Requirements 1.1**

### Property 2: Node Information Completeness

*For any* successful node information query, the returned data SHALL contain all required fields: public key, alias, number of channels, number of active channels, and sync status.

**Validates: Requirements 1.5**

### Property 3: Connection Error Descriptiveness

*For any* connection failure (invalid credentials, unreachable host, invalid certificate), the error message SHALL be non-empty and contain relevant information about the failure cause.

**Validates: Requirements 1.3**

### Property 4: Channel Query Completeness

*For any* channel query result, each returned channel SHALL contain all required fields: channel ID, capacity, local balance, remote balance, active status, remote public key, base fee, and fee rate.

**Validates: Requirements 2.1**

### Property 5: Zero-Fee Channel Verification

*For any* channel policy data, the system SHALL correctly identify whether the channel has zero fees (base fee = 0 AND fee rate = 0).

**Validates: Requirements 2.5, 4.7, 11.2, 11.5, 12.2**

### Property 6: Insufficient Capacity Error Detection

*For any* payment amount that exceeds available channel capacity, the system SHALL return an error message containing "insufficient" or "capacity" keywords.

**Validates: Requirements 2.6, 10.3**

### Property 7: Invoice Creation with Amount

*For any* valid amount (>= 1 satoshi, <= channel capacity) and description, the invoice generator SHALL create an invoice with the specified amount.

**Validates: Requirements 3.1**

### Property 8: Invoice Description Inclusion

*For any* description string provided during invoice creation, the created invoice SHALL contain that description.

**Validates: Requirements 3.2**

### Property 9: Invoice Response Completeness

*For any* successful invoice creation, the response SHALL contain all required fields: payment request string, payment hash, expiration time, and amount.

**Validates: Requirements 3.3**

### Property 10: Invoice Expiration Minimum Duration

*For any* created invoice, the expiration time SHALL be at least 3600 seconds (1 hour) in the future from creation time.

**Validates: Requirements 3.4**

### Property 11: Invoice Decoding Correctness

*For any* valid BOLT11 invoice string, decoding SHALL correctly extract the payment hash, amount, and destination information.

**Validates: Requirements 4.1**

### Property 12: Preimage-to-Payment-Hash Verification (Round-Trip)

*For any* preimage and payment hash pair, the verification SHALL return true if and only if SHA256(preimage) equals the payment hash.

**Validates: Requirements 5.3**

### Property 13: Proof Storage and Retrieval (Round-Trip)

*For any* payment hash and preimage, after storing the proof, retrieving by payment hash SHALL return the same preimage with verified=true.

**Validates: Requirements 5.1, 5.2**

### Property 14: Proof Record Completeness

*For any* stored proof, the associated donation record SHALL contain all required fields: payment hash, preimage, amount, timestamp, and status.

**Validates: Requirements 5.4**

### Property 15: Donation Initial Status

*For any* newly created donation record, the status SHALL be "pending".

**Validates: Requirements 6.1**

### Property 16: Donation Completion Update

*For any* donation record updated with completion data (preimage, completed timestamp), the status SHALL be "completed" and the preimage SHALL be stored.

**Validates: Requirements 6.2**

### Property 17: Donation Failure Update

*For any* donation record updated with failure data (error message), the status SHALL be "failed" and the error SHALL be stored.

**Validates: Requirements 6.3**

### Property 18: Donation Record Completeness

*For any* created donation record, it SHALL contain all required fields: id (UUID), amount, description, payment hash, payment request, status, created timestamp, and expiration timestamp.

**Validates: Requirements 6.4**

### Property 19: Donation History Filtering

*For any* set of donation records and filter criteria (status, date range), the query results SHALL contain only donations that match all specified filter criteria.

**Validates: Requirements 6.5**

### Property 20: Donation Persistence Round-Trip

*For any* set of donation records, after saving to disk and loading from disk, all donation records SHALL be present with identical data (id, amount, payment hash, status, preimage, timestamps).

**Validates: Requirements 5.5, 6.6, 6.7, 13.1, 13.2, 13.3**

### Property 21: API Success Response Format

*For any* successful API request, the response SHALL be valid JSON with HTTP status code in the 2xx range.

**Validates: Requirements 7.6**

### Property 22: API Error Response Format

*For any* failed API request, the response SHALL have HTTP status code in the 4xx or 5xx range and contain a JSON object with an "error" field containing a non-empty message.

**Validates: Requirements 7.7**

### Property 23: API Input Validation

*For any* invalid input parameters (negative amounts, empty descriptions, invalid payment hashes), the API SHALL reject the request before processing and return a 400 Bad Request status.

**Validates: Requirements 7.8, 7.9, 10.4**

### Property 24: Connection Retry Exponential Backoff

*For any* sequence of connection failures, the retry delays SHALL follow exponential backoff pattern (1s, 2s, 4s, 8s, ..., max 30s).

**Validates: Requirements 10.1**

### Property 25: Error Message Descriptiveness

*For any* validation error or system error, the error message SHALL be non-empty and contain specific information about what went wrong.

**Validates: Requirements 10.4**

### Property 26: Generic Error User Response

*For any* unexpected internal error, the user-facing error message SHALL be generic (not exposing internal details) while detailed error information is logged.

**Validates: Requirements 10.5**

### Property 27: Crash Recovery State Restoration

*For any* system state (donations, proofs) saved before crash, after restart and loading from disk, the state SHALL be identical to the pre-crash state.

**Validates: Requirements 10.7**

### Property 28: Non-Zero Fee Rejection

*For any* payment result with non-zero fees, the system SHALL reject the payment and return an error indicating fee policy violation.

**Validates: Requirements 11.3**

### Property 29: Micropayment Amount Validation

*For any* invoice amount, the system SHALL accept amounts >= 1 satoshi and <= channel capacity, and reject amounts outside this range.

**Validates: Requirements 12.1, 12.3, 12.5**

### Property 30: Atomic File Write Integrity

*For any* concurrent donation record updates, after all writes complete, the JSON file SHALL be valid (parseable) and contain all donation records without corruption.

**Validates: Requirements 13.4**

## Error Handling

### Error Categories

1. **Connection Errors**
   - LND unreachable
   - Invalid credentials (macaroon/TLS cert)
   - Network timeouts
   - Response: Retry with exponential backoff, return descriptive error after max retries

2. **Validation Errors**
   - Invalid amount (< 1 satoshi or > capacity)
   - Empty description
   - Invalid payment hash format
   - Response: Return 400 Bad Request with validation details

3. **Lightning Network Errors**
   - Insufficient channel capacity
   - Invoice expired
   - Route not found
   - Payment timeout
   - Response: Return specific error message, ensure no funds lost

4. **Persistence Errors**
   - File write failure
   - Corrupted JSON data
   - Directory creation failure
   - Response: Log error, attempt recovery, return error to user

5. **Unexpected Errors**
   - Uncaught exceptions
   - LND internal errors
   - Response: Log full error details, return generic error to user

### Error Response Format

All API errors follow this format:
```javascript
{
  error: string,      // User-facing error message
  details?: string    // Optional detailed information (only for 4xx errors)
}
```

### Error Handling Strategies

1. **Retry with Backoff**: Connection failures retry with exponential backoff (1s, 2s, 4s, 8s, 16s, 30s max)
2. **Fail Fast**: Validation errors return immediately without retries
3. **Graceful Degradation**: If persistence fails, continue operation but log error
4. **Fund Safety**: Lightning Network protocol (HTLCs) ensures no funds lost on errors
5. **User Feedback**: All errors provide clear, actionable messages to users

## Testing Strategy

### Dual Testing Approach

The testing strategy employs both unit tests and property-based tests as complementary approaches:

- **Unit Tests**: Verify specific examples, edge cases, and error conditions
- **Property Tests**: Verify universal properties across all inputs

Together, these provide comprehensive coverage where unit tests catch concrete bugs and property tests verify general correctness.

### Property-Based Testing

**Library**: Use `fast-check` for JavaScript/Node.js property-based testing

**Configuration**:
- Minimum 100 iterations per property test (due to randomization)
- Each property test references its design document property
- Tag format: `// Feature: flash-aid-lightning-integration, Property N: [property title]`

**Property Test Implementation**:
- Each correctness property (1-30) SHALL be implemented as a single property-based test
- Tests generate random valid inputs and verify the property holds
- Tests use appropriate generators (amounts, strings, timestamps, etc.)

**Example Property Test Structure**:
```javascript
// Feature: flash-aid-lightning-integration, Property 12: Preimage-to-Payment-Hash Verification
test('preimage verification round-trip', () => {
  fc.assert(
    fc.property(
      fc.uint8Array({ minLength: 32, maxLength: 32 }), // Random preimage
      (preimage) => {
        const paymentHash = sha256(preimage);
        const verified = proofManager.verifyProof(paymentHash, preimage);
        return verified === true;
      }
    ),
    { numRuns: 100 }
  );
});
```

### Unit Testing

**Focus Areas**:
- Specific examples from requirements (e.g., 1 satoshi micropayment)
- Edge cases (empty strings, boundary values, expiration timing)
- Error conditions (invalid inputs, connection failures)
- Integration points (API endpoints, LND client calls)

**Unit Test Balance**:
- Avoid writing too many unit tests for scenarios covered by property tests
- Focus on concrete examples that demonstrate correct behavior
- Test integration between components
- Verify error handling for specific failure modes

**Example Unit Test Structure**:
```javascript
describe('Invoice Generator', () => {
  test('creates invoice with 1 satoshi (micropayment edge case)', async () => {
    const invoice = await invoiceGenerator.generateInvoice({
      amount: 1,
      description: 'Test micropayment'
    });
    
    expect(invoice.amount).toBe(1);
    expect(invoice.paymentRequest).toBeDefined();
  });
  
  test('rejects invoice with 0 satoshi amount', async () => {
    await expect(
      invoiceGenerator.generateInvoice({ amount: 0, description: 'Test' })
    ).rejects.toThrow('Amount must be at least 1 satoshi');
  });
});
```

### Integration Testing

**Scope**:
- End-to-end API flows (create invoice → poll status → verify proof)
- LND integration (requires running LND nodes in regtest)
- Frontend-backend integration (requires test server)

**Approach**:
- Use test LND nodes in regtest mode
- Mock LND responses for unit tests
- Use real LND for integration tests
- Test complete donation flow from creation to settlement

### Test Coverage Goals

- **Property Tests**: Cover all 30 correctness properties
- **Unit Tests**: Cover edge cases, error conditions, and specific examples
- **Integration Tests**: Cover critical user flows (donation creation, payment, proof retrieval)
- **Code Coverage**: Aim for >80% line coverage, >90% branch coverage
