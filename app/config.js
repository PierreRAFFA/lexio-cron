/**
 * Created by pierre on 30/04/2017.
 */

module.exports = function(environment) {
  switch(environment) {
    case 'production':
    case 'staging':
      return 'mongodb://mongo:27017/wordz-api';
      break;

    default:
      return 'mongodb://localhost:27017/wordz-api-dev';
  }
};
