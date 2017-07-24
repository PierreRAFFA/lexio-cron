#!/usr/bin/env node
console.log('incrementBalance');
console.log(process.env.NODE_ENV);
const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');
const request = require('request');
const map = require('lodash/map');

// Connection URL
const url = require('../config')(process.env.NODE_ENV);
console.log('===================');
console.log(url);
console.log('===================');

MongoClient.connect(url, (err, db) => {
  assert.equal(null, err);

  const userCollection = db.collection('user');

  let ids = [];
  userCollection.find({"balance": { "$lt": 5 }}).toArray((err, users) => {
    assert.equal(err, null);

    ids = map(users, user => user.firebaseToken);

    users.forEach( user => {
      user.balance += 1;
      userCollection.save(user);
    });

    db.close();

    sendNotification('balanceUpdated', ids);
  });
});

/**
 * Sends the notification by calling the pushNotification service (pushnotificationhost)
 * @param type May be balanceUpdated
 * @param ids user firebaseToken list
 */
function sendNotification(type, ids) {
  console.log('Sending notification...');
  if(ids.length) {
    const data = {
      json: true,
      body: {
        type: type,
        ids: ids
      }
    };

    request.post('http://pushnotificationhost:3010/api/notifications', data, (error, response) => {
      if (error){
        console.log(error);
      }else{
        console.log(response.body);
      }
    });
  }
}