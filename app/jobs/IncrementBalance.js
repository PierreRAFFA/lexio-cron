#!/usr/bin/env node
console.log('incrementBalance');
console.log(process.env.NODE_ENV);
console.log(process.env.AUTHENTICATION_API_ADMIN_PASSWORD);
///////////////////////////////////////////////////////////////////////////
const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');
const request = require('request');
const map = require('lodash/map');
const pull = require('lodash/pull');
///////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////
loginAsAdmin()
  .then(response => {
    return response.jwt;
  })
  .then(jwt => {
    return incrementBalance(jwt);
  })
  .then(result => {
    console.log(result);
  });

///////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////
function loginAsAdmin() {
  return new Promise((resolve, reject) => {
    let options = {
      url: `http://wordz-authentication:3010/api/users/login`,
      form: {email: "admin@wordz.com", password: process.env.AUTHENTICATION_API_ADMIN_PASSWORD},
    };

    request.post(options, (error, response, body) => {
      if (error) {
        reject(error);
      } else {
        console.log(body);
        resolve(JSON.parse(body));
      }
    });
  });
}

///////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////
function incrementBalance(jwt) {

  // Connection URL
  const url = require('../config')(process.env.NODE_ENV);
  console.log('===================');
  console.log(url);
  console.log('===================');

  MongoClient.connect(url, (err, db) => {
    assert.equal(null, err);

    const userCollection = db.collection('user');

    userCollection.find({ "balance": { "$lt": 100 } }).toArray((err, users) => {
      assert.equal(err, null);

      let ids = pull(
        map(users, user => user.firebaseToken),
        undefined,
        null
      );

      users.forEach(user => {
        user.balance += 1;
        userCollection.save(user);
      });

      db.close();

      sendNotification(jwt, 'balanceUpdated', ids);
    });
  });
}

///////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////
/**
 * Sends the notification by calling the pushNotification service (pushnotificationhost)
 * @param type May be balanceUpdated
 * @param ids user firebaseToken list
 */
function sendNotification(jwt, type, ids) {
  console.log('Sending notification...');
  if(ids.length) {
    const options = {
      url: 'http://wordz-push-notification:3010/api/notifications',
      headers: {
        Authorization: jwt
      },
      form: {
        type: type,
        ids: ids
      }
    };

    request.post(options, (error, response, body) => {
      if (error){
        console.log(error);
      }else{
        console.log(body);
      }
    });
  }
}