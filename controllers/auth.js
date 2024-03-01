const crypto = require("crypto");

const { validationResult } = require("express-validator");

const User = require("../models/user");
const bcrypt = require("bcryptjs");

// send email by oauth2 and nodemailer
const nodemailer = require("nodemailer");
const { OAuth2Client } = require("google-auth-library");

// Những biến sau trong thực tế nên đưa vào biến môi trường ENV vì mục đích bảo mật hơn.
const GOOGLE_MAILER_CLIENT_ID =
  "202277534253-cmmla5l0vjdopgtv7pea7sbasi28a4tf.apps.googleusercontent.com";
const GOOGLE_MAILER_CLIENT_SECRET = "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";
const GOOGLE_MAILER_REFRESH_TOKEN =
  "1//04uf91T2Gzo-NCgYIARAAGAQSNwF-L9Ir7CZgPin-owvGP6PzkJtuGiW7pNwxka1VMqQaksY2FzIyna4lHHJwRtwKlNNw1qO99rE";
const ADMIN_EMAIL_ADDRESS = "hathuymaysau@gmail.com";

// Khởi tạo OAuth2Client với Client ID và Client Secret
const myOAuth2Client = new OAuth2Client(
  GOOGLE_MAILER_CLIENT_ID,
  GOOGLE_MAILER_CLIENT_SECRET
);
// Set Refresh Token vào OAuth2Client Credentials
myOAuth2Client.setCredentials({
  refresh_token: GOOGLE_MAILER_REFRESH_TOKEN,
});

exports.getLogin = (req, res, next) => {
  let message = req.flash("error");

  if (message.length > 0) {
    message = message[0];
  } else {
    message = null;
  }

  res.render("auth/login", {
    path: "/login",
    pageTitle: "Login",
    isAuthenticated: false,
    errorMessage: message,
    oldInput: {},
    validationErrors: [],
  });
};

exports.getSignup = (req, res, next) => {
  let message = req.flash("error");

  if (message.length > 0) {
    message = message[0];
  } else {
    message = null;
  }
  res.render("auth/signup", {
    path: "/signup",
    pageTitle: "Signup",
    isAuthenticated: false,
    errorMessage: message,
    oldInput: {},
    validationErrors: [],
  });
};

exports.postLogin = (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(422).render("auth/login", {
      path: "/login",
      pageTitle: "Login",
      isAuthenticated: false,
      errorMessage: errors.array()[0].msg,
      oldInput: {
        email,
        password,
      },
      validationErrors: errors.array(),
    });
  }

  User.findOne({ email: email })
    .then((user) => {
      if (!user) {
        return res.status(422).render("auth/login", {
          path: "/login",
          pageTitle: "Login",
          isAuthenticated: false,
          errorMessage: "Invalid email or password",
          oldInput: {
            email,
            password,
          },
          validationErrors: [],
        });
      }

      return bcrypt
        .compare(password, user.password)
        .then((doMatch) => {
          if (!doMatch) {
            return res.status(422).render("auth/login", {
              path: "/login",
              pageTitle: "Login",
              isAuthenticated: false,
              errorMessage: "Invalid email or password",
              oldInput: {
                email,
                password,
              },
              validationErrors: [],
            });
          }
          req.session.isLoggedIn = true;
          req.session.user = user;
          req.session.save((err) => {
            if (err) {
              console.log(err);
              return res.status(422).render("auth/login", {
                path: "/login",
                pageTitle: "Login",
                isAuthenticated: false,
                errorMessage: "Something went wrong.",
                oldInput: {
                  email,
                  password,
                },
                validationErrors: [],
              });
            }
            res.redirect("/");
          });
        })
        .catch((err) => {
          const error = new Error(err);
          error.httpStatusCode = 500;
          return next(error);
        });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postSignup = (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;
  const confirmPassword = req.body.confirmPassword;

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(422).render("auth/signup", {
      path: "/signup",
      pageTitle: "Signup",
      isAuthenticated: false,
      errorMessage: errors.array()[0].msg,
      oldInput: {
        email,
        password,
        confirmPassword,
      },
      validationErrors: errors.array(),
    });
  }

  bcrypt
    .hash(password, 12)
    .then((hashedPassword) => {
      const user = new User({
        email,
        password: hashedPassword,
        cart: { items: [] },
      });

      return user.save();
    })
    .then(async (result) => {
      res.redirect("/login");
      return;
      /**
       * Lấy AccessToken từ RefreshToken (bởi vì Access Token cứ một khoảng thời gian ngắn sẽ bị hết hạn)
       * Vì vậy mỗi lần sử dụng Access Token, chúng ta sẽ generate ra một thằng mới là chắc chắn nhất.
       */
      const myAccessTokenObject = await myOAuth2Client.getAccessToken();
      // Access Token sẽ nằm trong property 'token' trong Object mà chúng ta vừa get được ở trên
      const myAccessToken = myAccessTokenObject?.token;

      // Tạo một biến Transport từ Nodemailer với đầy đủ cấu hình, dùng để gọi hành động gửi mail
      const tranport = nodemailer.createTransport({
        service: "gmail",
        auth: {
          type: "OAuth2",
          user: ADMIN_EMAIL_ADDRESS,
          clientId: GOOGLE_MAILER_CLIENT_ID,
          clientSecret: GOOGLE_MAILER_CLIENT_SECRET,
          refreshToken: GOOGLE_MAILER_REFRESH_TOKEN,
          accessToken: myAccessToken,
        },
      });

      // mailOption là những thông tin gửi từ phía client lên thông qua API
      const mailOption = {
        to: email, // email nhan
        subject: "SignUp Account", // tieu de
        html: `<h3>Your account has been created successful.</h3>`, // noi dung email
      };

      res.redirect("/login");

      // Gọi hành động gửi email
      return tranport.sendMail(mailOption);
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postLogout = (req, res, next) => {
  req.session.destroy((err) => {
    console.log(err);
    res.redirect("/");
  });
};

exports.getReset = (req, res, next) => {
  let message = req.flash("error");

  if (message.length > 0) {
    message = message[0];
  } else {
    message = null;
  }

  res.render("auth/reset", {
    path: "/reset",
    pageTitle: "Reset Password",
    errorMessage: message,
  });
};

exports.postReset = (req, res, next) => {
  crypto.randomBytes(32, (err, buffer) => {
    if (err) {
      console.log(err);
      return res.redirect("/reset");
    }

    const token = buffer.toString("hex");

    User.findOne({ email: req.body.email })
      .then((user) => {
        if (!user) {
          req.flash("error", "No account with that email found.");
          return res.redirect("/reset");
        }

        user.resetToken = token;
        user.resetTokenExpiration = Date.now() + 3600000;
        return user.save();
      })
      .then(async (result) => {
        /**
         * Lấy AccessToken từ RefreshToken (bởi vì Access Token cứ một khoảng thời gian ngắn sẽ bị hết hạn)
         * Vì vậy mỗi lần sử dụng Access Token, chúng ta sẽ generate ra một thằng mới là chắc chắn nhất.
         */
        const myAccessTokenObject = await myOAuth2Client.getAccessToken();
        // Access Token sẽ nằm trong property 'token' trong Object mà chúng ta vừa get được ở trên
        const myAccessToken = myAccessTokenObject?.token;

        // Tạo một biến Transport từ Nodemailer với đầy đủ cấu hình, dùng để gọi hành động gửi mail
        const tranport = nodemailer.createTransport({
          service: "gmail",
          auth: {
            type: "OAuth2",
            user: ADMIN_EMAIL_ADDRESS,
            clientId: GOOGLE_MAILER_CLIENT_ID,
            clientSecret: GOOGLE_MAILER_CLIENT_SECRET,
            refreshToken: GOOGLE_MAILER_REFRESH_TOKEN,
            accessToken: myAccessToken,
          },
        });

        // mailOption là những thông tin gửi từ phía client lên thông qua API
        const mailOption = {
          to: req.body.email, // email nhan
          subject: "Password reset", // tieu de
          html: `
            <p>You have requested a password reset</p>
            <p>CLick this <a href='http://localhost:3000/reset/${token}'>link</a> to set a new password</p>
          `, // noi dung email
        };

        res.redirect("/");

        // Gọi hành động gửi email
        return tranport.sendMail(mailOption);
      })
      .catch((err) => {
        const error = new Error(err);
        error.httpStatusCode = 500;
        return next(error);
      });
  });
};

exports.getNewPassword = (req, res, next) => {
  const token = req.params.token;

  User.findOne({ resetToken: token, resetTokenExpiration: { $gt: Date.now() } })
    .then((user) => {
      let message = req.flash("error");

      if (message.length > 0) {
        message = message[0];
      } else {
        message = null;
      }

      res.render("auth/new-password", {
        path: "/new-password",
        pageTitle: "Update Password",
        errorMessage: message,
        userId: user._id,
        passwordToken: token,
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postNewPassword = (req, res, next) => {
  const password = req.body.password;
  const userId = req.body.userId;
  const passwordToken = req.body.passwordToken;

  let resetUser;

  User.findOne({
    _id: userId,
    resetToken: passwordToken,
    resetTokenExpiration: { $gt: Date.now() },
  })
    .then((user) => {
      resetUser = user;

      return bcrypt.hash(password, 12);
    })
    .then((hashedPassword) => {
      resetUser.password = hashedPassword;
      resetUser.resetToken = undefined;
      resetUser.resetTokenExpiration = undefined;

      return resetUser.save();
    })
    .then((result) => {
      return res.redirect("/login");
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};
