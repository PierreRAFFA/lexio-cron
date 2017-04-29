#!/usr/bin/env node

console.log('execJob => updateRanking');

var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');

// Connection URL
var url = 'mongodb://mongo:27017/wordz-dev1';


MongoClient.connect(url, function(err, db) {
  assert.equal(null, err);
  console.log("Connected correctly to server");

  var userCollection = db.collection('user');

  userCollection.find({}, {"sort": [["statistics.en_GB.highestRankingScore", "desc"]]}).toArray(function(err, users) {
    assert.equal(err, null);
    console.log("Found the following records");
    // console.dir(users);

    var ranking = 1;
    users.forEach( user => {
      user.ranking = ranking++;
      console.log(user.username);
      console.log(user.ranking);
      userCollection.save(user);
    });

    db.close();
  });

});