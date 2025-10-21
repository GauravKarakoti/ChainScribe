export class CostManager {
  constructor() {
    this.dailyBudget = parseFloat(process.env.DAILY_BUDGET) || 100; // Example budget in $
    this.usageToday = 0;
    this.requestLog = [];
    this.costSavingMode = false;

    // *** Define rates for PREDEFINED models ***
    // Replace these with actual rates from 0G documentation or provider
    this.modelRates = {
      'phala/gpt-oss-120b': { input: 0.0000002, output: 0.000001 }, // Example: $/char (adjust if token-based)
      'default-fallback': { input: 0.0000002, output: 0.000001 }    // Fallback if model not listed
      // Add other predefined models you might use
      // 'another-model-id': { input: X, output: Y },
    };
    console.log(`💰 Cost Manager initialized. Daily budget: $${this.dailyBudget.toFixed(2)}`);
  }

  // Calculates cost based on *character length* as a proxy for tokens.
  // For accurate token-based costing, you'd need a tokenizer.
  calculateCost(modelId, inputLength, outputLength) {
    const rates = this.modelRates[modelId] || this.modelRates['default-fallback'];
    if (!rates) {
      console.warn(`⚠️ No cost rates found for model ${modelId}. Using fallback.`);
      // Fallback logic could return 0 or use default rates
      return (inputLength * this.modelRates['default-fallback'].input) + (outputLength * this.modelRates['default-fallback'].output);
    }
    const cost = (inputLength * rates.input) + (outputLength * rates.output);
    return cost;
  }


  async trackRequest(modelId, inputLength, outputLength = 0) {
    const cost = this.calculateCost(modelId, inputLength, outputLength);

    // Budget check: Throw error if adding this cost exceeds 90% of the budget
    const budgetThreshold = this.dailyBudget * 0.9;
    if (this.usageToday + cost > budgetThreshold && this.dailyBudget > 0) { // Check if budget > 0
        this.enableCostSavingMode(); // Enable cost saving mode regardless
        // Only throw error if cost saving mode didn't prevent exceeding budget (or if it's already full)
        if (this.usageToday + cost > this.dailyBudget) {
            console.error(`🚨 Daily budget exceeded. Current: $${this.usageToday.toFixed(4)}, Attempted add: $${cost.toFixed(4)}, Budget: $${this.dailyBudget.toFixed(2)}`);
            throw new Error(`Daily budget limit ($${this.dailyBudget.toFixed(2)}) reached. Cannot process request.`);
        } else {
             console.warn(`⚠️ Approaching daily budget limit. Current: $${this.usageToday.toFixed(4)}`);
        }
    }

    this.usageToday += cost;
    this.requestLog.push({
      serviceType: modelId, // Log the actual model ID used
      cost,
      timestamp: Date.now(),
      inputLength,
      outputLength
    });

    console.log(`💰 Cost tracked for ${modelId}: $${cost.toFixed(6)} | Total today: $${this.usageToday.toFixed(4)}`);

    // Return the calculated cost for this request
    return cost;
  }


  enableCostSavingMode() {
    if (!this.costSavingMode) {
      console.warn('⚠️ Cost saving mode enabled (approaching daily budget). Future requests might be throttled or rejected.');
      this.costSavingMode = true;
      // Implement logic here if needed, e.g., use cheaper models, reduce frequency
    }
  }

  getDailyReport() {
    const today = new Date().toDateString();
    // Filter requests strictly for today
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const todayRequests = this.requestLog.filter(req => req.timestamp >= startOfToday);

    // Recalculate usageToday based on filtered requests for accuracy if needed,
    // though the running total should be correct if resetDailyUsage is used properly.
    // this.usageToday = todayRequests.reduce((sum, req) => sum + req.cost, 0);

    const requestsByType = todayRequests.reduce((acc, req) => {
      acc[req.serviceType] = (acc[req.serviceType] || 0) + 1;
      return acc;
    }, {});

    const budgetRemaining = Math.max(0, this.dailyBudget - this.usageToday); // Ensure remaining isn't negative

    return {
      date: today,
      totalCost: parseFloat(this.usageToday.toFixed(6)), // Use more precision for cost
      requestCount: todayRequests.length,
      requestsByType,
      budgetRemaining: parseFloat(budgetRemaining.toFixed(4)),
      costSavingMode: this.costSavingMode,
      dailyBudget: this.dailyBudget
    };
  }

  // Call this function periodically (e.g., via a cron job or at server start if running < 24h)
  resetDailyUsage() {
    const now = new Date();
    // Example: Reset if the current date string doesn't match the last log entry's date string
    const lastLogDate = this.requestLog.length > 0 ? new Date(this.requestLog[this.requestLog.length - 1].timestamp).toDateString() : null;

    if (lastLogDate && lastLogDate !== now.toDateString()) {
        console.log(`🔄 Resetting daily cost usage for new day: ${now.toDateString()}`);
        this.usageToday = 0;
        this.costSavingMode = false;
        // Optionally clear or archive the requestLog here
        // this.requestLog = [];
    } else if (!lastLogDate) {
         // Initial reset or reset after empty log
         this.usageToday = 0;
         this.costSavingMode = false;
    }
  }
}