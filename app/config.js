/**
 * Created by pierre on 30/04/2017.
 */

module.exports = function(environment) {
  switch(environment) {
    case 'production':
    case 'development':
      return {
        authentication: 'mongodb://api:{0}@lexio-authentication-mongo:27017/authentication'.replace('{0}', process.env.MONGO_API_PASSWORD),
        game: 'mongodb://api:{0}@lexio-game-mongo:27017/game'.replace('{0}', process.env.MONGO_API_PASSWORD)
      };
      break;

    default:
      return {
        authentication: 'mongodb://lexio-authentication-mongo:27017/authentication',
        game: 'mongodb://lexio-game-mongo:27017/game',
      }
  }
};
