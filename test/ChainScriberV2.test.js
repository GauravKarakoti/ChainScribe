const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('ChainScribeV2', function () {
  let ChainScribeV2;
  let chainScribe;
  let owner;
  let user1;
  let user2;

  const TEST_DOCUMENT_ID = 'test-document-1';
  const TEST_CONTENT_HASH = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('Test content'));
  const TEST_AI_SUMMARY_HASH = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('AI summary'));
  const TEST_COMPUTE_PROOF = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('Compute proof'));
  const TEST_MODEL_ID = 'chainscribe-docusense-v1';

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    
    ChainScribeV2 = await ethers.getContractFactory('ChainScribeV2');
    chainScribe = await ChainScribeV2.deploy();
    await chainScribe.deployed();
  });

  describe('Document Management', function () {
    it('Should create a new document', async function () {
      await expect(chainScribe.connect(user1).createDocument(TEST_DOCUMENT_ID))
        .to.emit(chainScribe, 'DocumentCreated')
        .withArgs(TEST_DOCUMENT_ID, user1.address);
      
      const documentExists = await chainScribe.documentExists(TEST_DOCUMENT_ID);
      expect(documentExists).to.be.true;
    });

    it('Should not allow duplicate document IDs', async function () {
      await chainScribe.connect(user1).createDocument(TEST_DOCUMENT_ID);
      
      await expect(
        chainScribe.connect(user2).createDocument(TEST_DOCUMENT_ID)
      ).to.be.revertedWith('Document already exists');
    });

    it('Should not allow empty document ID', async function () {
      await expect(
        chainScribe.connect(user1).createDocument('')
      ).to.be.revertedWith('Document ID cannot be empty');
    });
  });

  describe('Version Management', function () {
    beforeEach(async function () {
      await chainScribe.connect(user1).createDocument(TEST_DOCUMENT_ID);
    });

    it('Should create a new version with AI metadata', async function () {
      await expect(
        chainScribe.connect(user1).createVersion(
          TEST_DOCUMENT_ID,
          TEST_CONTENT_HASH,
          TEST_AI_SUMMARY_HASH,
          TEST_COMPUTE_PROOF,
          TEST_MODEL_ID
        )
      ).to.emit(chainScribe, 'VersionCreated')
       .withArgs(
          TEST_DOCUMENT_ID,
          0,
          TEST_CONTENT_HASH,
          TEST_AI_SUMMARY_HASH,
          TEST_COMPUTE_PROOF,
          TEST_MODEL_ID
        );

      const versionCount = await chainScribe.getVersionCount(TEST_DOCUMENT_ID);
      expect(versionCount).to.equal(1);
    });

    it('Should only allow document owner to create versions', async function () {
      await expect(
        chainScribe.connect(user2).createVersion(
          TEST_DOCUMENT_ID,
          TEST_CONTENT_HASH,
          TEST_AI_SUMMARY_HASH,
          TEST_COMPUTE_PROOF,
          TEST_MODEL_ID
        )
      ).to.be.revertedWith('Only document owner can perform this action');
    });

    it('Should retrieve version details correctly', async function () {
      await chainScribe.connect(user1).createVersion(
        TEST_DOCUMENT_ID,
        TEST_CONTENT_HASH,
        TEST_AI_SUMMARY_HASH,
        TEST_COMPUTE_PROOF,
        TEST_MODEL_ID
      );

      const version = await chainScribe.getVersion(TEST_DOCUMENT_ID, 0);
      
      expect(version.contentHash).to.equal(TEST_CONTENT_HASH);
      expect(version.aiSummaryHash).to.equal(TEST_AI_SUMMARY_HASH);
      expect(version.computeProof).to.equal(TEST_COMPUTE_PROOF);
      expect(version.modelId).to.equal(TEST_MODEL_ID);
      expect(version.author).to.equal(user1.address);
    });
  });

  describe('AI Output Verification', function () {
    beforeEach(async function () {
      await chainScribe.connect(user1).createDocument(TEST_DOCUMENT_ID);
      await chainScribe.connect(user1).createVersion(
        TEST_DOCUMENT_ID,
        TEST_CONTENT_HASH,
        TEST_AI_SUMMARY_HASH,
        TEST_COMPUTE_PROOF,
        TEST_MODEL_ID
      );
    });

    it('Should verify correct AI summary hash', async function () {
      const isVerified = await chainScribe.verifyAIOutput(
        TEST_DOCUMENT_ID,
        0,
        TEST_AI_SUMMARY_HASH
      );
      
      expect(isVerified).to.be.true;
    });

    it('Should reject incorrect AI summary hash', async function () {
      const wrongHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('Wrong summary'));
      
      const isVerified = await chainScribe.verifyAIOutput(
        TEST_DOCUMENT_ID,
        0,
        wrongHash
      );
      
      expect(isVerified).to.be.false;
    });

    it('Should not verify non-existent version', async function () {
      await expect(
        chainScribe.verifyAIOutput(TEST_DOCUMENT_ID, 1, TEST_AI_SUMMARY_HASH)
      ).to.be.revertedWith('Version does not exist');
    });
  });

  describe('User Document Management', function () {
    it('Should track user documents correctly', async function () {
      const doc1 = 'doc-1';
      const doc2 = 'doc-2';
      
      await chainScribe.connect(user1).createDocument(doc1);
      await chainScribe.connect(user1).createDocument(doc2);
      
      const userDocs = await chainScribe.getUserDocuments(user1.address);
      
      expect(userDocs).to.have.lengthOf(2);
      expect(userDocs).to.include(doc1);
      expect(userDocs).to.include(doc2);
    });

    it('Should return empty array for user with no documents', async function () {
      const userDocs = await chainScribe.getUserDocuments(user2.address);
      expect(userDocs).to.have.lengthOf(0);
    });
  });

  describe('Edge Cases', function () {
    it('Should handle multiple versions correctly', async function () {
      await chainScribe.connect(user1).createDocument(TEST_DOCUMENT_ID);
      
      // Create multiple versions
      for (let i = 0; i < 3; i++) {
        const contentHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`Content ${i}`));
        const aiSummaryHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`Summary ${i}`));
        
        await chainScribe.connect(user1).createVersion(
          TEST_DOCUMENT_ID,
          contentHash,
          aiSummaryHash,
          TEST_COMPUTE_PROOF,
          TEST_MODEL_ID
        );
      }

      const versionCount = await chainScribe.getVersionCount(TEST_DOCUMENT_ID);
      expect(versionCount).to.equal(3);

      // Verify each version
      for (let i = 0; i < 3; i++) {
        const version = await chainScribe.getVersion(TEST_DOCUMENT_ID, i);
        const expectedHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`Content ${i}`));
        expect(version.contentHash).to.equal(expectedHash);
      }
    });

    it('Should update document timestamp on version creation', async function () {
      await chainScribe.connect(user1).createDocument(TEST_DOCUMENT_ID);
      
      const documentBefore = await chainScribe.documents(TEST_DOCUMENT_ID);
      const initialTimestamp = documentBefore.updatedAt;
      
      // Wait a moment to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await chainScribe.connect(user1).createVersion(
        TEST_DOCUMENT_ID,
        TEST_CONTENT_HASH,
        TEST_AI_SUMMARY_HASH,
        TEST_COMPUTE_PROOF,
        TEST_MODEL_ID
      );

      const documentAfter = await chainScribe.documents(TEST_DOCUMENT_ID);
      expect(documentAfter.updatedAt).to.be.greaterThan(initialTimestamp);
    });
  });
});

describe('ChainScribeV2 Integration', function () {
  let chainScribe;
  let user;

  beforeEach(async function () {
    [user] = await ethers.getSigners();
    
    const ChainScribeV2 = await ethers.getContractFactory('ChainScribeV2');
    chainScribe = await ChainScribeV2.deploy();
    await chainScribe.deployed();
  });

  it('Should perform complete document lifecycle', async function () {
    const documentId = 'integration-test-doc';
    
    // Create document
    await chainScribe.createDocument(documentId);
    expect(await chainScribe.documentExists(documentId)).to.be.true;
    
    // Create multiple versions
    const versions = [
      {
        content: 'Initial document content',
        summary: 'Created initial document structure'
      },
      {
        content: 'Updated document with new sections',
        summary: 'Added new sections and expanded content'
      },
      {
        content: 'Final document with revisions',
        summary: 'Applied final revisions and corrections'
      }
    ];
    
    for (let i = 0; i < versions.length; i++) {
      const version = versions[i];
      const contentHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(version.content));
      const summaryHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(version.summary));
      const computeProof = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`proof-${i}`));
      
      await chainScribe.createVersion(
        documentId,
        contentHash,
        summaryHash,
        computeProof,
        `model-v${i}`
      );
    }
    
    // Verify final state
    const versionCount = await chainScribe.getVersionCount(documentId);
    expect(versionCount).to.equal(versions.length);
    
    const userDocs = await chainScribe.getUserDocuments(user.address);
    expect(userDocs).to.include(documentId);
    
    // Verify each version
    for (let i = 0; i < versions.length; i++) {
      const version = await chainScribe.getVersion(documentId, i);
      const expectedContentHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(versions[i].content));
      const expectedSummaryHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(versions[i].summary));
      
      expect(version.contentHash).to.equal(expectedContentHash);
      expect(version.aiSummaryHash).to.equal(expectedSummaryHash);
      expect(version.modelId).to.equal(`model-v${i}`);
      
      // Test verification
      const isVerified = await chainScribe.verifyAIOutput(
        documentId,
        i,
        expectedSummaryHash
      );
      expect(isVerified).to.be.true;
    }
  });
});