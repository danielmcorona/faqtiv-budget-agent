const Mongo = require('mongodb');

function getMongoClient() {
  return Mongo.MongoClient.connect('mongodb://root:password@localhost:27017/budgetDB?authSource=admin');
}

