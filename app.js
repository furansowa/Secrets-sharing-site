

require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require("mongoose-findorcreate");

const app = express();

app.set("view engine", "ejs");
app.use(express.urlencoded({extended: "true"}));
app.use(express.static("public"));
app.use(session({
    secret: "Our little secret hahaha",
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());


const uri = "mongodb://localhost:27017/userDB";
mongoose.connect(uri);

const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId: String,
    secret: String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = mongoose.model("User", userSchema);

passport.use(User.createStrategy());



passport.serializeUser(function(user, cb) {
    process.nextTick(function() {
      return cb(null, {
        id: user.id,
        username: user.username,
      });
    });
});
  
passport.deserializeUser(function(user, cb) {
    process.nextTick(function() {
        return cb(null, user);
    });
});



passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));



app.get("/", function(req,res) {
    res.render("home");
});



app.get("/auth/google", 
    passport.authenticate("google", {scope: ["profile"]})
);



app.get("/auth/google/secrets", 
    passport.authenticate("google", {failureRedirect: "/login"}),
    function(req, res) {
        res.redirect("/secrets");
    }
);


app.get("/login", function(req,res) {
    if (req.isAuthenticated()) {
        res.redirect("/secrets");
    } else {
        res.render("login");
    }
});

app.post('/login', 
    passport.authenticate("local"), 
    function(req, res) {
        res.redirect("/secrets");
    }
);



app.get("/logout", function(req,res) {
    req.logout(function(err){
        if (err) {
            console.log(err);
        }

        res.redirect("/");
    });
});



app.get("/register", function(req,res) {
    res.render("register");
});

app.post("/register", function(req, res) {
    User.register({username: req.body.username}, req.body.password, function(err, user){
        if (err) {
            console,log(err);
            res.redirect("/");
        } else {
            passport.authenticate("local")(req, res, function(){
                res.redirect("/secrets");
            })
        }
    });
    
});



app.get("/secrets", function(req,res) {
    User.find({"secret":{$ne:null}})
        .then( foundUsers => {
            if (foundUsers) {
                res.render("secrets", {usersWithSecrets: foundUsers});
            }
        })
        .catch(err => {
            console.log(err);
        });
});



app.get("/submit", function(req,res) {
    if (req.isAuthenticated()) {
        res.render("submit");
    } else {
        res.redirect("/login");
    }
});

app.post("/submit", function(req,res) {
    const submittedSecret = req.body.secret;

    User.findById(req.user.id)
        .then( foundUser => {
            if (foundUser) {
                foundUser.secret = submittedSecret;
                foundUser.save()
                    .then( () => {
                        res.redirect("/secrets");
                    })
                    .catch(err => {
                        console.log(err);
                    });
            }
        })
        .catch(err => {
            console.log(err);
        });
});



app.listen(process.env.PORT || 3000, function() {
    console.log("Server is running");
});