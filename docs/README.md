# SecureCloud Platform: The Future of Zero-Trust Storage

## 🚀 What is this Project?
**SecureCloud** is a next-generation secure cloud storage solution designed to demonstrate a **"Zero-Trust" architecture**. Unlike traditional cloud storage (like Google Drive or Dropbox) where you trust the provider with your data, SecureCloud assumes the infrastructure itself might be compromised.

It solves the "Trust Problem" by combining three cutting-edge technologies:
1.  **Cloud (AWS S3):** For scalable storage of large encrypted files.
2.  **Blockchain (Hyperledger Fabric):** For an immutable "Truth Log" that proves files haven't been tampered with.
3.  **AI (TensorFlow + LLM):** For active, real-time threat detection that watches *behavior*, not just signatures.

---

## ⚙️ How Does It Work?

### 1. The "Notary" Architecture
The system follows the **Notary Pattern** to balance speed and security:
*   **The Warehouse (Cloud):** We store the heavy, encrypted file blobs in AWS S3. This is cheap and fast.
*   **The Notary (Blockchain):** We store the *digital fingerprint* (SHA-256 Hash) of every file on a private Blockchain.
*   **The Guard (AI):** A neural network sits between the user and the data, analyzing every request for suspicious patterns.

### 2. The Workflow
1.  **Upload:** User uploads a file -> System Encrypts it (AES-256) -> Generates a Hash -> Sends Blob to S3 -> Writes Hash to Blockchain.
2.  **Download:** User requests file -> System fetches from S3 -> Calculates Hash -> **Compares with Blockchain** -> If match, Decrypt & Serve. If mismatch, **BLOCK**.
3.  **Attack:** If a hacker tries to steal data or modify files, the AI analyzes the *sequence* of actions and triggers mitigations (like blocking IPs or freezing storage).

---

## 👥 Users, Admins & Security

### How are Users Defined?
Users are not just "accounts"; they are defined by their **Security Posture**:
*   **Identity:** Email + Password (Bcrypt Hashed).
*   **Role:** `USER` (Can manage own files) or `ADMIN` (Can view system-wide alerts/logs).
*   **Trust Score:** The system tracks `Trusted Devices`, `Last IP`, and `MFA Status`.

### The Login Process
1.  **Credential Check:** User enters Email/Password. System compares the hash.
2.  **MFA Challenge:** If enabled, user must provide a 6-digit TOTP code (Google Authenticator).
3.  **Token Issuance:** System issues a **JWT (JSON Web Token)**.
    *   *Access Token:* Short-lived (15 mins) for API access.
    *   *Refresh Token:* Long-lived (7 days) stored securely.

### Database Access & Behavior
*   **Users:** Can strictly perform CRUD (Create, Read, Update, Delete) operations on *their own* metadata in MongoDB. They have **Zero Access** to other users' data (enforced by JWT Guards).
*   **Admins:** Have read-only access to **Audit Logs** and **Security Alerts**. They cannot decrypt user files (Zero-Knowledge Privacy).

---

## ⚔️ Attacks & Defenses

### How are Attacks Happening?
The project includes a sophisticated **Simulation Engine** (`simulate-futuristic-threats.ts`) that generates realistic attack traffic to test the AI. It simulates:

1.  **Infrastructure Attacks:**
    *   **Cache Side-Channel (CacheHawkeye):** An attacker on the *same physical CPU* tries to listen to your encryption keys.
    *   **Defense:** The AI detects the micro-timing "rattles" (L3 Cache Miss Spikes) and triggers a **Workload Migration** (moving the server to a different physical computer).

2.  **Cloud Attacks:**
    *   **SSRF:** Trying to trick the server into talking to the AWS Metadata API (`169.254...`).
    *   **Defense:** Hard Rules detect the IP pattern and block the user.

3.  **Application Attacks:**
    *   **Ransomware:** Detecting rapid file deletion/renaming to `.encrypted`.
    *   **SQL Injection:** Detecting code patterns in login fields.
    *   **Defense:** The AI scores the "Entropy" (randomness) of inputs and blocks suspicious text.

---

## 🧠 Why These Technologies?

### 1. Why Cloud? (AWS S3)
*   **Reason:** Blockchains are terrible at storing large files (expensive/slow).
*   **Data Stored:** Only the **Encrypted Blob** (random noise to anyone looking at it).

### 2. Why Blockchain? (Hyperledger Fabric)
*   **Reason:** Cloud admins (or hackers) can technically modify files in S3.
*   **Data Stored:** The **SHA-256 Hash**. Since the blockchain is immutable (cannot be changed), it acts as the ultimate "Truth" to verify file integrity.

### 3. Why AI? (TensorFlow + LLM)
*   **Reason:** Static firewalls can't catch "User behavior" attacks (like a legitimate user turning rogue).
*   **Role:**
    *   **TensorFlow:** Detects anomalies mathematically (e.g., "User is downloading 500% faster than usual").
    *   **LLM (Llama 3):** Acts as a "Security Analyst," reading the logs and deciding *why* an attack is happening and *how* to stop it (Reasoning).

---

## ⚠️ Current Flaws & Limitations
While powerful, this is a Proof-of-Concept:
1.  **Simulation vs. Reality:** The attacks are simulated via scripts. In a real environment, attacks would be subtler and mixed with noise.
2.  **Hardware Emulation:** We "simulate" a Cache Side-Channel attack by logging specific flags (`l3_cache_miss`). We cannot actually perform a physical side-channel attack on your laptop.
3.  **Local LLM:** We use a local Llama-3 model. In production, this would require a massive GPU cluster or a cloud API (like Anthropic/OpenAI) to handle thousands of requests per second.
4.  **Single Node Blockchain:** The Hyperledger Fabric network is running locally. A real deployment requires multiple nodes across different organizations to be truly "Decentralized."