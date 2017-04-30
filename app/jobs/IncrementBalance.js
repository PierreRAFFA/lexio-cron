#!/usr/bin/env node

const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');

// Connection URL
const url = require('../config')(process.env.NODE_ENV);
console.log(url);

MongoClient.connect(url, (err, db) => {
  assert.equal(null, err);

  const userCollection = db.collection('user');

  userCollection.find({"balance": { "$lt": 15 }}).toArray((err, users) => {
    assert.equal(err, null);

    console.dir(users);

    users.forEach( user => {
      user.balance += 1;
      userCollection.save(user);
    });

    db.close();
  });
});