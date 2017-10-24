#!/usr/bin/env node
console.log('incrementBalance');
///////////////////////////////////////////////////////////////////////////
const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');
const request = require('request');
const map = require('lodash/map');
const filter = require('lodash/filter');
const pull = require('lodash/pull');
///////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////
const MAX_BALANCE = 5;
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
    console.log('Increment Balance Done !');
    console.log(result);
  })
  .catch(err => {
    console.log('Increment Balance Error !');
    console.error(err);
  });

///////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////
function loginAsAdmin() {
  return new Promise((resolve, reject) => {
    let options = {
      url: `http://lexio-authentication:3010/api/users/login`,
      form: {email: "admin@lexiogame.com", password: process.env.AUTHENTICATION_API_ADMIN_PASSWORD},
    };

    request.post(options, (error, response, body) => {
      if (error) {
        reject(error);
      } else {
        resolve(JSON.parse(response.body));
      }
    });
  });
}

///////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////
function incrementBalance(jwt) {

  // Connection URL
  const url = require('../config')(process.env.NODE_ENV).authentication;

  MongoClient.connect(url, (err, db) => {
    assert.equal(null, err);

    const userCollection = db.collection('user');

    //get users with balance less than MAX_BALANCE
    userCollection.find({ "balance": { "$lt": MAX_BALANCE } }).toArray((err, users) => {
      assert.equal(err, null);

      //increment balance
      users.forEach(user => {
        user.balance += 1;
        userCollection.save(user);
      });

      //get user list to notify
      const usersWithMaxBalance = filter(users, user => user.balance === MAX_BALANCE);
      let ids = pull(
        map(usersWithMaxBalance, user => user.firebaseToken),
        undefined,
        null
      );

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
  if(ids.length) {
    const options = {
      url: 'http://lexio-push-notification:3010/api/notifications',
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