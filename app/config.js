/**
 * Created by pierre on 30/04/2017.
 */

module.exports = function(environment) {
  switch(environment) {
    case 'production':
    case 'development':
      return 'mongodb://api:password@mongohost:27017/api';
      break;

    default:
      return 'mongodb://mongohost:27017/api';
  }
};
