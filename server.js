module.exports = function(logger, authenticationController, mainController, postsController, usersController, imageController, scheduler) {
	if(!logger) {
		throw 'Missing logger';
	}
	if(!authenticationController) {
		throw 'Missing authenticationController';
	}
	if(!mainController) {
		throw 'Missing mainController';
	}
	if(!postsController) {
		throw 'Missing postsController';
	}
	if(!usersController) {
		throw 'Missing usersController';
	}
	if(!imageController) {
		throw 'Missing imageController';
	}
	if(!scheduler) {
		throw 'Missing scheduler';
	}

	var server;

	return {
		start: function(startCallback) {
			start(logger, authenticationController, postsController, usersController, imageController, scheduler, function(err, srv) {
				if (err) {
					return startCallback(err);
				}
				server = srv;
				startCallback(null, server.address());
			});
		},
		stop: function() {
			if (server) {
				server.close();
				server = null;
				logger.info('Server stopped');
			}
		}
	};

	function start(logger, authenticationController, postsController, usersController, imageController, scheduler, callback) {
		var port = process.env.PORT || 1337;
		var express = require('express');
		var hbs = require('hbs');

		hbs.registerHelper('select', function(selected, options) {
			return options.fn(this).replace(
				new RegExp(' value=\"' + selected + '\"'),
				'$& selected="selected"');
		});
		hbs.registerPartials(__dirname + '/views/partials');

		var app = express();
		app.set('view engine', 'html');
		app.engine('html', hbs.__express);
		app.use(express.static('static'));

		hbs.localsAsTemplateData(app);

		var bodyParser = require('body-parser');
		app.use(bodyParser.urlencoded({ extended: false }));

		var busboy = require('connect-busboy');
		app.use(busboy());

		app.use(function(req, res, next) {
			logger.info('Request for ' + req.path);
			next();
		});

		var session = require('express-session');
		var FileStore = require('session-file-store')(session);
		app.use(session({
			secret: 'kPjS s3cr3t',
			name: 'kpjs.blog.session',
			resave: true,
			saveUninitialized: true,
			store: new FileStore({ ttl: 1800, reapInterval: 1800, logFn: logger.info })
		}));

		authenticationController.setup(app);

		app.use(function(req, res, next) {
			res.locals.user = req.user;
			next();
		});

		registerPostControllerRoutes(app, authenticationController.ensureRulerOrOwner, authenticationController.ensureCitizen, postsController);
		registerMainControllerRoutes(app, mainController);
		registerUserControllerRoutes(app, authenticationController.ensureRuler, authenticationController.ensureRulerOrMyself, usersController);
		registerImageControllerRoutes(app, authenticationController.ensureCitizen, imageController);

		// handler for all other paths
		app.use(function(req, res, next) {
			var error = new Error('Page not found');
			error.statusCode = 404;
			next(error);
		});

		// error handler
		app.use(function(err, req, res, next) { // jshint ignore:line
			logger.error('Error: ' + err.message, { path: req.path, stackTrace: err.stack });
			err.statusCode = err.statusCode || 500;
			res.status(err.statusCode);
			res.render('error.html', { message: err.message, errorCode: err.statusCode });
		});

		var srv = app.listen(port, function(err) {
			if (err) {
				logger.error('Server initialization failed', err);
				callback(err);
			}
			else {
				logger.info('Server listening');
				callback(null, srv);
			}
		});

		scheduler.start();
	}

	function registerUserControllerRoutes(app, verifyRuler, verifyRulerOrMyself, usersController) {
		app.get('/users', verifyRuler, usersController.getAllUsersRouteHandler);
		app.get('/users/:userId', verifyRulerOrMyself, usersController.getUserRouteHandler);
		app.post('/users/:userId', verifyRulerOrMyself, usersController.postUserRouteHandler);
	}

	function registerPostControllerRoutes(app, verifyRulerOrOwner, verifyCitizen, postsController) {
		app.get('/posts', postsController.getPostsRouteHandler);
		app.get('/posts/:uri', postsController.getReadRouteHandler);
		app.delete('/posts/:uri', verifyRulerOrOwner, postsController.deletePostRouteHandler);
		app.get('/edit/:uri', verifyRulerOrOwner, postsController.getEditRouteHandler);
		app.post('/edit/:uri', verifyRulerOrOwner, postsController.postEditRouteHandler);
		app.get('/create', verifyCitizen, postsController.getCreateRouteHandler);
		app.post('/create', verifyCitizen, postsController.postCreateRouteHandler);
		app.get('/myPosts', postsController.getMyPostsRouteHandler);
	}

	function registerMainControllerRoutes(app, mainController) {
		app.get('/', mainController.getRootRouteHandler);
		app.get('/about', mainController.aboutRouteHandler);
		app.get('/contact', mainController.contactRouteHandler);
	}

	function registerImageControllerRoutes(app, verifyCitizen, imagesController) {
		app.post('/uploadImage', verifyCitizen, imagesController.uploadImageRouteHandler);
		app.get('/tempImages/:id', verifyCitizen, imagesController.getTempImageRouteHandler);
		app.get('/images/:uri/:id', imagesController.getPostImageRouteHandler);
	}
};
