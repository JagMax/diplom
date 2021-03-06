const mongoose = require("mongoose");
const express = require("express");
const cors = require("cors");
const passport = require("passport");
const passportLocal = require("passport-local");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const bcrypt = require("bcrypt");
const path = require("path");

const User = require("./models/User");
const Doctor = require("./models/Doctor");
const Review = require("./models/Review");
const Form = require("./models/Form");

const diagnosis = require("./diagnosis");

const LocalStrategy = passportLocal.Strategy;

const connection = mongoose.connect(
  process.env.CONNECT,
  { useUnifiedTopology: true, useNewUrlParser: true, useCreateIndex: true },
  () => console.log("Connected to MongoDB")
);

const app = express();

// Middleware
app.use(express.json());
app.use(
  cors({
    origin: "https://nano-doc.netlify.app",
    credentials: true,
  })
);
app.use(cookieParser(process.env.SECRET));
app.use(
  session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 3600 * 24,
    },
  })
);
app.use(passport.initialize());
app.use(passport.session());

// Passport
passport.use(
  new LocalStrategy((username, password, done) => {
    User.findOne({ username: username }, (err, user) => {
      if (err) throw err;
      if (!user) return done(null, false);
      bcrypt.compare(password, user.password, (err, result) => {
        if (err) throw err;
        if (result) {
          return done(null, user);
        } else {
          return done(null, false);
        }
      });
    });
  })
);

passport.serializeUser((user, cb) => {
  cb(null, user.id);
});

passport.deserializeUser((id, cb) => {
  User.findOne({ _id: id }, (err, user) => {
    const userInformation = {
      username: user.username,
      fio: user.fio,
      isDoctor: user.isDoctor,
    };

    cb(err, userInformation);
  });
});

// Login and Registration Routes
app.post("/register", (req, res) => {
  const { username, fio, password } = req.body;

  User.findOne({ username }, async (err, user) => {
    if (err) throw err;
    if (user) res.send("error");
    if (!user) {
      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = new User({
        username,
        fio,
        password: hashedPassword,
      });

      await newUser.save();
      res.send("success");
    }
  });
});

app.post("/login", passport.authenticate("local"), (req, res) => {
  res.send("success");
});

app.get("/user", (req, res) => {
  res.send(req.user);
});

app.get("/logout", (req, res) => {
  req.logout();
  res.send("success");
});

// App Routes

app.get("/api/doctors", (req, res) => {
  Doctor.find()
    .sort({ likes: -1 })
    .then((doctors) => res.json(doctors));
});

app.get("/api/form", (req, res) => {
  Form.find({ doctor: req.user.fio })
    .then((forms) => {
      res.json(forms);
    })
    .catch((err) => console.log(err));
});

app.post("/api/form", (req, res) => {
  const { answers, selectedDoctor, fio } = req.body;
  const diagnos = diagnosis(answers);

  const form = new Form({
    fio,
    doctor: selectedDoctor,
    answers,
    diagnosis: diagnos,
  });

  form.save();

  res.json({
    selectedDoctor,
    fio,
    diagnos,
  });
});

app.get("/api/reviews", (req, res) => {
  Review.find()
    .sort({ createdAt: -1 })
    .then((reviews) => res.json(reviews));
});

app.post("/api/reviews", (req, res) => {
  const { fio, review } = req.body;

  const newReview = new Review({
    reviewer: fio,
    review,
  });

  newReview.save();
});

app.use(express.static("client/build"));

app.get("/", (req, res) => {
  res.sendFile(path.resolve(__dirname, "client", "build", "index.html"));
});

app.get("/doctors", (req, res) => {
  res.sendFile(path.resolve(__dirname, "client", "build", "index.html"));
});

app.get("/about", (req, res) => {
  res.sendFile(path.resolve(__dirname, "client", "build", "index.html"));
});

app.get("/*", (req, res) => {
  console.log("404");
  res.sendFile(path.resolve(__dirname, "404.html"));
});

app.listen(process.env.PORT || 5000, () => {
  console.log(`Server is listening on PORT ${process.env.PORT || 5000}`);
});
