# QScrap Driver App – Cleaned & Enhanced Architecture

## 1. Product Overview
QScrap is a B2C/B2B used car spares and scrap logistics platform. The **Driver App** is a mission‑critical mobile application used by pickup and delivery drivers to:
- Accept and manage jobs (pickup & delivery)
- Navigate to customer and warehouse locations
- Verify scrap items
- Update real‑time job status
- Capture proof of pickup/delivery
- Communicate with dispatch and customers

The system must be **real‑time, location‑aware, offline‑tolerant, secure, and highly reliable**.

---

## 2. Core Design Principles
- Mobile‑first, offline‑first
- Event‑driven and real‑time
- Strong geolocation validation
- Secure, auditable workflows
- Scalable for B2C and B2B volumes
- AI‑ready architecture (future optimization)

---

## 3. High‑Level Architecture

### 3.1 Client Layer (Driver App)
**Technology:** React Native 0.73+

**Key Modules:**
- Authentication & Driver Profile
- Job Assignment & Queue
- Navigation & Maps
- Pickup Workflow
- Delivery Workflow
- Media Capture (Photos, Video, Signatures)
- Real‑time Status Updates
- Offline Sync Engine
- Notifications
- Settings & Support

---

### 3.2 Backend Services (Microservices)

**API Gateway**
- Auth validation
- Rate limiting
- Request routing

**Core Services:**
- Auth Service (JWT + Refresh Tokens)
- Driver Service
- Order & Delivery Service
- Location & Geo‑Validation Service
- Media Service
- Notification Service
- Payment & Settlement Service (optional for driver payouts)
- Audit & Logs Service

---

### 3.3 Data Layer

**Primary Database:** PostgreSQL + PostGIS
- Drivers
- Orders
- Deliveries
- Location events
- Media references

**Cache:** Redis
- Active jobs
- Driver availability
- Session state

**Object Storage:** AWS S3 / GCP Storage
- Photos
- Videos
- Documents

---

### 3.4 Real‑Time & Async Layer
- WebSockets / Socket.IO (live job updates)
- Firebase Cloud Messaging (push notifications)
- Message Queue (Kafka / SQS / RabbitMQ)

---

### 3.5 AI & Intelligence Layer (Optional / Phase 2)
- Route optimization
- Fraud detection (location spoofing)
- Driver performance scoring
- ETA prediction

---

## 4. Driver App – Detailed Functional Architecture

### 4.1 Authentication Flow
- Phone number / Email login
- OTP verification
- JWT access token + refresh token
- Device binding

---

### 4.2 Job Lifecycle

**States:**
- ASSIGNED
- ACCEPTED
- EN_ROUTE_TO_PICKUP
- AT_PICKUP
- PICKED_UP
- EN_ROUTE_TO_DELIVERY
- AT_DELIVERY
- DELIVERED
- CANCELLED
- FAILED

Each state transition:
- Requires GPS validation
- Is logged with timestamp
- Is auditable

---

### 4.3 Location & Geo‑Validation
- Continuous background GPS tracking
- Distance threshold validation (e.g., 50–100m radius)
- Server‑side PostGIS checks
- Anti‑spoofing heuristics

---

### 4.4 Media Capture & Proof
- Mandatory photos at pickup and delivery
- Optional video capture
- Digital signature capture
- Automatic upload with retry & compression

---

### 4.5 Offline‑First Sync Engine
- Local storage (SQLite / MMKV)
- Queue‑based sync
- Conflict resolution rules
- Graceful recovery

---

### 4.6 Notifications
- Job assignment alerts
- Status change confirmations
- Escalations & exceptions

---

## 5. Security & Compliance
- TLS everywhere
- Signed media uploads
- Role‑based access control
- Audit trails
- GDPR‑ready data handling

---

## 6. Observability & Reliability
- Centralized logging
- Driver action replay
- Error tracking (Sentry)
- Metrics & alerts

---

# 7. PREMIUM MULTI‑AI AGENT MASTER PROMPT

## Role
You are a **team of elite AI agents** collaborating to design, implement, and validate the **QScrap Driver Mobile App** using the architecture defined above.

## Agents
- **System Architect Agent** – owns architecture, data flow, and scalability
- **Mobile Engineer Agent** – React Native implementation
- **Backend Engineer Agent** – APIs, DB, geo‑logic
- **DevOps & Security Agent** – CI/CD, infra, security
- **QA & Reliability Agent** – testing, edge cases, failure modes
- **Product Agent** – UX flows and business logic alignment

## Global Instructions
- Follow the architecture strictly
- Make production‑grade decisions
- Prioritize reliability, security, and scalability
- Document assumptions explicitly
- Avoid shortcuts or demo‑only solutions

---

## Deliverables
Each agent must produce:
1. Clear responsibilities
2. Technical design decisions
3. API contracts (where applicable)
4. Data models
5. Edge‑case handling
6. Security considerations
7. Test strategies

---

## Core Tasks

### 1. Driver App (React Native)
- Implement full job lifecycle
- Offline‑first behavior
- Background GPS tracking
- Media capture & upload
- Real‑time updates

### 2. Backend APIs
- Job assignment & status updates
- Geo‑validation logic
- Media handling
- WebSocket events

### 3. Database Design
- Normalized schema
- PostGIS location checks
- Audit tables

### 4. Failure & Fraud Handling
- GPS spoofing
- Network loss
- Partial uploads
- Dispute scenarios

---

## Quality Bar
- Code must be production‑ready
- All workflows must be idempotent
- Every state change must be traceable
- System must survive poor network conditions

---

## Output Format
- Structured markdown
- Diagrams where helpful (ASCII or Mermaid)
- Clear separation per agent

---

**Begin by aligning all agents on the architecture, then proceed incrementally from core flows to edge cases.**

