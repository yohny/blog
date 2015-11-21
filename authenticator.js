/* jshint -W071 */ //ignore 'function has too many statements' jshint warning
module.exports.setup = function(expressApp){
  if(!expressApp)
  {
    throw 'Missing express app';
  }

  var url = 'http://' + (process.env.NODE_ENV === 'production' ? 'kpjs.azurewebsites.net' : 'localhost:1337');
  var session = require('express-session');
  var FileStore = require('session-file-store')(session);
  var passport = require('passport');
  var GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
  var GithubStrategy = require('passport-github').Strategy;
  var TwitterStrategy = require('passport-twitter').Strategy;

  passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: url + '/login/google/callback'
    },
    function(token, tokenSecret, profile, done) {
      process.nextTick(function() {
        return done(null, profile);
      });
    }
  ));

  passport.use(new GithubStrategy({
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: url + '/login/github/callback'
    },
    function(accessToken, refreshToken, profile, done){
      process.nextTick(function() {
        return done(null, profile);
      });
    }
  ));

  passport.use(new TwitterStrategy({
      consumerKey: process.env.TWITTER_CLIENT_ID,
      consumerSecret: process.env.TWITTER_CLIENT_SECRET,
      callbackURL: url + '/login/twitter/callback'
    },
    function(accessToken, refreshToken, profile, done){
      process.nextTick(function() {
        return done(null, profile);
      });
    }
  ));

  passport.serializeUser(function(user, done) {
    done(null, user);
  });

  passport.deserializeUser(function(obj, done) {
    done(null, obj);
  });

  expressApp.use(session({ secret: 'keyboard cat', name: 'kpjs.blog.session', resave: true, saveUninitialized: true, store: new FileStore() }));
	expressApp.use(passport.initialize());
	expressApp.use(passport.session());

  expressApp.get('/login/google', passport.authenticate('google', { scope: 'profile' }));
  expressApp.get('/login/github', passport.authenticate('github'));
  expressApp.get('/login/twitter', passport.authenticate('twitter'));

	expressApp.get('/login/google/callback', authHandler('google'));
  expressApp.get('/login/github/callback', authHandler('github'));
  expressApp.get('/login/twitter/callback', authHandler('twitter'));

  function authHandler(provider){
    return function(req, res, next){
      passport.authenticate(provider, function(err, user, info){
        if (err) {
          return next(err); // will generate a 500 error
        }
        if (!user) {
          var error = new Error('Login failed (' + provider + ')');
          error.statusCode = 401;
          return next(error);
        }
        req.login(user, function(err){
          if(err){
            return next(err);
          }
          return res.redirect('/');
        });
      })(req, res, next);
    };
  }

  expressApp.get('/logout', function(req, res){
		req.logout();
		req.session.regenerate(function(){
			res.redirect('/');
		});
	});
};
