// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ChainScribeV2
 * @dev Intelligent Documentation with AI Metadata Storage
 * @notice Extends ChainScribe with AI-generated change summaries and compute proofs
 */
contract ChainScribeV2 {
    // Version structure with AI metadata
    struct Version {
        bytes32 contentHash;
        uint256 timestamp;
        address author;
        bytes32 aiSummaryHash; // Hash of AI-generated change summary
        bytes32 computeProof;  // 0G Compute verification proof
        string modelId;        // AI model used for analysis
    }
    
    // Document structure
    struct Document {
        string id;
        address owner;
        uint256 createdAt;
        uint256 updatedAt;
        uint256 versionCount;
        mapping(uint256 => Version) versions;
    }
    
    // State variables
    mapping(string => Document) public documents;
    mapping(address => string[]) public userDocuments;
    
    // Events
    event DocumentCreated(string indexed documentId, address indexed owner);
    event VersionCreated(
        string indexed documentId,
        uint256 versionIndex,
        bytes32 contentHash,
        bytes32 aiSummaryHash,
        bytes32 computeProof,
        string modelId
    );
    event AISummaryVerified(
        string indexed documentId,
        uint256 versionIndex,
        bool verified
    );
    
    // Modifiers
    modifier onlyDocumentOwner(string memory documentId) {
        require(
            documents[documentId].owner == msg.sender,
            "Only document owner can perform this action"
        );
        _;
    }
    
    modifier documentExists(string memory documentId) {
        require(
            documents[documentId].createdAt > 0,
            "Document does not exist"
        );
        _;
    }
    
    /**
     * @dev Create a new document
     * @param documentId Unique identifier for the document
     */
    function createDocument(string memory documentId) external {
        require(documents[documentId].createdAt == 0, "Document already exists");
        require(bytes(documentId).length > 0, "Document ID cannot be empty");
        
        Document storage doc = documents[documentId];
        doc.id = documentId;
        doc.owner = msg.sender;
        doc.createdAt = block.timestamp;
        doc.updatedAt = block.timestamp;
        doc.versionCount = 0;
        
        userDocuments[msg.sender].push(documentId);
        
        emit DocumentCreated(documentId, msg.sender);
    }
    
    /**
     * @dev Create a new version with AI metadata
     * @param documentId Document identifier
     * @param contentHash Hash of the document content
     * @param aiSummaryHash Hash of AI-generated change summary
     * @param computeProof 0G Compute verification proof
     * @param modelId AI model identifier used for analysis
     */
    function createVersion(
        string memory documentId,
        bytes32 contentHash,
        bytes32 aiSummaryHash,
        bytes32 computeProof,
        string memory modelId
    ) external documentExists(documentId) {
        Document storage doc = documents[documentId];
        uint256 versionIndex = doc.versionCount;
        
        doc.versions[versionIndex] = Version({
            contentHash: contentHash,
            timestamp: block.timestamp,
            author: msg.sender,
            aiSummaryHash: aiSummaryHash,
            computeProof: computeProof,
            modelId: modelId
        });
        
        doc.versionCount++;
        doc.updatedAt = block.timestamp;
        
        emit VersionCreated(
            documentId,
            versionIndex,
            contentHash,
            aiSummaryHash,
            computeProof,
            modelId
        );
    }
    
    /**
     * @dev Verify AI output against stored hash
     * @param documentId Document identifier
     * @param versionIndex Version number to verify
     * @param providedSummaryHash Hash of the AI summary to verify
     * @return bool Whether the hash matches
     */
    function verifyAIOutput(
        string memory documentId,
        uint256 versionIndex,
        bytes32 providedSummaryHash
    ) external view documentExists(documentId) returns (bool) {
        require(
            versionIndex < documents[documentId].versionCount,
            "Version does not exist"
        );
        
        Version memory version = documents[documentId].versions[versionIndex];
        bool verified = version.aiSummaryHash == providedSummaryHash;
        
        return verified;
    }
    
    /**
     * @dev Get version details
     * @param documentId Document identifier
     * @param versionIndex Version number
     * @return Version memory Full version details
     */
    function getVersion(
        string memory documentId,
        uint256 versionIndex
    ) external view documentExists(documentId) returns (Version memory) {
        require(
            versionIndex < documents[documentId].versionCount,
            "Version does not exist"
        );
        
        return documents[documentId].versions[versionIndex];
    }
    
    /**
     * @dev Get document version count
     * @param documentId Document identifier
     * @return uint256 Number of versions
     */
    function getVersionCount(
        string memory documentId
    ) external view documentExists(documentId) returns (uint256) {
        return documents[documentId].versionCount;
    }
    
    /**
     * @dev Get user's documents
     * @param user Address of the user
     * @return string[] Array of document IDs
     */
    function getUserDocuments(
        address user
    ) external view returns (string[] memory) {
        return userDocuments[user];
    }
    
    /**
    * @dev Check if document exists
    * @param documentId Document identifier
    * @return bool Whether document exists
    */
    function doesDocumentExist( // <-- RENAMED HERE
        string memory documentId
    ) external view returns (bool) {
        return documents[documentId].createdAt > 0;
    }
}