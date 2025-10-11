export class CostManager {
  constructor() {
    this.dailyBudget = parseFloat(process.env.DAILY_BUDGET) || 100;
    this.usageToday = 0;
    this.requestLog = [];
    this.costSavingMode = false;
  }

  async trackRequest(serviceType, inputLength, outputLength = 0) {
    const cost = this.calculateCost(serviceType, inputLength, outputLength);
    
    // Check budget limits
    if (this.usageToday + cost > this.dailyBudget * 0.9) {
      this.enableCostSavingMode();
      throw new Error(`Daily budget limit reached. Current usage: $${this.usageToday.toFixed(2)}`);
    }

    this.usageToday += cost;
    this.requestLog.push({
      serviceType,
      cost,
      timestamp: Date.now(),
      inputLength,
      outputLength
    });

    console.log(`💰 Cost tracked: $${cost.toFixed(4)} | Total today: $${this.usageToday.toFixed(2)}`);

    return cost;
  }

  calculateCost(serviceType, inputTokens, outputTokens) {
    const modelRates = {
      'chainscribe-fast-1b': { input: 0.00001, output: 0.00002 },
      'chainscribe-balanced-3b': { input: 0.00003, output: 0.00006 },
      'chainscribe-docusense-v1': { input: 0.00005, output: 0.00010 },
      'chainscribe-change-analyzer': { input: 0.00002, output: 0.00004 }
    };

    const rates = modelRates[serviceType] || modelRates['chainscribe-balanced-3b'];
    return (inputTokens * rates.input) + (outputTokens * rates.output);
  }

  enableCostSavingMode() {
    if (!this.costSavingMode) {
      console.log('🔄 Enabling cost saving mode');
      this.costSavingMode = true;
    }
  }

  getDailyReport() {
    const today = new Date().toDateString();
    const todayRequests = this.requestLog.filter(req => 
      new Date(req.timestamp).toDateString() === today
    );

    const totalCost = todayRequests.reduce((sum, req) => sum + req.cost, 0);
    const requestsByType = todayRequests.reduce((acc, req) => {
      acc[req.serviceType] = (acc[req.serviceType] || 0) + 1;
      return acc;
    }, {});

    return {
      date: today,
      totalCost: parseFloat(totalCost.toFixed(4)),
      requestCount: todayRequests.length,
      requestsByType,
      budgetRemaining: parseFloat((this.dailyBudget - totalCost).toFixed(2)),
      costSavingMode: this.costSavingMode
    };
  }

  resetDailyUsage() {
    this.usageToday = 0;
    this.costSavingMode = false;
    console.log('🔄 Daily usage reset');
  }
}