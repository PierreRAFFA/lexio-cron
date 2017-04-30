#!/usr/bin/env node

var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');

// Connection URL
var url = require('../config')(process.env.NODE_ENV);
console.log(url);

MongoClient.connect(url, (err, db) => {
  assert.equal(null, err);

  var userCollection = db.collection('user');

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