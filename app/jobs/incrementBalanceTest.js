#!/usr/bin/env node
console.log('incrementBalance');
console.log(process.env.NODE_ENV);

const request = require('request');

/**
 * This job is not finish and is just a test by calling the api and not the database directly
 */
loginAsAdmin()
.then(response => {
  return response.id;
})
.then(accessToken => {
  return incrementBalance(accessToken)
})


function loginAsAdmin() {
  return new Promise((resolve, reject) => {
    let options = {
      url: `http://wordz-authentication:3010/api/users/login`,
      form: {email: "admin@wordz.com", password: "password"},
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

function incrementBalance(accessToken) {
  return new Promise((resolve, reject) => {

    let options = {
      url: `http://wordz-authentication:3010/api/users/update?access_token=${accessToken}`,
      form: {where: {}, data: {"$inc": {balance: 1}}},
    };

    request.patch(options, (error, response, body) => {
      if (error) {
        reject(error);
      } else {
        console.log(body);
        resolve();
      }
    });
  });
}