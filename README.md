# lightning-donation-platform

# Flash Aid: Instant Disaster Relief on the Lightning Network ⚡

**Flash Aid** is a Proof-of-Concept (MVP) for a trustless, instant, and zero-fee donation platform designed for disaster relief in areas with failing banking infrastructure. 

Built during the Johannesburg Lightning Bootcamp.

## 📖 The Problem
When disaster strikes (e.g., floods, earthquakes), traditional financial aid is slow and expensive:
*   **Speed:** International bank wires take days to settle.
*   **Fees:** Intermediaries take 3-10% of the donation value.
*   **Transparency:** Donors rarely receive cryptographic proof that funds reached the specific victim or merchant.

## 💡 The Solution
Using the **Bitcoin Lightning Network**, Flash Aid enables donors to send funds directly to victims or local merchants (Spaza shops) in seconds.
*   **Instant Settlement:** Funds are available immediately [1].
*   **Micropayments:** Enables donations as small as $0.01 (1 satoshi) without fees eating the principal [1].
*   **Proof of Payment:** The donor receives a cryptographic **Preimage** (receipt) guaranteeing the funds reached the destination [2].

---

## 🏗️ Architecture & Roles

This MVP utilizes a 3-Node setup running on **Bitcoin Core (Regtest)** and **LND** (Lightning Network Daemon).

| Node | Role | Description |
| :--- | :--- | :--- |
| **Alice** | **The Donor** | A mobile wallet user in any country. |
| **Bob** | **The Hub (NGO)** | A well-connected node (e.g., "Gift of the Givers") that routes payments. Configured with **0 fees** for charity channels. |
| **Charlie** | **The Recipient** | A local merchant or camp coordinator in the disaster zone generating invoices for supplies (e.g., Water, Bread). |

---

## 🛠️ Tech Stack & Prerequisites

*   **Bitcoin Core (`bitcoind`)**: Running in Regtest mode.
*   **LND (`lnd`)**: Lightning Network Daemon (v0.18.5+).
*   **Python 3**: For the custom explorer and script interactions.
*   **Docker/WSL**: Development environment.

---

