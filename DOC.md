# ChainScribe: Detailed Documentation

## 1. Overview

ChainScribe is a decentralized documentation platform that transforms project documentation into an intelligent, verifiable knowledge network. It integrates Web3 principles to bring transparency and trust to collaborative knowledge bases.

The system leverages the 0G (ZeroGravity) infrastructure for decentralized AI compute, storage, and on-chain verification.

### Core Features

* **Verifiable Document History:** Every document update creates a new version. The full content is stored on **0G Storage**, while a cryptographic hash (SHA256) of the content is recorded on the **0G Chain** via the `ChainScribeV2` smart contract.
* **AI-Powered Analysis (DocuSense):** Users can select text within the editor to perform AI-driven tasks like summarization, explanation, and finding related topics.
* **Verifiable AI Compute:** All AI analysis is processed through **0G Compute**. The resulting analysis includes a `computeProof` (trace ID) which is also logged on-chain, proving the AI task was executed.
* **Intelligent Change Summaries:** When a document is modified, the system distinguishes between minor and major edits. Major edits trigger an AI analysis via 0G Compute to generate a concise summary of the changes.
* **Dynamic Knowledge Graph:** The platform analyzes documents to extract key entities and relationships, visualizing them as an interactive knowledge graph. This graph data is also stored on 0G Storage.
* **AI Model Fine-Tuning:** The architecture is designed to support fine-tuning AI models on project-specific documentation using the **0G FineTuning Contract**, creating expert models for tasks like knowledge graph extraction.

---

## 2. Architecture

ChainScribe is built on a distributed architecture that separates the user interface, business logic, and data verification layers.


### Component Breakdown

#### A. Frontend (React + Vite)

The frontend is a single-page application (SPA) built with React and Vite, responsible for the user experience.

* **Wallet Connection:** Uses the `useZeroGCompute.js` hook, which leverages `ethers.js` (BrowserProvider) to connect to the user's browser wallet (e.g., MetaMask). It handles account and network change events.
* **Core Components:**
    * `App.jsx`: The main application component that manages layout, wallet state, and orchestrates data flow between panels.
    * `DocuSenseToolbar.jsx`: Provides the UI for AI tools (Summarize, Explain, etc.). When a tool is used, it calls the `invokeModel` function from its hook.
    * `ChangeHistory.jsx`: Displays a list of past document versions and their AI-generated summaries.
    * `KnowledgeGraphPanel.jsx`: A component responsible for fetching and rendering the knowledge graph data.
* **Backend Communication:** The frontend **does not** interact with the 0G SDKs directly. Instead, it makes HTTP requests to its own backend server (defined by `VITE_BACKEND_URL`) for all AI analysis, storage, and graph operations.

#### B. Backend (Node.js + Express)

The backend server acts as the integration hub, securely managing 0G service interactions and API keys.

* **API Server (`server.js`):** An Express server that exposes endpoints for the frontend.
    * `/api/analyze`: Handles general AI analysis requests (summarize, explain, etc.).
    * `/api/analyze-changes`: Analyzes differences between two versions of content.
    * `/api/storage/...`: Endpoints for uploading and downloading data from 0G Storage.
    * `/api/finetune/...`: Endpoints to start and check the status of AI model fine-tuning jobs.
    * `/api/graph/...`: Endpoints to fetch or trigger updates for the knowledge graph.
* **0G Service (`ZeroGService.js`):** This is the core service integration class.
    * **Initialization:** On startup, it creates instances of 0G SDK brokers:
        * `createLedgerBroker`: Manages the payment ledger for AI compute tasks.
        * `createInferenceBroker`: Handles AI inference requests.
        * `Indexer`: Connects to the 0G Storage indexer for file upload/download.
    * **Ledger Funding:** The service automatically funds the compute ledger from the deployer's wallet on initialization if the balance is low.
    * **`invokeModel`:** The main AI function. It retrieves the AI provider's endpoint, constructs authenticated request headers using `compute.getRequestHeaders`, calls the provider's HTTP endpoint, and processes the response with `compute.processResponse` to verify the task.
* **Change Analysis (`ChangeAnalysisService.js`):**
    * Uses the `diff` library to compare `previousContent` and `currentContent`.
    * If the character difference is below a threshold (`minorEditThreshold`), it returns a simple summary (e.g., "Modified content: 10 additions, 2 deletions").
    * For major changes, it calls `zeroGService.invokeModel` to get an AI-generated summary.
* **Cost Management (`CostManager.js`):**
    * A utility class that tracks the estimated cost of each AI request based on model rates.
    * It enforces a `DAILY_BUDGET` set in the environment variables and will throw an error if a request exceeds the budget.

#### C. Blockchain (0G Chain / EVM)

The blockchain layer serves as the immutable "source of truth" for verification, not for data storage.

* **`ChainScribeV2.sol`:** A Solidity smart contract that acts as a decentralized registry for document metadata.
* **Data Structure:** The contract maintains a mapping of `documentId` (string) to a `Document` struct. This struct contains the owner, timestamps, and a nested mapping of version numbers to `Version` structs.
* **Key Functions:**
    * `createDocument(string memory documentId)`: Creates a new document entry, assigning `msg.sender` as the owner.
    * `createVersion(...)`: Can only be called by the document owner. It records a new version with:
        * `contentHash`: The hash of the full document content (which is stored on 0G Storage).
        * `aiSummaryHash`: The hash of the AI-generated change summary.
        * `computeProof`: The verification proof/trace ID from the 0G Compute task.
        * `modelId`: The identifier of the AI model used for the summary.
    * `verifyAIOutput(..., bytes32 providedSummaryHash)`: A public `view` function that allows anyone to check if a given summary hash matches the one recorded on-chain for a specific document version.

---

## 3. How to Use (User Guide)

This guide explains how to set up and run the ChainScribe application locally.

### Prerequisites

* Node.js (v18 or higher recommended)
* An Ethereum-compatible wallet (e.g., MetaMask)
* NPM or PNPM

### Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/GauravKarakoti/ChainScribe.git](https://github.com/GauravKarakoti/ChainScribe.git)
    cd ChainScribe
    ```
   

2.  **Install Root Dependencies:**
    ```bash
    npm install
    ```

3.  **Install Frontend Dependencies:**
    ```bash
    cd frontend
    npm install
    cd ..
    ```
   

4.  **Install Backend Dependencies:**
    ```bash
    cd backend
    npm install
    cd ..
    ```
   

5.  **Set up Backend Environment:**
    Copy `backend/.env.example` to `backend/.env` and fill in your 0G service details.
    ```ini
    # backend/.env
    ZEROG_RPC_URL=[https://rpc-testnet.0g.ai](https://rpc-testnet.0g.ai)
    DEPLOYER_PRIVATE_KEY=your_wallet_private_key_for_funding
    ZEROG_INDEXER_URL=your_0g_storage_indexer_url
    ZEROG_INFERENCE_CONTRACT_ADDRESS="0x..." # From 0G Docs
    ZEROG_LEDGER_CONTRACT_ADDRESS="0x..." # From 0G Docs
    ZEROG_FINETUNING_CONTRACT_ADDRESS="0x..." # Optional
    ZEROG_PROVIDER_ADDRESS=address_of_ai_compute_provider
    LEDGER_FUNDING_AMOUNT=1 # Amount in 0G tokens to auto-fund ledger
    PORT=3001
    DAILY_BUDGET=10 # Optional: Spend limit in $
    ```

6.  **Set up Frontend Environment:**
    Copy `frontend/.env.example` to `frontend/.env`.
    ```ini
    # frontend/.env
    VITE_BACKEND_URL=http://localhost:3001
    ```
   

7.  **Set up Contract Deployment Environment (Optional):**
    If you need to deploy your own version of the contract, copy the root `.env.example` to `.env` and add your private key.

### Running the Application

1.  **Start the Backend Server:**
    ```bash
    cd backend
    npm run dev
    ```
    The API will run on `http://localhost:3001`.

2.  **Start the Frontend Server:**
    ```bash
    cd frontend
    npm run dev
    ```
    The application will be available at `http://localhost:3000` (or as specified by Vite).

### User Workflow

1.  **Connect Wallet:** Open the application in your browser and click "Connect Wallet". Select an account in MetaMask.
2.  **Write Content:** Use the central text editor to write or paste your documentation.
3.  **Use AI Tools:** Highlight any text in the editor. The "DocuSense AI" tools in the left sidebar will become active.
    * Click **"Summarize"** to get a concise summary.
    * Click **"Explain Simply"** for a simplified explanation.
    * Click **"Find Related"** to get suggestions for related topics.
4.  **Review AI Responses:** The AI-generated text will appear in the "AI Responses" panel on the right. Each response is marked with a "Verified with 0G Compute" badge.
5.  **View History:** As changes are saved (workflow to be fully implemented), they appear in the "Change History" panel on the left, showing the author, timestamp, and AI summary of the change.
6.  **Explore Knowledge Graph:** Open the "Knowledge Graph" panel (far right) to see a visualization of how documents, concepts, and authors are interconnected.

---

## 4. Future Roadmap

The planned next steps for ChainScribe include:

* **Enhanced Graph Features:** Add querying capabilities and more sophisticated relationship analysis to the Knowledge Graph.
* **Access Control:** Implement token-gated documentation for private or paid content.
* **Enhanced Collaboration:** Integrate real-time co-editing features.
* **Project Ecosystem:** Allow grouping of documents into project wikis with shared contributor lists and project-specific fine-tuned AI models.