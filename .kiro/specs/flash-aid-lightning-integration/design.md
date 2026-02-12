# Design Document: Flash Aid Lightning Integration

## Overview

Flash Aid is a Lightning Network-based disaster relief donation platform that enables instant, zero-fee Bitcoin payments from donors to recipients through an NGO-operated hub node. The system architecture follows a 3-node topology: Alice (Donor) → Bob (Hub/NGO) → Charlie (Recipient/Merchant), leveraging the Lightning Network's HTLC mechanism for trustless payment routing with cryptographic proof of delivery.

The design focuses on:
- Robust Lightning Network integration using LND's gRPC API
- Zero-fee payment routing through the NGO hub
- Cryptographic proof of payment via preimage receipts
- Persistent donation tracking and history
- RESTful API for frontend integration
- Error handling and recovery mechanisms

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend Layer                          │
│  ┌──────────────────┐         ┌──────────────────┐         │
│  │  Donor Interface │         │ Recipient Interface│        │
│  │   (HTML/JS)      │         │    (HTML/JS)      │         │
│  └────────┬─────────┘         └─────────┬────────┘         │
└───────────┼───────────────────────────────┼─────────────────┘
            │                               │
            │         HTTP/JSON             │
            │                               │
┌───────────┼───────────────────────────────┼─────────────────┐
│           │      Backend API Layer        │                 │
│  ┌────────▼───────────────────────────────▼────────┐        │
│  │         Express.js REST API                     │        │
│  │  /invoice  /donate  /history  /proof  /status  │        │
│  └────────┬────────────────────────────────────────┘        │
│           │                                                  │
│  ┌────────▼──────────────────────────────────────┐          │
│  │         Business Logic Layer                  │          │
│  │  ┌──────────────┐  ┌─────────────────────┐   │          │
│  │  │ Invoice      │  │ Payment Router      │   │          │
│  │  │ Generator    │  │                     │   │          │
│  │  └──────────────┘  └─────────────────────┘   │          │
│  │  ┌──────────────┐  ┌─────────────────────┐   │          │
│  │  │ Donation     │  │ Proof Manager       │   │          │
│  │  │ Tracker      │  │                     │   │          │
│  │  └──────────────┘  └─────────────────────┘   │          │
│  └────────┬──────────────────────────────────────┘          │
│           │                                                  │
│  ┌────────▼──────────────────────────────────────┐          │
│  │      Lightning Network Client Layer           │          │
│  │  ┌──────────────────────────────────────────┐ │          │
│  │  │  LND gRPC Client (ln-service/lnd-grpc)  │ │          │
│  │  │  - Authentication (Macaroon + TLS)      │ │          │
│  │  │  - Connection Management                │ │          │
│  │  └──────────────────────────────────────────┘ │          │
│  └────────┬──────────────────────────────────────┘          │
└───────────┼─────────────────────────────────────────────────┘
            │ gRPC
┌───────────▼─────────────────────────────────────────────────┐
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
- **Lightning Integration**: `ln-service` or `@lightningnetworklabs/lnd-grpc` for LND gRPC communication
- **Data Persistence**: JSON file storage (donations.json)
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Lightning Network**: LND (Lightning Network Daemon)
- **Bitcoin Layer**: Bitcoin Core in Regtest mode

### Design Patterns

1. **Repository Pattern**: Donation tracking uses a repository pattern for data persistence
2. **Service Layer**: Business logic separated from API routes
3. **Client Wrapper**: Lightning client wraps LND gRPC complexity
4. **Error Boundary**: Comprehensive error handling at each layer

## Components and Interfaces

### 1. Lightning Network Client

The Lightning client provides a clean abstraction over LND's gRPC API.

**Interface:**
```javascript
class LightningClient {
  constructor(config: {
    lndHost: string,
    lndPort: number,
    tlsCertPath: string,
    macaroonPath: string
  })
  
  async connect(): Promise<void>
  async getNodeInfo(): Promise<NodeInfo>
  async listChannels(): Promise<Channel[]>
  async createInvoice(amount: number, description: string): Promise<Invoice>
  async payInvoice(paymentRequest: string): Promise<PaymentResult>
  async decodeInvoice(paymentRequest: string): Promise<DecodedInvoice>
  async lookupInvoice(paymentHash: string): Promise<InvoiceStatus>
  async getChannelPolicy(channelId: string): Promise<ChannelPolicy>
}
```

**Key Responsibilities:**
- Establish and maintain gRPC connection to LND
- Authenticate using macaroon and TLS certificate
- Provide typed interfaces for LND operations
- Handle connection errors and retries
- Translate LND responses to application domain objects

**Implementation Notes:**
- Use `ln-service` library for simplified LND interaction
- Implement connection pooling for concurrent requests
- Cache node info to reduce repeated queries
- Validate macaroon and TLS cert on initialization

### 2. Invoice Generator

Handles creation and management of Lightning invoices for recipients.

**Interface:**
```javascript
class InvoiceGenerator {
  constructor(lightningClient: LightningClient)
  
  async generateInvoice(params: {
    amount: number,
    description: string,
    expirySeconds?: number
  }): Promise<{
    paymentRequest: string,
    paymentHash: string,
    expiresAt: Date
  }>
  
  async checkInvoiceStatus(paymentHash: string): Promise<{
    settled: boolean,
    preimage?: string,
    settledAt?: Date
  }>
}
```

**Key Responsibilities:**
- Create Lightning invoices with specified amounts and descriptions
- Set appropriate expiry times (default 1 hour)
- Monitor invoice settlement status
- Extract preimage upon payment completion
- Validate invoice parameters

**Implementation Notes:**
- Minimum amount: 1 satoshi
- Maximum amount: channel capacity limit
- Default expiry: 3600 seconds (1 hour)
- Store invoice metadata for tracking

### 3. Payment Router

Executes Lightning payments from donors to recipients.

**Interface:**
```javascript
class PaymentRouter {
  constructor(lightningClient: LightningClient)
  
  async routePayment(paymentRequest: string): Promise<{
    success: boolean,
    preimage?: string,
    paymentHash: string,
    feePaid: number,
    route?: RouteHop[],
    error?: string
  }>
  
  async findRoute(destination: string, amount: number): Promise<Route>
  async verifyZeroFees(route: Route): Promise<boolean>
}
```

**Key Responsibilities:**
- Decode payment requests to extract destination and amount
- Find optimal route through the Lightning Network
- Execute payments using HTLC mechanism
- Verify zero-fee routing through hub node
- Return preimage as proof of payment
- Handle payment failures and timeouts

**Implementation Notes:**
- Use LND's `sendPaymentV2` for streaming payment updates
- Verify route includes hub node (Bob)
- Confirm total fees equal zero
- Implement timeout handling (default 60 seconds)
- Ensure atomic payment execution (all-or-nothing)

### 4. Donation Tracker

Manages donation records and persistent storage.

**Interface:**
```javascript
class DonationTracker {
  constructor(storageFilePath: string)
  
  async createDonation(params: {
    donorId: string,
    recipientId: string,
    amount: number,
    paymentHash: string,
    description: string
  }): Promise<Donation>
  
  async updateDonationStatus(
    paymentHash: string,
    status: 'pending' | 'completed' | 'failed',
    metadata?: { preimage?: string, error?: string }
  ): Promise<void>
  
  async getDonationHistory(filters?: {
    donorId?: string,
    recipientId?: string,
    status?: string,
    startDate?: Date,
    endDate?: Date
  }): Promise<Donation[]>
  
  async getDonationByHash(paymentHash: string): Promise<Donation | null>
  
  async loadFromDisk(): Promise<void>
  async saveToDisk(): Promise<void>
}
```

**Key Responsibilities:**
- Create donation records with initial "pending" status
- Update donation status as payments progress
- Store preimage for completed donations
- Persist donations to JSON file
- Load donations on system startup
- Query donation history with filters

**Implementation Notes:**
- Use atomic file writes to prevent corruption
- Implement in-memory cache for fast queries
- Periodically flush to disk (every update)
- Handle concurrent access with locks
- Validate donation data before persistence

### 5. Proof Manager

Manages cryptographic proof of payment delivery.

**Interface:**
```javascript
class ProofManager {
  constructor(donationTracker: DonationTracker)
  
  async storeProof(params: {
    paymentHash: string,
    preimage: string,
    amount: number,
    timestamp: Date
  }): Promise<void>
  
  async getProof(paymentHash: string): Promise<{
    preimage: string,
    paymentHash: string,
    verified: boolean,
    donation: Donation
  }>
  
  async verifyProof(paymentHash: string, preimage: string): Promise<boolean>
}
```

**Key Responsibilities:**
- Store preimage receipts for completed payments
- Verify preimage hashes to payment hash (SHA256)
- Associate proofs with donation records
- Provide proof retrieval for donors

**Implementation Notes:**
- Verify preimage using: `SHA256(preimage) === paymentHash`
- Store proof in donation record
- Validate proof integrity on retrieval
- Return full donation context with proof

### 6. REST API Layer

Express.js API providing HTTP endpoints for frontend integration.

**Endpoints:**

```
POST /api/invoice
  Body: { amount: number, description: string }
  Response: { paymentRequest: string, paymentHash: string, expiresAt: string }

POST /api/donate
  Body: { paymentRequest: string, donorId: string }
  Response: { success: boolean, preimage?: string, error?: string }

GET /api/history
  Query: { donorId?, recipientId?, status?, startDate?, endDate? }
  Response: { donations: Donation[] }

GET /api/proof/:paymentHash
  Response: { preimage: string, verified: boolean, donation: Donation }

GET /api/status
  Response: { nodeInfo: NodeInfo, channels: Channel[] }
```

**Key Responsibilities:**
- Validate request parameters
- Route requests to appropriate service layer
- Handle errors and return appropriate HTTP status codes
- Format responses as JSON
- Implement CORS for frontend access

**Implementation Notes:**
- Use Express middleware for validation
- Return 400 for validation errors
- Return 500 for internal errors
- Return 404 for not found resources
- Log all requests and errors

## Data Models

### Donation Record

```javascript
{
  id: string,              // UUID
  donorId: string,         // Donor identifier
  recipientId: string,     // Recipient identifier
  amount: number,          // Amount in satoshis
  description: string,     // Payment description
  paymentHash: string,     // Lightning payment hash
  preimage: string | null, // Proof of payment (null until settled)
  status: 'pending' | 'completed' | 'failed',
  error: string | null,    // Error message if failed
  createdAt: string,       // ISO timestamp
  completedAt: string | null // ISO timestamp when settled
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
  preimage: string | null  // Preimage if settled
}
```

### Channel

```javascript
{
  channelId: string,       // Channel ID
  capacity: number,        // Total capacity in satoshis
  localBalance: number,    // Local balance in satoshis
  remoteBalance: number,   // Remote balance in satoshis
  active: boolean,         // Channel active status
  remotePubkey: string,    // Remote node public key
  baseFee: number,         // Base fee in millisatoshis
  feeRate: number          // Fee rate in parts per million
}
```

### Payment Result

```javascript
{
  success: boolean,
  preimage: string | null,
  paymentHash: string,
  feePaid: number,         // Should always be 0
  route: RouteHop[] | null,
  error: string | null
}
```

### Node Info

```javascript
{
  publicKey: string,
  alias: string,
  numChannels: number,
  numActiveChannels: number,
  synced: boolean
}
```

