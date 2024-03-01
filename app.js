require("dotenv").config();
const path = require("path");
const fs = require("fs");
// const https = require("https");

const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoDBStore = require("connect-mongodb-session")(session);
const csrf = require("csurf");
const flash = require("connect-flash");
const multer = require("multer");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");

const errorController = require("./controllers/error");
const User = require("./models/user");

console.log(process.env.NODE_ENV);

// const MONGODB_URI = `mongodb://127.0.0.1:27017/${process.env.MONGO_DEFAULT_DB}`; //"mongodb://127.0.0.1:27017/mongodb";
const MONGODB_URI = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@nodejs.t7hxuej.mongodb.net/${process.env.MONGO_DEFAULT_DB}?retryWrites=true&w=majority`;

console.log(process.env.MONGO_DEFAULT_DB);
console.log(MONGODB_URI);

const app = express();
const store = new MongoDBStore({
  uri: MONGODB_URI,
  collection: "sessions",
});

const csrfProtection = csrf();

// const privateKey = fs.readFileSync("server.key");
// const certificate = fs.readFileSync("server.cert");

const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "images");
  },
  filename: (req, file, cb) => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");

    const dateString = `${year}${month}${day}${hours}${minutes}${seconds}`;
    cb(null, dateString + "-" + file.originalname);
  },
});

const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === "image/png" ||
    file.mimetype === "image/jpg" ||
    file.mimetype === "image/jpeg"
  ) {
    console.log("image");
    cb(null, true);
  } else {
    console.log("not image");
    cb(null, false);
  }
};

app.set("view engine", "ejs");
app.set("views", "views");

const adminRoutes = require("./routes/admin");
const shopRoutes = require("./routes/shop");
const authRoutes = require("./routes/auth");

// Secure res header with helmet
// app.use(helmet());
app.use(
  helmet.contentSecurityPolicy({
    useDefaults: true,
    directives: {
      "img-src": ["'self'", "https: data: blob:"],
    },
  })
);

// compression assets with compression
app.use(compression());

// logging
const accessLogStream = fs.createWriteStream(
  path.join(__dirname, "access.log"),
  {
    flags: "a",
  }
);
app.use(morgan("combined", { stream: accessLogStream }));

app.use(bodyParser.urlencoded({ extended: false }));
// app.use(multer({ dest: "images" }).single("image"));
app.use(
  // multer({ dest: "images" }).single("image")
  multer({ storage: fileStorage, fileFilter: fileFilter }).single("image")
);
app.use(express.static(path.join(__dirname, "public")));
app.use("/images", express.static(path.join(__dirname, "images")));
app.use(
  session({
    secret: "my secret",
    resave: false,
    saveUninitialized: false,
    store: store,
  })
);

app.use(csrfProtection);
app.use(flash());

// them csrfToken vao moi view
app.use((req, res, next) => {
  res.locals.isAuthenticated = req.session.isLoggedIn;
  res.locals.csrfToken = req.csrfToken();
  next();
});

app.use((req, res, next) => {
  if (!req.session.user) {
    return next();
  }
  User.findById(req.session.user._id)
    .then((user) => {
      if (user) req.user = user;
      next();
    })
    .catch((err) => {
      // throw error: do co the viec ket noi den server da bi loi
      // throw new Error(err);
      // Nếu có 1 middleware chuyên xử lý thông báo lỗi, thì trong catch hoặc hàm callback
      // sẽ dùng next(new Error(err)), bỏi nếu dùng throw new Error thì sẽ không thể chuyển
      // đến middleware xử lý thông báo lỗi ở bên dưới, và ứng dụng sẽ treo mãi ở đây. Nếu ở trong then
      // hoặc ngoài Promise thì có thể dùng throw new Error.
      next(new Error(err));
    });
});

app.use("/admin", adminRoutes);
app.use(shopRoutes);
app.use(authRoutes);

app.get("/500", errorController.get500);

app.use(errorController.get404);

// middleware chuyen xu ly loi
app.use((error, req, res, next) => {
  // không dùng redirect vì như vậy sẽ phải chạy lại thứ tự
  // các middleware từ trên xuống dưới 1 lần nữa
  // và có thể gây ra vòng lặp vô hạn.
  // res.redirect("/500");
  console.log(error);
  res.status(500).render("500", {
    pageTitle: "Error!",
    path: "/500",
    isAuthenticated: req.session.isLoggedIn,
  });
});

mongoose
  .connect(MONGODB_URI)
  .then((result) => {
    app.listen(process.env.PORT || 3000);
    // https
    //   .createServer(
    //     {
    //       key: privateKey,
    //       cert: certificate,
    //     },
    //     app
    //   )
    //   .listen(process.env.PORT || 3000);
  })
  .catch((err) => {
    console.log(err);
  });

// Lắng nghe sự kiện kết nối thành công
mongoose.connection.on("connected", () => {
  console.log("Đã kết nối thành công đến cơ sở dữ liệu.");
});

// Lắng nghe sự kiện lỗi kết nối
mongoose.connection.on("error", (err) => {
  console.error("Lỗi kết nối đến cơ sở dữ liệu: ", err);
});

// Lắng nghe sự kiện ngắt kết nối
mongoose.connection.on("disconnected", () => {
  console.log("Đã ngắt kết nối đến cơ sở dữ liệu.");
});

// Nếu ứng dụng Node.js được đóng, đảm bảo đóng kết nối với cơ sở dữ liệu
process.on("SIGINT", () => {
  mongoose.connection.close().then(() => {
    console.log(
      "Đã đóng kết nối đến cơ sở dữ liệu vì ứng dụng Node.js đã dừng."
    );
    process.exit(0);
  });
});
