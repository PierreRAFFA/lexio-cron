#!/usr/bin/env node
/**
 * Updates the ranking and updates the user.statistics.ranking
 */

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

const argv = require('yargs').argv;
const LANGUAGE = argv.language;

console.log(`updateOverallRanking ${LANGUAGE}`);
///////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////
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

startJob(LANGUAGE)
  .then(() => {
    authenticationDb.close();
    gameDb.close();
    console.log(`updateOverallRanking ${LANGUAGE} Done !`);
  })
  .catch(err => {
    console.log(`updateOverallRanking ${LANGUAGE} Error !`);
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
  return new Promise((resolve, reject) => {
    MongoClient.connect(url , (err, db) => {
      assert.equal(null, err);
      if (err) {
        reject(err);
      }else{
        resolve(db);
      }
    });
  });
}

/////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////// GET RANKING FROM GAMES
/**
 * Returns the sorted games by score with userId
 */
function aggregateGames(language) {
  return new Promise((resolve, reject) => {
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
        userId: { $first: "$userId" }
      }
    }, {
      $sort: { score: -1 }
    }], (err, items) => {
      if (err) {
        reject(err);
      } else {
        resolve(items);
      }
    });
  });
}

/**
 * Populates user field in the aggregateGames and updates the user ranking
 * @param aggregateGames
 * @param language
 * @returns {Promise.<TResult>}
 */
function populateUserInAggregateGames(aggregateGames, language) {
  return new Promise((resolve, reject) => {

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
              'password', 'accessToken', 'email', 'balance', 'firebaseToken',
            ])
          ));
          updateUserOverallRanking(gameUser, index + 1, language);
        }
        delete aggregateGame.userId;
        return aggregateGame;
      });

      games = filter(games, game => 'user' in game);
      resolve(games);
    });
  });
}

/**
 * Returns the user list
 * @param userIds
 */
function getUsers(userIds) {
  return new Promise((resolve, reject) => {

    if (!userIds || userIds.length === 0) {
      resolve([]);
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
          reject(err);
        } else {
          resolve(map(users, user => omit(user, 'identities[0].credentials', 'identities[0].profile.id', 'identities[0].profile.emails', 'identities[0].profile._raw', 'identities[0].profile._json', 'identities[0].profile.name', 'identities[0].profile.displayName')));
        }
      });
    }
  });
}


/**
 * Returns the current ranking (ranking still opened)
 * May return undefined if no ranking has been found at all
 * or no opened ranking has been found (ranking is expired because of the endDate)
 */
function getCurrentRanking(language) {
  return new Promise((resolve, reject) => {
    const rankingCollection = gameDb.collection('ranking');

    rankingCollection.find({status: 'overall', language: language}).limit(1).toArray((err, rankings) => {
      if(err) {
        reject(err);
      } else {
        resolve(head(rankings));
      }
    });
  });
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
  return new Promise((resolve, reject) => {

    const rankingCollection = gameDb.collection('ranking');

    return getCurrentRanking(language).then(currentRanking => {
      if (!currentRanking) {
        //means no ranking saved yet or no ranking for the current date
        rankingCollection.insertOne({
          ranking: rankingContent,
          language: language,
          status: 'overall', // default is open
        }, (err, result) => {
          if(err) {
            reject(err);
          }else{
            resolve(rankingContent);
          }
        });
      }else{
        rankingCollection.updateOne({_id: currentRanking._id}, { $set: { ranking: rankingContent }}, (err, result) => {
          if(err) {
            reject(err);
          }else{
            resolve(rankingContent);
          }
        });
      }
    });
  });
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
    user.statistics[language].overallRanking = ranking;

    const userCollection = authenticationDb.collection('user');
    userCollection.save(user);
  }
}
