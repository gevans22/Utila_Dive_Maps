var express = require('express'),
    passport = require('passport'),
    flash = require('connect-flash'),
    http = require('http'),
    Shred = require('shred'),
    LocalStrategy = require('passport-local').Strategy;
  
var users = [
    { id: 1, username: 'Demo', password: 'Demo', email: 'bob@example.com', viewers: ["Underwater Vision's Dive Sites", "Utila Dive Center (UDC)'s Dive Sites", "Ecomarine Dive Shop's Dive Sites"], group: 'admin' }
];

function findById(id, fn) {
  var idx = id - 1;
  if (users[idx]) {
    fn(null, users[idx]);
  } else {
    fn(new Error('User ' + id + ' does not exist'));
  }
}

function findByUsername(username, fn) {
  for (var i = 0, len = users.length; i < len; i++) {
    var user = users[i];
    if (user.username === username) {
      return fn(null, user);
    }
  }
  return fn(null, null);
}


// Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session.  Typically,
//   this will be as simple as storing the user ID when serializing, and finding
//   the user by ID when deserializing.
passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  findById(id, function (err, user) {
    done(err, user);
  });
});


// Use the LocalStrategy within Passport.
//   Strategies in passport require a `verify` function, which accept
//   credentials (in this case, a username and password), and invoke a callback
//   with a user object.  In the real world, this would query a database;
//   however, in this example we are using a baked-in set of users.
passport.use(new LocalStrategy(
  function(username, password, done) {
    // asynchronous verification, for effect...
    process.nextTick(function () {
      
      // Find the user by username.  If there is no user with the given
      // username, or the password is not correct, set the user to `false` to
      // indicate failure and set a flash message.  Otherwise, return the
      // authenticated `user`.
      findByUsername(username, function(err, user) {
        if (err) { return done(err); }
        if (!user) { return done(null, false, { message: 'Unknown user ' + username }); }
        if (user.password != password) { return done(null, false, { message: 'Invalid password' }); }
        return done(null, user);
      })
    });
  }
));



var app = express();


// configure Express
app.configure(function() {
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.engine('ejs', require('ejs-locals'));
  app.use(express.logger());
  app.use(express.cookieParser());
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.session({ secret: 'super cat' }));
  app.use(flash());
  // Initialize Passport!  Also use passport.session() middleware, to support
  // persistent login sessions (recommended).
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(app.router);
  app.use('/app', app.router);
  app.use(express.static(__dirname + '/public'));
});


app.get('/', function(req, res){
  if(req.user) console.log(req.user.viewers);
  res.render('index', { user: req.user });
});

app.get('/account', ensureAuthenticated, function(req, res){
  res.render('account', { user: req.user });
});

app.get('/login', function(req, res){
  res.render('login', { user: req.user, message: false});
});

app.get('/login/error', function(req, res){
  res.render('login_error', { user: req.user, message: req.flash('error') });
});

// POST /login
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
//
//   curl -v -d "username=bob&password=secret" http://127.0.0.1:3000/login
app.post('/login', 
  passport.authenticate('local', { failureRedirect: '/login/error', failureFlash: true }),
  function(req, res) {
    res.redirect('/');
  });

app.get('/register', function(req, res){
  res.render('register', { user: req.user });
});

var shred = new Shred();

app.get('/map/:ID', function(req, res){
  var shop_id = req.params.ID;
  var queriesComplete = 0;
  var totalNumberOfQueries = 2;
  var DiveSites = {
    style: {
      size: 'medium',
      symbol: 'ferry',
      color: '#0cc'
    },
    table: 'utila_dive_sites'
  };

  var DiveShops = {
    style: {
      size: 'medium',
      symbol: 'star',
      color: '#160071'
    },
    table: 'sites'
  };
  CartoDBQuery(DiveShops, shop_id);
  CartoDBQuery(DiveSites, shop_id);

  function CartoDBQuery(sites, shop_id){
    var query = "select the_geom as the_geom, name as title, description as description,'" + sites.style.size + "' as \"marker-size\", '" + sites.style.symbol + "' as \"marker-symbol\",  '" + sites.style.color  + "' as \"marker-color\"  from " + sites.table + " where " + shop_id + " = ANY(shop_id)";

    var request = shred.get({
      url: "http://gevans22.cartodb.com/api/v2/sql?format=GeoJSON&q=" + encodeURIComponent(query),
      headers: {
      Accept: "application/json"
      },
      on: {
        // You can use response codes as events
        200: function(response) {
        // Shred will automatically JSON-decode response bodies that have a
        // JSON Content-Type
         
          sites.GeoJSON = response.content.data;
          queriesComplete += 1;
          if(queriesComplete === totalNumberOfQueries) {
            console.log(DiveShops.GeoJSON.features[0].properties.title)
            res.render('iframe', {
              DiveSites: JSON.stringify(DiveSites.GeoJSON),
              DiveShops: JSON.stringify(DiveShops.GeoJSON),
              DiveShopName: DiveShops.GeoJSON.features[0].properties.title,
              user: req.user
            });
          }
        },
        // Any other response means something's wrong
        response: function(response) {
          console.log("Oh no!");
        }
      }
    });
  }
});
app.get('/maps/Utila', function(req, res){
  var shop_id = req.params.ID;
  var queriesComplete = 0;
  var totalNumberOfQueries = 2;
  var DiveSites = {
    style: {
      size: 'medium',
      symbol: 'ferry',
      color: '#0cc'
    },
    table: 'utila_dive_sites'
  };
  
  var DiveShops = {
    style: {
      size: 'medium',
      symbol: 'star',
      color: '#160071'
    },
    table: 'sites'
  };
  CartoDBQuery(DiveShops, shop_id);
  CartoDBQuery(DiveSites, shop_id);

  function CartoDBQuery(sites, shop_id){
    var query = "select the_geom as the_geom, name as title, description as description,'" + sites.style.size + "' as \"marker-size\", '" + sites.style.symbol + "' as \"marker-symbol\",  '" + sites.style.color  + "' as \"marker-color\"  from " + sites.table;

    console.log(query);
    var request = shred.get({
      url: "http://gevans22.cartodb.com/api/v2/sql?format=GeoJSON&q=" + encodeURIComponent(query),
      headers: {
      Accept: "application/json"
      },
      on: {
        // You can use response codes as events
        200: function(response) {
        // Shred will automatically JSON-decode response bodies that have a
        // JSON Content-Type
         
          sites.GeoJSON = response.content.data;
          queriesComplete += 1;
          if(queriesComplete === totalNumberOfQueries) {
            console.log(DiveShops.GeoJSON.features[0].properties.title)
            res.render('iframe', {
              DiveSites: JSON.stringify(DiveSites.GeoJSON),
              DiveShops: JSON.stringify(DiveShops.GeoJSON),
              DiveShopName: DiveShops.GeoJSON.features[0].properties.title,
              user: req.user
            });
          }
        },
        // Any other response means something's wrong
        response: function(response) {
          console.log("Oh no!");
        }
      }
    });
  }
});


app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});


var port = process.env.PORT || 3000;
app.listen(port, function() {
  console.log('Express server listening on port:' + port);
});


// Simple route middleware to ensure user is authenticated.
//   Use this route middleware on any resource that needs to be protected.  If
//   the request is authenticated (typically via a persistent login session),
//   the request will proceed.  Otherwise, the user will be redirected to the
//   login page.

function ensureAuthenticated() {
  return function(req, res, next) {
    if (req.isAuthenticated())
      next();
    else res.redirect('/login')
  }
}

function needsGroup(group) {
  return [
    passport.authenticate('local'),
    function(req, res, next) {
      if (req.user && req.user.group === group)
        next();
      else
        res.send(401, 'Unauthorized, insufficient priviledges');
    }
  ];
};

function checkViewerAccess() {
  return [
    ensureAuthenticated(),
    function(req, res, next) {
      var access = false;
      for(var i = 0; i < req.user.viewers.length; i++){
        if(req.user && req.user.viewers[i] === req.params.portalName){
          access = true;
          next();
        }
      }
      if(!access) res.send(401, 'Unauthorized, insufficient priviledges');
    }
  ];
};

function create_user_route(req, res) {
  console.log('req.session is\n'+JSON.stringify(req.session,null,2));
  if(db.userByHandle(req.body.handle) !== null)
    return res.send('Already have an account with that username');
  var user = db.newUser();
  console.log('user.handle will be '+req.body.handle);
  user.handle = req.body.handle;
  var sha256er = crypto.createHash('sha256');
  crypto.randomBytes(33, function(err, buffer){
    if(!err) { 
      var salt = buffer.toString('hex');
      user.salt = salt;
      var toHash = req.body.password.concat(salt);
      sha256er.update(toHash,'utf8');
      var hash = sha256er.digest('hex');
      user.hash = hash;
      USERS.push(user);
      console.log('logging in '+user.handle);
      req.logIn(user, function(err) {
        if(err) {
          res.send('Error starting session for '+user.handle)}
        else { 
          console.log('User created from u/p. req.session is\n'+JSON.stringify(req.session,null,2));
          res.render('createduser', {logged_in_user:req.user.handle})
        };
      });
      
    } else { 
      res.send('Error adding user '+req.body.handle+':\n'+err,500);
    };
  });
}; //end of create_user_route


// function ensureAuthenticated(req, res, next) {
//   if (req.isAuthenticated()) { return next(); }
//   res.redirect('/login')
// }



