#!/usr/bin/env node
/**
 * Updates the ranking and updates the user.statistics.ranking
 */
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
const get = require('lodash/get');
///////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////
const LANGUAGES = ['en', 'fr_FR'];
const RANKING_DAY_DURATION = 8;  //next Monday(1) + 7
///////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////
// Connection URL
const authenticationMongo = require('../config')(process.env.NODE_ENV).authentication;
const gameMongo = require('../config')(process.env.NODE_ENV).game;

///////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////
let authenticationDb;
let gameDb;

startJob('en')
  .then(() => {
    authenticationDb.close();
    gameDb.close();
    console.log('Update Overall Ranking Done !');
  })
  .catch(err => {
    console.log('Update Overall Ranking Error !');
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
    .then(rankingContent => {
      return saveRanking(rankingContent, language);
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
    $match: {
      $and: [
        { language: language },
      ]
    }
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
  return getUsers(userIds).then(users => {
    let games =  map(aggregateGames, (aggregateGame, index) => {
      //set the game user
      const gameUser = head(filter(users, user => user._id.toString() === aggregateGame.userId));
      if(gameUser) {
        aggregateGame.user = JSON.parse(JSON.stringify(
          omit(gameUser, [
            'password', 'accessToken', 'email', 'statistics', 'balance', 'firebaseToken',
          ])
        ));
        updateUserOverallRanking(gameUser, index + 1, language);
      }
      delete aggregateGame.userId;
      return aggregateGame;
    });

    games = filter(games, game => 'user' in game);
    return games;
  });

  return defer.promise;
}

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
        defer.resolve(map(users, user => omit(user, 'identities[0].credentials', 'identities[0].profile.id', 'identities[0].profile.emails', 'identities[0].profile._raw', 'identities[0].profile._json', 'identities[0].profile.name', 'identities[0].profile.displayName')));
      }
    });
  }
  return defer.promise;
}


/**
 * Returns the current ranking (ranking still opened)
 * May return undefined if no ranking has been found at all
 * or no opened ranking has been found (ranking is expired because of the endDate)
 */
function getCurrentRanking() {
  const defer = Promise.defer();
  const rankingCollection = gameDb.collection('ranking');

  rankingCollection.find({status: 'overall'}).limit(1).toArray((err, rankings) => {
    if(err) {
      defer.reject(err);
    } else {
      defer.resolve(head(rankings));
    }
  });
  return defer.promise;
}
/////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////// SAVE
/**
 * Saves the ranking in the database
 * Creates a new one if currentRanking is null
 *
 * @param currentRanking May be null
 * @param rankingContent
 * @param language not used yet
 * @returns {Promise.<TResult>}
 */
function saveRanking(rankingContent, language) {
  const defer = Promise.defer();

  const rankingCollection = gameDb.collection('ranking');

  return getCurrentRanking().then(currentRanking => {
    if (!currentRanking) {
      //means no ranking saved yet or no ranking for the current date
      rankingCollection.insertOne({
        ranking: rankingContent,
        language: 'en',
        status: 'overall', // default is open
      }, (err, result) => {
        if(err) {
          defer.reject(err);
        }else{
          defer.resolve(rankingContent);
        }
      });
    }else{
      rankingCollection.updateOne({_id: currentRanking._id}, { $set: { ranking: rankingContent }}, (err, result) => {
        if(err) {
          defer.reject(err);
        }else{
          defer.resolve(rankingContent);
        }
      });
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
function updateUserOverallRanking(user, ranking, language) {
  if (user.statistics[language]) {
    user.statistics[language].overallrRanking = ranking;

    const userCollection = authenticationDb.collection('user');
    userCollection.save(user);
  }
}
