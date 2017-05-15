#!/usr/bin/env node
console.log('updateRanking');
const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');

// Connection URL
const url = require('../config')(process.env.NODE_ENV);
console.log('===================');
console.log(url);
console.log('===================');

MongoClient.connect(url, (err, db) => {
  assert.equal(null, err);

  const userCollection = db.collection('user');

  userCollection.find({}, {"sort": [["statistics.en_GB.highestRankingScore", "desc"]]}).toArray((err, users) => {
    assert.equal(err, null);

    var ranking = 1;
    users.forEach( user => {

      if (user.statistics.en_GB) {
        user.statistics.en_GB.ranking = ranking++;

        var highestRanking;
        if (isNaN(user.statistics.en_GB.highestRanking)) {
          highestRanking = user.statistics.en_GB.ranking;
        }else{
          highestRanking = Math.min(
            user.statistics.en_GB.highestRanking,
            user.statistics.en_GB.ranking
          );
        }
        user.statistics.en_GB.highestRanking = highestRanking;

        userCollection.save(user);
      }
    });

    // console.log(new Date());
    db.close();
  });
});