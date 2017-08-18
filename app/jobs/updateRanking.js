#!/usr/bin/env node
console.log('updateRanking');
const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');
const PromiseSeries = require('promise-series-advanced');
const forEach = require('lodash/forEach');

const languages = ['en_GB', 'fr_FR'];

// Connection URL
const url = require('../config')(process.env.NODE_ENV);
console.log('===================');
console.log(url);
console.log('===================');

MongoClient.connect(url, (err, db) => {
  assert.equal(null, err);

  const userCollection = db.collection('user');

  console.log(PromiseSeries);
  const p = new PromiseSeries();
  forEach(languages, language => {
    p.add(updateRanking, userCollection, language);
  });

  p.start()
  .then(results => {
    console.log(results);
    db.close();
  })
  .catch(error => {
    console.log(error);
  });

});

function updateRanking(userCollection, language) {
  console.log('updateRanking of ' + language);
  var defer = Promise.defer();

  userCollection.find({}, { sort: [[`statistics.${language}.highestRankingScore`, 'desc']] }).toArray((err, users) => {
    // assert.equal(err, null);
    if(err) {
      defer.reject();
    }else {

      var ranking = 1;
      users.forEach(user => {

        if (user.statistics[language]) {
          console.log('set ranking to ' + ranking);
          user.statistics[language].ranking = ranking++;

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

          userCollection.save(user);
        }
      });

      defer.resolve(true);
    }
  });
  return defer.promise;
};