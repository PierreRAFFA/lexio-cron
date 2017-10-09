#!/usr/bin/env node
/**
 * Closes the ranking and then updates every user.statistics.highestRanking
 */
console.log('closeCurrentRanking');
const MongoClient = require('mongodb').MongoClient;
const ObjectID = require('mongodb').ObjectID;
const assert = require('assert');
const moment = require('moment');
const forEach = require('lodash/forEach');
const map = require('lodash/map');
const uniq = require('lodash/uniq');
const indexOf = require('lodash/indexOf');
const filter = require('lodash/filter');
const head = require('lodash/head');
const omit = require('lodash/omit');
const get = require('lodash/get');
///////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////
const LANGUAGES = ['en_GB', 'fr_FR'];
///////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////
// Connection URL
const authenticationMongo = require('../config')(process.env.NODE_ENV).authentication;
const gameMongo = require('../config')(process.env.NODE_ENV).game;

console.log('===================');
console.log(authenticationMongo);
console.log(gameMongo);
console.log('===================');
///////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////
let authenticationDb;
let gameDb;

startJob()
.then(() => {
  authenticationDb.close();
  gameDb.close();
  console.log('Ranking Closed Done !');
})
.catch(err => {
  console.log('Ranking Closed Error !');
  console.error(err);
  authenticationDb.close();
  gameDb.close();
});

/////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////// START
function startJob() {
  let currentRanking;
  return connectToDatabases()
  .then(() => {
    return getCurrentRanking();
  })
  .then(instance => {
    currentRanking = instance;
    closeRanking(currentRanking);
  })
  .then(() => {
    return updateUsersRanking(currentRanking);
  })
}
/////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////// DATABASE CONNECTION
/**
 * Connects to all databases needed for this job
 * @returns {Promise.<TResult>}
 */
function connectToDatabases() {
  return connectToDatabase(authenticationMongo)
  .then(db => {
    authenticationDb = db;
  })
  .then(() => {
    return connectToDatabase(gameMongo)
  })
  .then(db => {
    gameDb = db;
  })
  .catch(err => {
    console.error(err);
  })
}

function connectToDatabase(url) {
  const defer = Promise.defer();

  MongoClient.connect(url , (err, db) => {
    assert.equal(null, err);

    if (err) {
      defer.reject(err);
    }else{
      defer.resolve(db);
    }
  });

  return defer.promise;
}
/////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////// RANKING
/**
 * Returns the current ranking
 * May return undefined if no ranking has been found at all
 * or no opened ranking has been found (ranking is expired because of the endDate)
 */
function getCurrentRanking() {
  const defer = Promise.defer();
  const rankingCollection = gameDb.collection('ranking');

  rankingCollection.find({status: 'open'}).toArray((err, rankings) => {
    if(err) {
      defer.reject(err);
    }else{
      defer.resolve(head(rankings));
    }
  });
  return defer.promise;
}

/**
 * Saves the ranking in the database
 *
 * @param currentRanking
 */
function closeRanking(currentRanking) {
  const rankingCollection = gameDb.collection('ranking');

  currentRanking.status = 'done';
  rankingCollection.save(currentRanking);
}

/////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////
function updateUsersRanking(ranking) {
  const rankingUsers = ranking.ranking;
  console.dir(rankingUsers);
  const userIds = map(rankingUsers, rankingUser => rankingUser.user._id);
  console.log(userIds);

  return getUsers(userIds).then(instances => {
    forEach(instances, (instance, index) => {
      updateUserRanking(instance, index + 1, 'en_GB')
    });
  });
}

/**
 * Updates the user statistics
 *
 * @param user
 * @param ranking
 * @param language
 */
function updateUserRanking(user, ranking, language) {
  if (user.statistics[language]) {
    console.log('set ranking to ' + ranking);

    var highestRanking;
    if (isNaN(user.statistics[language].highestRanking)) {
      highestRanking = user.statistics[language].ranking;
    } else {
      highestRanking = Math.min(
        user.statistics[language].highestRanking,
        user.statistics[language].ranking
      );
    }
    user.statistics[language].highestRanking = highestRanking;

    const userCollection = authenticationDb.collection('user');
    userCollection.save(user);
  }
}

/////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////  UPDATE USERS
/**
 * Returns the user list
 * @param userIds
 */
function getUsers(userIds) {
  const defer = Promise.defer();

  if (!userIds || userIds.length === 0) {
    defer.resolve([]);
  } else {
    // db.user.aggregate([{$match: { $or: [{"_id": ObjectId("59a45abd5a483602c777df40")},
    // {_id:ObjectId("59a409d4d31674002598833a")}] }},
    // {"$lookup": {"from":"userIdentity","localField":"_id","foreignField":"userId","as":"test"}}])
    const userCollection = authenticationDb.collection('user');
    userCollection.aggregate([{
      $match: {
        $or: map(userIds, id => ({ _id: new ObjectID(id) }))
      }
    }, {
      $lookup: {
        from: 'userIdentity',
        localField: '_id',
        foreignField: 'userId',
        as: 'identities'
      }
    }], (err, users) => {
      if (err) {
        defer.reject(err);
      } else {
        defer.resolve(users);
      }
    });
  }
  return defer.promise;
}

