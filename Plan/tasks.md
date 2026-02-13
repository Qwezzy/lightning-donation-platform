# Implementation Plan: Flash Aid Lightning Integration

## Overview

This implementation plan breaks down the Flash Aid Lightning Network donation platform into discrete coding tasks. The approach follows a bottom-up strategy: first establishing the Lightning Network client layer, then building business logic components, followed by the API layer, and finally the frontend interface. Each task builds incrementally, with checkpoints to ensure stability before proceeding.

The implementation uses Node.js with Express.js for the backend, the `ln-service` library for Lightning Network integration, and vanilla JavaScript for the frontend.

## Tasks

- [x] 1. Set up project structure and dependencies
  - Create backend directory structure (routes/, config/, data/)
  - Initialize package.json with dependencies: express, ln-service, uuid, cors
  - Create .gitignore for node_modules and sensitive files
  - Set up basic Express server skeleton in backend/server.js
  - _Requirements: 7.1, 7.6_

- [ ] 2. Implement Lightning Network Client
  - [x] 2.1 Create LightningClient class in backend/lightning.js
    - Implement constructor accepting lndSocket, tlsCertPath, macaroonPath
    - Implement connect() method using ln-service.authenticatedLndGrpc()
    - Read TLS cert and macaroon from file system
    - Store authenticated LND object for reuse
    - _Requirements: 1.1, 1.2_
  
  - [ ]* 2.2 Write property test for Lightning client connection
    - **Property 1: Lightning Client Connection with Valid Credentials**
    - **Validates: Requirements 1.1**
  
  - [x] 2.3 Implement getNodeInfo() method
    - Use ln-service.getWalletInfo() to query node information
    - Return object with publicKey, alias, numChannels, numActiveChannels, synced
    - _Requirements: 1.5_
  
  - [ ]* 2.4 Write property test for node information completeness
    - **Property 2: Node Information Completeness**
    - **Validates: Requirements 1.5**
  
  - [x] 2.5 Implement error handling for connection failures
    - Add try-catch blocks around connection attempts
    - Return descriptive error messages for invalid credentials, unreachable host
    - Implement exponential backoff retry logic (1s, 2s, 4s, 8s, 16s, 30s max)
    - _Requirements: 1.3, 10.1_
  
  - [ ]* 2.6 Write property tests for connection errors and retry backoff
    - **Property 3: Connection Error Descriptiveness**
    - **Property 24: Connection Retry Exponential Backoff**
    - **Validates: Requirements 1.3, 10.1**
  
  - [x] 2.7 Implement listChannels() method
    - Use ln-service.getChannels() to query all channels
    - Map response to Channel objects with required fields
    - _Requirements: 2.1_
  
  - [ ]* 2.8 Write property test for channel query completeness
    - **Property 4: Channel Query Completeness**
    - **Validates: Requirements 2.1**

- [x] 3. Checkpoint - Verify Lightning client connectivity
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement Invoice Generator
  - [x] 4.1 Create InvoiceGenerator class in backend/invoice-generator.js
    - Implement constructor accepting LightningClient instance
    - Implement generateInvoice() method using ln-service.createInvoice()
    - Validate amount >= 1 satoshi
    - Set default expiry to 3600 seconds
    - Return paymentRequest, paymentHash, expiresAt
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  
  - [ ]* 4.2 Write property tests for invoice generation
    - **Property 7: Invoice Creation with Amount**
    - **Property 8: Invoice Description Inclusion**
    - **Property 9: Invoice Response Completeness**
    - **Property 10: Invoice Expiration Minimum Duration**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
  
  - [x] 4.3 Implement checkInvoiceStatus() method
    - Use ln-service.getInvoice() to query invoice by payment hash
    - Return settled status, preimage (if settled), settledAt, expiresAt
    - Check if current time > expiresAt to detect expiration
    - _Requirements: 3.5, 3.6_
  
  - [ ]* 4.4 Write unit test for invoice expiration detection
    - Test that expired invoices are correctly identified
    - _Requirements: 3.5_
  
  - [x] 4.5 Add invoice decoding capability
    - Use ln-service.parsePaymentRequest() to decode BOLT11 invoices
    - Extract payment hash, amount, destination
    - _Requirements: 4.1_
  
  - [ ]* 4.6 Write property test for invoice decoding
    - **Property 11: Invoice Decoding Correctness**
    - **Validates: Requirements 4.1**

- [ ] 5. Implement Donation Tracker with Persistence
  - [x] 5.1 Create DonationTracker class in backend/donation-tracker.js
    - Implement constructor accepting storageFilePath
    - Initialize in-memory Map for donations (keyed by payment hash)
    - Import uuid library for generating donation IDs
    - _Requirements: 6.1, 6.4_
  
  - [x] 5.2 Implement createDonation() method
    - Generate UUID for donation ID
    - Create donation object with status "pending"
    - Store in memory Map
    - Call saveToDisk() to persist
    - Return created donation
    - _Requirements: 6.1, 6.4_
  
  - [ ]* 5.3 Write property test for donation initial status
    - **Property 15: Donation Initial Status**
    - **Property 18: Donation Record Completeness**
    - **Validates: Requirements 6.1, 6.4**
  
  - [x] 5.4 Implement updateDonationStatus() method
    - Find donation by payment hash
    - Update status and metadata (preimage, error, completedAt)
    - Call saveToDisk() to persist
    - _Requirements: 6.2, 6.3_
  
  - [ ]* 5.5 Write property tests for donation status updates
    - **Property 16: Donation Completion Update**
    - **Property 17: Donation Failure Update**
    - **Validates: Requirements 6.2, 6.3**
  
  - [x] 5.6 Implement persistence methods (saveToDisk, loadFromDisk)
    - saveToDisk: Convert Map to array, write to temp file, rename to target (atomic write)
    - loadFromDisk: Read JSON file, parse, populate Map
    - Create data directory if it doesn't exist
    - Handle corrupted JSON gracefully (log error, start with empty state)
    - _Requirements: 6.6, 6.7, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_
  
  - [ ]* 5.7 Write property test for persistence round-trip
    - **Property 20: Donation Persistence Round-Trip**
    - **Property 30: Atomic File Write Integrity**
    - **Validates: Requirements 6.6, 6.7, 13.1, 13.2, 13.3, 13.4**
  
  - [x] 5.8 Implement getDonationByHash() and getAllDonations() methods
    - getDonationByHash: Lookup in Map, return donation or null
    - getAllDonations: Convert Map values to array
    - _Requirements: 6.5_
  
  - [ ]* 5.9 Write unit test for donation queries
    - Test retrieval by payment hash
    - Test getting all donations
    - _Requirements: 6.5_

- [~] 6. Checkpoint - Verify donation tracking and persistence
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Implement Proof Manager
  - [x] 7.1 Create ProofManager class in backend/proof-manager.js
    - Implement constructor accepting DonationTracker instance
    - Import crypto module for SHA256 hashing
    - _Requirements: 5.1, 5.2, 5.3_
  
  - [x] 7.2 Implement verifyProof() method
    - Hash preimage using SHA256
    - Compare with payment hash
    - Return boolean indicating match
    - _Requirements: 5.3_
  
  - [ ]* 7.3 Write property test for preimage verification
    - **Property 12: Preimage-to-Payment-Hash Verification (Round-Trip)**
    - **Validates: Requirements 5.3**
  
  - [x] 7.4 Implement storeProof() method
    - Verify preimage hashes to payment hash
    - Update donation via DonationTracker with preimage and completedAt
    - Set status to "completed"
    - _Requirements: 5.1, 5.4_
  
  - [ ]* 7.5 Write property test for proof storage and retrieval
    - **Property 13: Proof Storage and Retrieval (Round-Trip)**
    - **Property 14: Proof Record Completeness**
    - **Validates: Requirements 5.1, 5.2, 5.4**
  
  - [x] 7.6 Implement getProof() method
    - Retrieve donation by payment hash
    - Extract preimage from donation
    - Verify proof integrity
    - Return proof object with verified flag
    - _Requirements: 5.2_

- [ ] 8. Implement Status Monitor
  - [x] 8.1 Create StatusMonitor class in backend/status-monitor.js
    - Implement constructor accepting LightningClient, DonationTracker, ProofManager
    - Add status check caching (max 1 check per second per invoice)
    - _Requirements: 9.6_
  
  - [x] 8.2 Implement checkPaymentStatus() method
    - Query invoice status via InvoiceGenerator
    - Check if invoice is settled (extract preimage)
    - Check if invoice is expired (compare timestamps)
    - If settled, call ProofManager.storeProof()
    - If expired, update donation status to "expired"
    - Return status and donation
    - _Requirements: 3.5, 3.6, 9.6_
  
  - [ ]* 8.3 Write unit tests for status monitoring
    - Test settled invoice detection
    - Test expired invoice detection
    - Test status caching
    - _Requirements: 3.5, 9.6_

- [ ] 9. Implement REST API endpoints
  - [~] 9.1 Create API routes in backend/routes/api.js
    - Set up Express router
    - Add JSON body parser middleware
    - Add CORS middleware
    - _Requirements: 7.6_
  
  - [~] 9.2 Implement POST /api/invoice endpoint
    - Validate request body (amount >= 1, description non-empty)
    - Call InvoiceGenerator.generateInvoice()
    - Call DonationTracker.createDonation()
    - Return invoice details (paymentRequest, paymentHash, expiresAt, amount)
    - Handle errors with appropriate status codes
    - _Requirements: 7.1, 7.8, 7.9_
  
  - [ ]* 9.3 Write property tests for API input validation
    - **Property 23: API Input Validation**
    - **Property 29: Micropayment Amount Validation**
    - **Validates: Requirements 7.8, 7.9, 12.1, 12.3, 12.5**
  
  - [~] 9.4 Implement GET /api/status/:paymentHash endpoint
    - Validate payment hash format (64 hex characters)
    - Call StatusMonitor.checkPaymentStatus()
    - Return status, preimage (if completed), donation details
    - Return 404 if donation not found
    - _Requirements: 7.4, 9.6_
  
  - [ ]* 9.5 Write property tests for API response formats
    - **Property 21: API Success Response Format**
    - **Property 22: API Error Response Format**
    - **Validates: Requirements 7.6, 7.7**
  
  - [~] 9.6 Implement GET /api/node endpoint
    - Call LightningClient.getNodeInfo()
    - Return node information
    - _Requirements: 7.5_
  
  - [~] 9.7 Add error handling middleware
    - Catch validation errors → 400 Bad Request
    - Catch not found errors → 404 Not Found
    - Catch internal errors → 500 Internal Server Error
    - Log all errors with details
    - Return generic messages for 500 errors
    - _Requirements: 7.7, 10.4, 10.5_
  
  - [ ]* 9.8 Write property tests for error handling
    - **Property 25: Error Message Descriptiveness**
    - **Property 26: Generic Error User Response**
    - **Validates: Requirements 10.4, 10.5**

- [ ] 10. Wire backend components together in server.js
  - [~] 10.1 Initialize all components with configuration
    - Read LND connection config from environment variables or config file
    - Create LightningClient instance
    - Create InvoiceGenerator, DonationTracker, ProofManager, StatusMonitor instances
    - Mount API routes
    - _Requirements: 1.1, 7.1_
  
  - [~] 10.2 Add startup initialization
    - Connect to LND on startup
    - Load existing donations from disk
    - Verify LND connection and log node info
    - Create data directory if needed
    - _Requirements: 1.1, 6.7, 13.6_
  
  - [~] 10.3 Add graceful shutdown handling
    - Save donations on SIGINT/SIGTERM
    - Close LND connection
    - _Requirements: 6.6_
  
  - [ ]* 10.4 Write integration tests for backend API
    - Test complete flow: create invoice → check status → verify proof
    - Test error scenarios
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [~] 11. Checkpoint - Verify backend API functionality
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Implement frontend donation interface
  - [~] 12.1 Update frontend/index.html structure
    - Add donation form with amount input and description textarea
    - Add invoice display section (payment request, QR code canvas)
    - Add status display section (loading, success, error messages)
    - Add proof display section (preimage)
    - Ensure mobile-responsive layout with CSS Grid/Flexbox
    - _Requirements: 8.1, 8.4_
  
  - [~] 12.2 Implement invoice creation in frontend/app.js
    - Add event listener for donate button
    - Validate amount input (positive integer, >= 1)
    - Send POST request to /api/invoice
    - Display loading indicator during request
    - Handle response and errors
    - _Requirements: 8.2, 8.4_
  
  - [ ]* 12.3 Write unit tests for frontend validation
    - Test amount validation (positive, >= 1 satoshi)
    - Test empty description handling
    - _Requirements: 8.2, 12.1_
  
  - [~] 12.3 Implement QR code generation
    - Import qrcode library (or use CDN)
    - Generate QR code from payment request string
    - Render QR code on canvas element
    - Display payment request string as text
    - _Requirements: 8.3, 8.5_
  
  - [~] 12.4 Implement payment status polling
    - Start polling after invoice creation (2 second intervals)
    - Send GET request to /api/status/:paymentHash
    - Update UI based on status (pending, completed, expired, failed)
    - Stop polling when status is completed, expired, or failed
    - Display loading indicator during polling
    - _Requirements: 8.6, 9.1, 9.2, 9.3, 9.4, 9.5_
  
  - [~] 12.5 Implement success and error displays
    - Display preimage when payment completes
    - Display success message with amount
    - Display error messages for failures and expiration
    - Clear previous invoice state before creating new one
    - _Requirements: 8.7, 8.8_
  
  - [ ]* 12.6 Write integration tests for frontend-backend interaction
    - Test invoice creation flow
    - Test polling behavior
    - Test success and error displays
    - _Requirements: 8.1, 8.2, 8.3, 8.6, 8.7, 8.8_

- [ ] 13. Implement frontend styling
  - [~] 13.1 Update frontend/style.css
    - Style donation form (clean, modern design)
    - Style invoice display (prominent QR code, readable text)
    - Style status indicators (loading spinner, success/error messages)
    - Add responsive breakpoints for mobile devices
    - Ensure accessibility (contrast, focus states, labels)
    - _Requirements: 8.9_

- [ ] 14. Add configuration management
  - [~] 14.1 Create backend/config/lnd-config.js
    - Define LND connection parameters (socket, cert path, macaroon path)
    - Support environment variables for configuration
    - Add validation for required config values
    - _Requirements: 1.1_
  
  - [~] 14.2 Create backend/config/server-config.js
    - Define server port, CORS settings
    - Define data file path
    - Support environment variables
    - _Requirements: 7.6_

- [ ] 15. Add comprehensive error handling and logging
  - [~] 15.1 Add logging throughout backend
    - Log all API requests (method, path, status)
    - Log Lightning Network operations (invoice creation, status checks)
    - Log errors with full stack traces
    - Use console.log for now (can upgrade to winston/pino later)
    - _Requirements: 10.5_
  
  - [~] 15.2 Verify zero-fee routing
    - Add validation in payment flow to check fees
    - Log warning if non-zero fees detected
    - Reject payments with non-zero fees
    - _Requirements: 11.2, 11.3_
  
  - [ ]* 15.3 Write property tests for fee verification and rejection
    - **Property 5: Zero-Fee Channel Verification**
    - **Property 28: Non-Zero Fee Rejection**
    - **Validates: Requirements 2.5, 4.7, 11.2, 11.3, 11.5, 12.2**

- [~] 16. Final checkpoint - End-to-end testing
  - Ensure all tests pass, ask the user if questions arise.
  - Test complete donation flow with real LND nodes in regtest mode
  - Verify invoice creation, QR code display, payment detection, proof display
  - Test error scenarios (invalid amounts, expired invoices, connection failures)
  - Verify data persistence across server restarts

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (30 properties total)
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end flows
- The implementation assumes LND nodes are already set up in regtest mode with channels established
- Configuration files should not be committed to version control (add to .gitignore)
