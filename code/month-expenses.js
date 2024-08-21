/**
* DEPENDENCIES
* Warning: these are extracted from your function files, if you need to make changes edit the function file and recompile this task.
 */

const Mongo = require('mongodb');
    
/**
* LIBRARY FUNCTIONS
* Warning: these are common functions, if you need to make changes edit the function file and recompile this task.
 */

function getMongoClient() {
  return Mongo.MongoClient.connect('mongodb://root:password@localhost:27017/budgetDB?authSource=admin');
}
/**
* PUBLIC FUNCTIONS
* Warning: these are common functions, if you need to make changes edit the function file and recompile this task.
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

async function getFinancialCategories() {
  const client = await getMongoClient();
  try {
    const db = client.db();
    return await db.collection('categories').find().toArray();
  } finally {
    await client.close();
  }
}

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

function formatCurrencyAmount(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(parseFloat(amount));
}

function calculateDaysBetweenDates(date1, date2) {
  const diffTime = Math.abs(new Date(date2) - new Date(date1));
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)).toString();
}

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
/**
* GENERATED CODE
* This function is the generated code: it's safe to edit.
 */

async function doTask() {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const startDate = firstDayOfMonth.toISOString().split('T')[0];
    const endDate = lastDayOfMonth.toISOString().split('T')[0];

    const expenses = await getFinancialTransactions(startDate, endDate, 'expense', '', '', '', 'asc', '1000', '0');

    const result = {
        expenses
    };

    process.stdout.write(JSON.stringify(result));
}