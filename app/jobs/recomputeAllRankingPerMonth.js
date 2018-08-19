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

console.log(`updateRanking ${LANGUAGE}`);

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

(async () => {
  try {
    await startJob(LANGUAGE);

    authenticationDb.close();
    gameDb.close();
    console.log(`updateRanking ${LANGUAGE} Done !`);
  }catch (e) {
    console.log(`updateRanking ${LANGUAGE} Error !`);
    console.error(e);
    authenticationDb.close();
    gameDb.close();
  }
})();

/////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////// START
async function startJob(language) {
  await connectToDatabases();

  const totalMonths = 10;

  const month = moment().month() + 1;
  const year = moment().year();

  console.log('before loop');
  for(var i = totalMonths; i >= 0; i--) {
    const currentMonth = moment(`${year}-${month}`, "YYYY-MM").subtract(i, 'months');

    const startDate = new Date(currentMonth);
    const endDate = new Date(currentMonth.endOf('month'));
    const reference = `${currentMonth.year()}-${currentMonth.month() + 1}`;
    const status = i === 0 ? 'open' : 'done';
    console.log('COMPUTING RANKING for', startDate, endDate);
    console.log('status', status);
    console.log('reference', reference);

    //compute ranking
    const aggregateGames = await computeRankingForMonth(language, startDate, endDate);
    const ranking = await populateUserInAggregateGames(aggregateGames, language);

    //save ranking
    await saveRanking(ranking, language, startDate, endDate, status, reference);

    console.log(ranking);
    console.log("============");
  }
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
///////////////////////////////////////////////////////
async function computeRankingForMonth(language, startDate, endDate) {

  console.log(startDate)
  console.log(endDate)
  const gameCollection = gameDb.collection('game');

  return new Promise((resolve, reject) => {

    gameCollection.aggregate([{
      $match: {
        $and: [
          { language: language },
          { creationDate: { $gt: startDate, $lt: endDate } },
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
      const populated = map(aggregateGames, (aggregateGame, index) => {
        //set the game user
        const gameUser = head(filter(users, user => user._id.toString() === aggregateGame.userId));
        if(gameUser) {
          aggregateGame.user = JSON.parse(JSON.stringify(
            omit(gameUser, [
              'password', 'accessToken', 'email', 'balance', 'firebaseToken',
            ])
          ));
        }
        delete aggregateGame.userId;
        return aggregateGame;
      });
      resolve(populated);
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
function saveRanking(rankingContent, language, startDate, endDate, status, reference) {
  return new Promise((resolve, reject) => {

    const rankingCollection = gameDb.collection('ranking');

    rankingCollection.updateOne({reference}, { $set: {
      ranking: rankingContent,
      reference,
      language,
      status,
      startDate,
      endDate
    }}, {upsert: true}, (err, result) => {
      if(err) {
        reject(err);
      }else{
        resolve(rankingContent);
      }
    });
  });
}
