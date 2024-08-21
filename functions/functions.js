const Mongo = require('mongodb');

/**
 * Adds a new financial transaction to the database.
 * @param {string} amount - The transaction amount as a string (e.g., "123.45").
 * @param {'income'|'expense'} type - The type of transaction.
 * @param {string} category - The category of the transaction.
 * @param {string} description - A description of the transaction.
 * @param {string} date - The date of the transaction in ISO 8601 format (YYYY-MM-DD).
 * @param {string} [memberId] - The ID of the household member associated with the transaction.
 * @returns {Promise<string>} The ID of the newly added transaction.
 */
async function addFinancialTransaction(amount, type, category, description, date, memberId) {
  const client = await getMongoClient();
  try {
    const db = client.db();
    const result = await db.collection('transactions').insertOne({
      amount: parseFloat(amount),
      type,
      category,
      description,
      date: new Date(date),
      memberId
    });
    return result.insertedId.toString();
  } finally {
    await client.close();
  }
}

/**
 * Updates an existing financial transaction in the database.
 * @param {string} id - The ID of the transaction to update.
 * @param {string} [amount] - The updated transaction amount as a string (e.g., "123.45").
 * @param {'income'|'expense'} [type] - The updated type of transaction.
 * @param {string} [category] - The updated category of the transaction.
 * @param {string} [description] - The updated description of the transaction.
 * @param {string} [date] - The updated date of the transaction in ISO 8601 format (YYYY-MM-DD).
 * @param {string} [memberId] - The updated ID of the household member associated with the transaction.
 * @returns {Promise<boolean>} True if the update was successful, false otherwise.
 */
async function updateFinancialTransaction(id, amount, type, category, description, date, memberId) {
  const client = await getMongoClient();
  try {
    const db = client.db();
    const updates = {};
    if (amount) updates.amount = parseFloat(amount);
    if (type) updates.type = type;
    if (category) updates.category = category;
    if (description) updates.description = description;
    if (date) updates.date = new Date(date);
    if (memberId) updates.memberId = memberId;

    const result = await db.collection('transactions').updateOne(
      { _id: new Mongo.ObjectId(id) },
      { $set: updates }
    );
    return result.modifiedCount > 0;
  } finally {
    await client.close();
  }
}

/**
 * Deletes a financial transaction from the database.
 * @param {string} id - The ID of the transaction to delete.
 * @returns {Promise<boolean>} True if the deletion was successful, false otherwise.
 */
async function deleteFinancialTransaction(id) {
  const client = await getMongoClient();
  try {
    const db = client.db();
    const result = await db.collection('transactions').deleteOne({ _id: new Mongo.ObjectId(id) });
    return result.deletedCount > 0;
  } finally {
    await client.close();
  }
}

/**
 * Retrieves financial transactions based on specified filters.
 * @param {string} [startDate] - The start date for filtering transactions in ISO 8601 format (YYYY-MM-DD).
 * @param {string} [endDate] - The end date for filtering transactions in ISO 8601 format (YYYY-MM-DD).
 * @param {'income'|'expense'} [type] - The type of transactions to retrieve.
 * @param {string} [category] - The category of transactions to retrieve.
 * @param {string} [memberId] - The ID of the household member whose transactions to retrieve.
 * @param {string} [sortBy] - Field to sort by (e.g., "date", "amount").
 * @param {'asc'|'desc'} [sortOrder] - Sort order, either "asc" or "desc".
 * @param {string} [limit] - Maximum number of results to return as a string (e.g., "10").
 * @param {string} [skip] - Number of results to skip as a string (e.g., "20").
 * @returns {Promise<Array<{id: string, amount: string, type: string, category: string, description: string, date: string, memberId: string}>>} An array of transactions matching the filters.
 */
async function getFinancialTransactions(startDate, endDate, type, category, memberId, sortBy, sortOrder, limit, skip) {
  const client = await getMongoClient();
  try {
    const db = client.db();
    const filters = {};
    if (startDate) filters.date = { $gte: new Date(startDate) };
    if (endDate) filters.date = { ...filters.date, $lte: new Date(endDate) };
    if (type) filters.type = type;
    if (category) filters.category = category;
    if (memberId) filters.memberId = memberId;

    const options = {};
    if (sortBy) options.sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };
    if (limit) options.limit = parseInt(limit);
    if (skip) options.skip = parseInt(skip);

    return await db.collection('transactions')
      .find(filters)
      .sort(options.sort || {})
      .limit(options.limit || 0)
      .skip(options.skip || 0)
      .toArray();
  } finally {
    await client.close();
  }
}

/**
 * Updates or creates a budget plan for a specific period.
 * @param {string} startDate - The start date of the budget period in ISO 8601 format (YYYY-MM-DD).
 * @param {string} endDate - The end date of the budget period in ISO 8601 format (YYYY-MM-DD).
 * @param {string} categories - A JSON string representing an array of budget categories and their amounts (e.g., '[{"category":"groceries","amount":"300.00"},{"category":"rent","amount":"1000.00"}]').
 * @returns {Promise<string>} The ID of the updated or created budget.
 */
async function updateBudgetPlan(startDate, endDate, categories) {
  const client = await getMongoClient();
  try {
    const db = client.db();
    const budget = {
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      categories: JSON.parse(categories)
    };

    const result = await db.collection('budgets').updateOne(
      { startDate: budget.startDate, endDate: budget.endDate },
      { $set: budget },
      { upsert: true }
    );
    return result.upsertedId ? result.upsertedId.toString() : budget._id.toString();
  } finally {
    await client.close();
  }
}

/**
 * Retrieves the budget plan for a specific date range.
 * @param {string} startDate - The start date of the budget period in ISO 8601 format (YYYY-MM-DD).
 * @param {string} endDate - The end date of the budget period in ISO 8601 format (YYYY-MM-DD).
 * @returns {Promise<{id: string, startDate: string, endDate: string, categories: Array<{category: string, amount: string}>}|null>} The budget object if found, null otherwise.
 */
async function getBudgetPlan(startDate, endDate) {
  const client = await getMongoClient();
  try {
    const db = client.db();
    return await db.collection('budgets').findOne({
      startDate: { $lte: new Date(endDate) },
      endDate: { $gte: new Date(startDate) }
    });
  } finally {
    await client.close();
  }
}

/**
 * Updates or creates a financial goal.
 * @param {string} description - A description of the goal.
 * @param {string} targetAmount - The target amount for the goal as a string (e.g., "10000.00").
 * @param {string} targetDate - The target date for achieving the goal in ISO 8601 format (YYYY-MM-DD).
 * @param {string} currentAmount - The current amount saved towards the goal as a string (e.g., "5000.00").
 * @param {'ongoing'|'completed'|'cancelled'} status - The current status of the goal.
 * @returns {Promise<string>} The ID of the updated or created goal.
 */
async function updateFinancialGoal(description, targetAmount, targetDate, currentAmount, status) {
  const client = await getMongoClient();
  try {
    const db = client.db();
    const goal = {
      description,
      targetAmount: parseFloat(targetAmount),
      targetDate: new Date(targetDate),
      currentAmount: parseFloat(currentAmount),
      status
    };

    const result = await db.collection('financialGoals').updateOne(
      { _id: goal._id ? new Mongo.ObjectId(goal._id) : new Mongo.ObjectId() },
      { $set: goal },
      { upsert: true }
    );
    return result.upsertedId ? result.upsertedId.toString() : goal._id.toString();
  } finally {
    await client.close();
  }
}

/**
 * Retrieves financial goals based on specified filters.
 * @param {'ongoing'|'completed'|'cancelled'} [status] - Filter goals by status.
 * @param {string} [targetDateBefore] - Filter goals with target date before this date in ISO 8601 format (YYYY-MM-DD).
 * @param {string} [targetDateAfter] - Filter goals with target date after this date in ISO 8601 format (YYYY-MM-DD).
 * @returns {Promise<Array<{id: string, description: string, targetAmount: string, targetDate: string, currentAmount: string, status: string}>>} An array of financial goals matching the filters.
 */
async function getFinancialGoals(status, targetDateBefore, targetDateAfter) {
  const client = await getMongoClient();
  try {
    const db = client.db();
    const filters = {};
    if (status) filters.status = status;
    if (targetDateBefore) filters.targetDate = { $lte: new Date(targetDateBefore) };
    if (targetDateAfter) filters.targetDate = { ...filters.targetDate, $gte: new Date(targetDateAfter) };

    return await db.collection('financialGoals').find(filters).toArray();
  } finally {
    await client.close();
  }
}

/**
 * Updates a household member's financial information.
 * @param {string} memberId - The ID of the household member to update.
 * @param {string} [income] - The updated income of the household member as a string (e.g., "50000.00").
 * @param {string} [incomeStreams] - A JSON string representing an array of income streams (e.g., '["salary","investments"]').
 * @param {string} [expenses] - A JSON string representing an array of regular expenses (e.g., '["rent","utilities"]').
 * @param {string} [financialGoals] - A JSON string representing an array of financial goal IDs (e.g., '["goal1","goal2"]').
 * @returns {Promise<boolean>} True if the update was successful, false otherwise.
 */
async function updateHouseholdMemberFinances(memberId, income, incomeStreams, expenses, financialGoals) {
  const client = await getMongoClient();
  try {
    const db = client.db();
    const updates = {};
    if (income) updates.income = parseFloat(income);
    if (incomeStreams) updates.incomeStreams = JSON.parse(incomeStreams);
    if (expenses) updates.expenses = JSON.parse(expenses);
    if (financialGoals) updates.financialGoals = JSON.parse(financialGoals);

    const result = await db.collection('household').updateOne(
      { 'members._id': new Mongo.ObjectId(memberId) },
      { $set: { 'members.$': updates } }
    );
    return result.modifiedCount > 0;
  } finally {
    await client.close();
  }
}

/**
 * Retrieves household members' financial information based on specified filters.
 * @param {string} [minIncome] - Minimum income threshold for filtering members as a string (e.g., "30000.00").
 * @param {string} [maxIncome] - Maximum income threshold for filtering members as a string (e.g., "100000.00").
 * @param {string} [incomeStream] - Filter members by a specific income stream.
 * @returns {Promise<Array<{id: string, name: string, income: string, incomeStreams: Array<string>, expenses: Array<string>, financialGoals: Array<string>}>>} An array of household members' financial data matching the filters.
 */
async function getHouseholdMembersFinancialData(minIncome, maxIncome, incomeStream) {
  const client = await getMongoClient();
  try {
    const db = client.db();
    const filters = {};
    if (minIncome) filters['members.income'] = { $gte: parseFloat(minIncome) };
    if (maxIncome) filters['members.income'] = { ...filters['members.income'], $lte: parseFloat(maxIncome) };
    if (incomeStream) filters['members.incomeStreams'] = incomeStream;

    return await db.collection('household').findOne(filters, { projection: { members: 1 } })
      .then(result => result ? result.members : []);
  } finally {
    await client.close();
  }
}

/**
 * Calculates the total amount for financial transactions matching given filters.
 * @param {string} [startDate] - The start date for filtering transactions in ISO 8601 format (YYYY-MM-DD).
 * @param {string} [endDate] - The end date for filtering transactions in ISO 8601 format (YYYY-MM-DD).
 * @param {'income'|'expense'} [type] - The type of transactions to include in the calculation.
 * @param {string} [category] - The category of transactions to include in the calculation.
 * @param {string} [memberId] - The ID of the household member whose transactions to include.
 * @returns {Promise<string>} The total amount of matching transactions as a string (e.g., "1234.56").
 */
async function calculateTotalAmount(startDate, endDate, type, category, memberId) {
  const client = await getMongoClient();
  try {
    const db = client.db();
    const filters = {};
    if (startDate) filters.date = { $gte: new Date(startDate) };
    if (endDate) filters.date = { ...filters.date, $lte: new Date(endDate) };
    if (type) filters.type = type;
    if (category) filters.category = category;
    if (memberId) filters.memberId = memberId;

    const result = await db.collection('transactions').aggregate([
      { $match: filters },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]).toArray();
    return result.length > 0 ? result[0].total.toString() : '0';
  } finally {
    await client.close();
  }
}

/**
 * Groups financial transactions by a specified field and calculates totals.
 * @param {string} [startDate] - The start date for filtering transactions in ISO 8601 format (YYYY-MM-DD).
 * @param {string} [endDate] - The end date for filtering transactions in ISO 8601 format (YYYY-MM-DD).
 * @param {'income'|'expense'} [type] - The type of transactions to include in the grouping.
 * @param {'category'|'memberId'} groupBy - Field to group by.
 * @returns {Promise<Array<{groupValue: string, total: string}>>} Array of grouped totals.
 */
async function groupFinancialTransactions(startDate, endDate, type, groupBy) {
  const client = await getMongoClient();
  try {
    const db = client.db();
    const filters = {};
    if (startDate) filters.date = { $gte: new Date(startDate) };
    if (endDate) filters.date = { ...filters.date, $lte: new Date(endDate) };
    if (type) filters.type = type;

    return await db.collection('transactions').aggregate([
      { $match: filters },
      { $group: { _id: `$${groupBy}`, total: { $sum: '$amount' } } },
      { $sort: { total: -1 } }
    ]).toArray();
  } finally {
    await client.close();
  }
}

/**
 * Retrieves all expense and income categories.
 * @returns {Promise<Array<{id: string, name: string, type: 'income'|'expense'}>>} An array of all financial transaction categories.
 */
async function getFinancialCategories() {
  const client = await getMongoClient();
  try {
    const db = client.db();
    return await db.collection('categories').find().toArray();
  } finally {
    await client.close();
  }
}

/**
 * Adds a new expense or income category.
 * @param {string} name - The name of the category to add.
 * @param {'income'|'expense'} type - The type of the category.
 * @returns {Promise<string>} The ID of the newly added category.
 */
async function addFinancialCategory(name, type) {
  const client = await getMongoClient();
  try {
    const db = client.db();
    const result = await db.collection('categories').insertOne({ name, type });
    return result.insertedId.toString();
  } finally {
    await client.close();
  }
}

/**
 * Updates an existing expense or income category.
 * @param {string} id - The ID of the category to update.
 * @param {string} [name] - The updated name of the category.
 * @param {'income'|'expense'} [type] - The updated type of the category.
 * @returns {Promise<boolean>} True if the update was successful, false otherwise.
 */
async function updateFinancialCategory(id, name, type) {
  const client = await getMongoClient();
  try {
    const db = client.db();
    const updates = {};
    if (name) updates.name = name;
    if (type) updates.type = type;

    const result = await db.collection('categories').updateOne(
      { _id: new Mongo.ObjectId(id) },
      { $set: updates }
    );
    return result.modifiedCount > 0;
  } finally {
    await client.close();
  }
}

/**
 * Deletes an expense or income category and its subcategories.
 * @param {string} id - The ID of the category to delete.
 * @returns {Promise<boolean>} True if the deletion was successful, false otherwise.
 */
async function deleteFinancialCategory(id) {
  const client = await getMongoClient();
  try {
    const db = client.db();
    const session = await db.startSession();
    session.startTransaction();
    try {
      // Delete the category
      await db.collection('categories').deleteOne({ _id: new Mongo.ObjectId(id) });
      // Delete all subcategories
      await db.collection('categories').deleteMany({ parentId: id });
      await session.commitTransaction();
      return true;
    } catch (error) {
      await session.abortTransaction();
      return false;
    } finally {
      session.endSession();
    }
  } finally {
    await client.close();
  }
}

/**
 * Suggests a financial category based on transaction description.
 * @param {string} description - The transaction description.
 * @returns {Promise<{category: string, confidence: string}>} An object containing the suggested category and confidence level as a string between "0" and "1".
 */
async function suggestFinancialCategory(description) {
  const client = await getMongoClient();
  try {
    const db = client.db();
    const categories = await getFinancialCategories();
    // Implement logic to suggest a category based on the description and existing categories
    // This could involve natural language processing or machine learning techniques
    // For simplicity, we'll use a basic keyword matching approach here

    let bestMatch = null;
    let highestConfidence = 0;

    for (const category of categories) {
      const keywords = category.keywords || [];
      const matchCount = keywords.filter(keyword => description.toLowerCase().includes(keyword.toLowerCase())).length;
      const confidence = matchCount / keywords.length;

      if (confidence > highestConfidence) {
        bestMatch = category;
        highestConfidence = confidence;
      }
    }

    if (bestMatch && highestConfidence > 0.5) {
      return { category: bestMatch.name, confidence: highestConfidence.toString() };
    } else {
      return { category: null, confidence: '0' };
    }
  } finally {
    await client.close();
  }
}

/**
 * Categorizes a financial transaction based on its description.
 * @param {string} description - The transaction description.
 * @returns {Promise<{category: string, isNewSuggestion: boolean}>} An object containing the category and whether it's a new suggestion.
 */
async function categorizeFinancialTransaction(description) {
  const client = await getMongoClient();
  try {
    const db = client.db();
    const suggestion = await suggestFinancialCategory(description);
    
    if (suggestion.category) {
      return { category: suggestion.category, isNewSuggestion: false };
    } else {
      // If no existing category matches well, suggest a new one
      const words = description.toLowerCase().split(' ');
      const potentialCategory = words.find(word => word.length > 3) || words[0]; // Simple heuristic
      return { category: potentialCategory, isNewSuggestion: true };
    }
  } finally {
    await client.close();
  }
}

/**
 * Formats a number as a currency string.
 * @param {string} amount - The amount to format as a string (e.g., "1234.56").
 * @returns {string} The formatted currency string (e.g., "$1,234.56").
 */
function formatCurrencyAmount(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(parseFloat(amount));
}

/**
 * Calculates the difference between two dates in days.
 * @param {string} date1 - The first date in ISO 8601 format (YYYY-MM-DD).
 * @param {string} date2 - The second date in ISO 8601 format (YYYY-MM-DD).
 * @returns {string} The number of days between the two dates as a string.
 */
function calculateDaysBetweenDates(date1, date2) {
  const diffTime = Math.abs(new Date(date2) - new Date(date1));
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)).toString();
}

/**
 * Calculates the average amount of financial transactions for a period.
 * @param {string} startDate - Start of the period in ISO 8601 format (YYYY-MM-DD).
 * @param {string} endDate - End of the period in ISO 8601 format (YYYY-MM-DD).
 * @param {'income'|'expense'|'all'} type - Type of transactions to include in the calculation.
 * @returns {Promise<{average: string, count: string}>} Object containing average amount and transaction count as strings.
 */
async function calculateAverageTransactionAmount(startDate, endDate, type = 'all') {
  const client = await getMongoClient();
  try {
    const db = client.db();
    const filters = { date: { $gte: new Date(startDate), $lte: new Date(endDate) } };
    if (type !== 'all') {
      filters.type = type;
    }

    const transactions = await getFinancialTransactions(startDate, endDate, type);
    const total = await calculateTotalAmount(startDate, endDate, type);
    const count = transactions.length;

    return {
      average: count > 0 ? (parseFloat(total) / count).toString() : '0',
      count: count.toString()
    };
  } finally {
    await client.close();
  }
}