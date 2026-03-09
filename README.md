# NimbusEase: Secure Blockchain-Backed Cloud Storage with AI Monitoring

NimbusEase is a futuristic, highly secure cloud storage platform that integrates **Hyperledger Fabric Blockchain** for data integrity and **TensorFlow-powered AI** for real-time threat detection and automated mitigation.

## 🛡️ Security & Privacy Architecture

NimbusEase is built on a "Security-First" philosophy, employing multiple layers of defense to protect user data and system integrity.

### 1. AI-Driven Threat Detection & Autonomous Response
The system features a global `AiSecurityGuard` that analyzes every request in real-time.
*   **TensorFlow Anomaly Detection:** Uses a trained neural network to identify suspicious access patterns based on entropy, resource usage, and action frequency.
*   **AI Threat Detection:** Real-time analysis of network activity and file uploads using TensorFlow.js and specialized Python ensembles (SoReL, Dike, PDF).
*   **Autonomous Mitigation:** The system can automatically execute defensive actions, including:
    *   **BLOCK_IP:** Blacklisting malicious source IPs.
    *   **REVOKE_USER:** Terminating active sessions for compromised accounts.
    *   **FREEZE_STORAGE:** Suspends write operations if Ransomware behavior is detected.
    *   **WORKLOAD_MIGRATION:** Moves services between isolated hosts if side-channel attacks are detected.
*   **Injection Protection:** All data sent to the AI engine is sanitized to prevent **Prompt Injection** attacks.

### 2. Blockchain-Backed Data Integrity
Every file uploaded to NimbusEase is registered on a **Hyperledger Fabric** private blockchain.
*   **Immutable Hashing:** A SHA-256 hash of each file is stored on-chain.
*   **Integrity Verification:** During every download, the system re-calculates the file hash and compares it against the blockchain record. If a mismatch is detected (indicating tampering), access is blocked and a security alert is raised.
*   **Audit Trail:** All file operations (Upload, Download, Delete) are logged on the blockchain, providing a permanent, tamper-proof history.

### 3. Advanced Encryption & Storage
*   **AES-256-GCM Encryption:** Files are encrypted client-side or server-side (depending on configuration) using industry-standard AES-256-GCM.
*   **Secure Key Management:** Encryption keys are never stored in plain text and are hashed using SHA-256 for verification.
*   **Path Traversal Prevention:** Strict path validation ensures users cannot access files outside of their authorized directory.

### 4. Hardened Authentication & Identity
*   **Secure JWT Management:** Uses dual-token (Access + Refresh) authentication with **HttpOnly, Secure, and SameSite: Strict** cookies to prevent XSS and CSRF attacks.
*   **Multi-Factor Authentication (MFA):** Supports TOTP-based MFA (Google Authenticator) for an additional layer of account security.
*   **Privacy-Aware Logging:** Personally Identifiable Information (PII) like email addresses are masked in audit logs to comply with privacy regulations.
*   **Role-Based Access Control (RBAC):** Granular permissions enforced across the entire API.

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- MongoDB & Redis
- Docker (for Hyperledger Fabric)

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/HarshitMalik1/NimbusEase.git
   ```
2. Install dependencies:
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```
3. Set up environment variables (see `backend/.env.example`).
4. Start the infrastructure and apps:
   ```bash
   docker-compose up -d
   ```
   Or use the master script:
   ```bash
   ./scripts/start-all.sh
   ```

## 📂 Project Structure

- `backend/`: Node.js NestJS API for the cloud platform.
- `frontend/`: React-based dashboard for users.
- `blockchain/`: Hyperledger Fabric chaincode and smart contracts.
- `ai/`: TensorFlow models and training scripts for threat detection.
- `infrastructure/`: Fabric binaries, configurations, and database files.
- `scripts/`: Deployment, setup, and orchestration scripts.
- `secrets/`: SSH keys and secure configuration.

## 📜 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
