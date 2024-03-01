const path = require("path");

const express = require("express");

const adminController = require("../controllers/admin");

const router = express.Router();

const isAuth = require("../middleware/is-auth");
const { body } = require("express-validator");

// /admin/add-product => GET
router.get("/add-product", isAuth, adminController.getAddProduct);

// /admin/products => GET
router.get("/products", isAuth, adminController.getProducts);

// /admin/add-product => POST
router.post(
  "/add-product",
  [
    body("title")
      .trim()
      // .matches(/^[a-zA-Z0-9 ]+$/)
      // .withMessage(
      //   "Title has only number, letters, space and no special characters."
      // )
      .isLength({ min: 3 })
      .withMessage("Title has at least 3 characters."),
    // body("imageUrl", "Invalid Url").trim().isURL(),
    body("price", "Price is not a number").isFloat(),
    body("description", "Description has at least 5 characters")
      .trim()
      .isLength({ min: 5 }),
  ],
  isAuth,
  adminController.postAddProduct
);

router.get("/edit-product/:productId", isAuth, adminController.getEditProduct);

router.post(
  "/edit-product",
  [
    body("title")
      .trim()
      .matches(/^[a-zA-Z0-9 ]+$/)
      .withMessage(
        "Title has only number, letters, space and no special characters."
      )
      .isLength({ min: 3 })
      .withMessage("Title has at least 3 characters."),
    //body("imageUrl", "Invalid Url").trim().isURL(),
    body("price", "Price is not a number").isFloat(),
    body("description", "Description has at least 5 characters")
      .trim()
      .isLength({ min: 5 }),
  ],
  isAuth,
  adminController.postEditProduct
);

//router.post("/delete-product", isAuth, adminController.postDeleteProduct);

router.delete("/product/:productId", isAuth, adminController.deleteProduct);

module.exports = router;
