import { expect } from 'chai';
import request from 'supertest';
import { app } from '../backend/server.js';
import { zeroGService } from '../backend/services/ZeroGService.js';

describe('ChainScribe Backend API', function () {
  this.timeout(10000);

  describe('Health Check', function () {
    it('should return healthy status', async function () {
      const res = await request(app)
        .get('/api/health')
        .expect(200);
      
      expect(res.body.status).to.equal('healthy');
      expect(res.body.services).to.have.property('zeroGCompute');
    });
  });

  describe('Model Management', function () {
    it('should return available models', async function () {
      const res = await request(app)
        .get('/api/models')
        .expect(200);
      
      expect(res.body).to.be.an('array');
      expect(res.body[0]).to.have.property('id');
      expect(res.body[0]).to.have.property('name');
      expect(res.body[0]).to.have.property('status');
    });
  });

  describe('Document Analysis', function () {
    it('should analyze document content', async function () {
      const testContent = 'This is a test document content for analysis.';
      
      const res = await request(app)
        .post('/api/analyze')
        .send({
          content: testContent,
          documentId: 'test-doc-1',
          analysisType: 'summary'
        })
        .expect(200);
      
      expect(res.body.success).to.be.true;
      expect(res.body).to.have.property('analysis');
      expect(res.body).to.have.property('proof');
      expect(res.body).to.have.property('modelId');
    });

    it('should reject empty content', async function () {
      await request(app)
        .post('/api/analyze')
        .send({
          content: '',
          documentId: 'test-doc-1'
        })
        .expect(400);
    });
  });

  describe('Change Analysis', function () {
    it('should analyze document changes', async function () {
      const previousContent = 'Old document content';
      const currentContent = 'New and updated document content';
      
      const res = await request(app)
        .post('/api/analyze-changes')
        .send({
          previousContent,
          currentContent,
          documentId: 'test-doc-1',
          author: 'test@example.com'
        })
        .expect(200);
      
      expect(res.body.success).to.be.true;
      expect(res.body).to.have.property('changeType');
      expect(res.body).to.have.property('summary');
    });

    it('should reject missing content', async function () {
      await request(app)
        .post('/api/analyze-changes')
        .send({
          previousContent: 'Old content',
          // Missing currentContent
          documentId: 'test-doc-1'
        })
        .expect(400);
    });
  });

  describe('Cost Management', function () {
    it('should return cost usage report', async function () {
      const res = await request(app)
        .get('/api/cost/usage')
        .expect(200);
      
      expect(res.body).to.have.property('totalCost');
      expect(res.body).to.have.property('requestCount');
      expect(res.body).to.have.property('budgetRemaining');
    });
  });
});