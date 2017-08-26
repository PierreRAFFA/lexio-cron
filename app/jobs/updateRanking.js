#!/usr/bin/env node
console.log('updateRanking');
const MongoClient = require('mongodb').MongoClient;
const ObjectID = require('mongodb').ObjectID;
const assert = require('assert');
const PromiseSeries = require('promise-series-advanced');
const moment = require('moment');
const forEach = require('lodash/forEach');
const map = require('lodash/map');
const uniq = require('lodash/uniq');
const indexOf = require('lodash/indexOf');
const filter = require('lodash/filter');
const head = require('lodash/head');
const omit = require('lodash/omit');
///////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////
const MAX_BALANCE = 5;
const LANGUAGES = ['en_GB', 'fr_FR'];
const RANKING_DAY_DURATION = 14;
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

startJob('en_GB')
  .then(() => {
    authenticationDb.close();
    gameDb.close();
  })
  .catch(err => {
    console.error(err);
    authenticationDb.close();
    gameDb.close();
  });
/////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////// START
function startJob(language) {
  return connectToDatabases()
    .then(() => {
      return aggregateGames(language);
    })
    .then(aggregateGames => {
      return populateUserInAggregateGames(aggregateGames, language);
    })
    .then(ranking => {
      return saveRanking(ranking, language);
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
/////////////////////////////////////////////////////// GET RANKING FROM GAMES
/**
 * Returns the sorted games by score with userId
 */
function aggregateGames(language) {
  const defer = Promise.defer();

  const gameCollection = gameDb.collection('game');
  gameCollection.aggregate([{
    $match: { language: language }
  }, {
    $group: {
      _id: "$userId",
      score: { $max: "$score" },
      userId: { $first: "$userId"}
    }
  }, {
    $sort: { score: -1 }
  }], (err, items) => {
    if (err) {
      defer.reject(err);
    } else {
      defer.resolve(items);
    }
  });

  return defer.promise;
}

/**
 * Populates user field in the aggregateGames and updates the user ranking
 * @param aggregateGames
 * @param language
 * @returns {Promise.<TResult>}
 */
function populateUserInAggregateGames(aggregateGames, language) {
  const defer = Promise.defer();

  const userIds = map(aggregateGames, game => {
    return game._id;
  });
  console.log(userIds);
  return getUsers(userIds).then(users => {
    return map(aggregateGames, (aggregateGame, index) => {
      //set the game user
      const gameUser = head(filter(users, user => user._id.toString() === aggregateGame.userId));
      if(gameUser) {
        aggregateGame.user = JSON.parse(JSON.stringify(
          omit(gameUser, [
            'password', 'accessToken', 'email', 'statistics', 'balance', 'firebaseToken',
            'profile.id', 'profile.provider', 'profile.name', 'profile.gender', 'profile.emails', 'profile._raw', 'profile._json'
          ])
        ));
        updateUserRanking(gameUser, index + 1, language);
      }
      delete aggregateGame.userId;
      return aggregateGame;
    });
  });

  return defer.promise;
}

/**
 * Returns the user list
 * @param userIds
 */
function getUsers(userIds) {
  const defer = Promise.defer();
  const userCollection = authenticationDb.collection('user');
  userCollection.find({ _id: { $in: map(userIds, id => new ObjectID(id)) }})
  .toArray((err, users) => {
    if(err) {
      defer.reject(err);
    }else{
      defer.resolve(users);
    }
  });
  return defer.promise;
}
/////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////// SAVE
/**
 * Saves the ranking in the database
 * @param ranking
 * @returns {Promise.<TResult>}
 */
function saveRanking(ranking) {
  const defer = Promise.defer();

  return getCurrentRanking().then(currentRanking => {
    console.log(currentRanking);
    const rankingCollection = gameDb.collection('ranking');

    //means no ranking saved yet or no ranking for the current date
    if(!currentRanking) {
      rankingCollection.insertOne({
        ranking: ranking,
        language: 'en_GB',
        startDate: new Date(),
        endDate: new Date(moment()
          .day(8) //next Monday + 7
          .set('hour', 0)
          .set('minute', 0)
          .set('second', 0)
          .set('millisecond', 0)
          .toISOString())
      }, (err, result) => {
        if(err) {
          defer.reject(err);
        }else{
          defer.resolve(ranking);
        }
      });
    }else{
      rankingCollection.updateOne({_id: currentRanking._id}, { $set: { ranking: ranking }}, (err, result) => {
        if(err) {
          defer.reject(err);
        }else{
          defer.resolve(ranking);
        }
      });
    }
  });

  return defer.promise;
}

/**
 * Returns the current ranking
 * May return undefined if no ranking has been found at all
 * or no opened ranking has been found (ranking is expired because of the endDate)
 */
function getCurrentRanking() {
  const defer = Promise.defer();
  const rankingCollection = gameDb.collection('ranking');

  rankingCollection.find({endDate: {$gt: new Date()}}).sort({endDate: -1}).limit(1).toArray((err, rankings) => {
    if(err) {
      defer.reject(err);
    }else{
      defer.resolve(head(rankings));
    }
  });
  return defer.promise;
}
/////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////  UPDATE USERS
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
    user.statistics[language].ranking = ranking;

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
