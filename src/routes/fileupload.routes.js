const express = require("express");
const router = express.Router();
const { protect, adminOnly } = require("../middlewares/auth.middleware");
const {
  uploadExcel,
  getUploadStatus,
} = require("../controllers/fileupload.controller");
const uploadToS3 = require("../utils/multerS3");

router.get("/getStatus/:id", protect, adminOnly, getUploadStatus);

router.post(
  "/uploadfile",
  uploadToS3.single("file"),  // This uploads to S3
  uploadExcel  // This processes the upload
);

module.exports = router;