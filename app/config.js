/**
 * Created by pierre on 30/04/2017.
 */

module.exports = function(environment) {
  switch(environment) {
    case 'production':
    case 'development':
      return 'mongodb://api:{0}@mongohost:27017/authentication'.replace('{0}', process.env.MONGO_API_PASSWORD);
      break;

    default:
      return 'mongodb://mongohost:27017/authentication';
  }
};
