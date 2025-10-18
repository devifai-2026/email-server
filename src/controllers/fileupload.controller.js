// controllers/upload.controller.js
const XLSX = require("xlsx");
const path = require("path");
const agenda = require("../jobs/agenda");
const BulkUpload = require("../models/bulkupload.model");
const ApiToken = require("../models/apitoken.model");
const { getEmailVerificationToken } = require("../utils/verifyEmail");

const CHUNK_SIZE = 1000;

exports.uploadExcel = async (req, res) => {
  res.json({
    message: "Verification jobs queued successfully",
    total: 0,
    bulkUploadId: "2222",
    fileName: req.file.originalname,
  });

  //   if (req.user.role !== "admin") {
  //     return res.status(403).json({ message: "Only admin can upload files" });
  //   }

  //   const bulkUpload = await BulkUpload.findOne({ status: "processing" });

  //   if (bulkUpload) {
  //     return res.status(400).json({
  //       message: "Already processinga file please wait to complete it",
  //     });
  //   }

  //   if (!req.file) {
  //     return res.status(400).json({ message: "No file uploaded" });
  //   }

  //   const ext = path.extname(req.file.originalname);
  //   if (![".xlsx", ".xls"].includes(ext)) {
  //     return res.status(400).json({ message: "Only Excel files are allowed" });
  //   }

  //   const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
  //   const sheet = XLSX.utils.sheet_to_json(
  //     workbook.Sheets[workbook.SheetNames[0]]
  //   );

  //   if (!sheet.length) {
  //     return res.status(400).json({ message: "Excel sheet is empty" });
  //   }

  //   const requiredColumns = [
  //     "email",
  //     "name",
  //     "companyname",
  //     "linkedin",
  //     "role",
  //     "website",
  //   ];
  //   const uploadedColumns = Object.keys(sheet[0]).map((col) =>
  //     col.trim().toLowerCase()
  //   );

  //   const missingColumns = requiredColumns.filter(
  //     (col) => !uploadedColumns.includes(col.toLowerCase())
  //   );

  //   if (missingColumns.length > 0) {
  //     return res.status(400).json({
  //       message: `Missing required columns: ${missingColumns.join(", ")}`,
  //     });
  //   }
  //   const token = await ApiToken.findOne();
  //   console.log(token, "getting token");
  //   if (!token || !token?.token) {
  //     return res.status(401).json({ message: "API token not found" });
  //   }
  //   const tokenFromServer = await getEmailVerificationToken(token);
  //   await agenda.start();

  //   const bulkUploadInstance = await BulkUpload.create({
  //     admin: req.user.id,
  //     total: sheet.length,
  //     status: "processing",
  //   });

  //   res.json({
  //     message: "Verification jobs queued successfully",
  //     total: sheet.length,
  //     bulkUploadId: bulkUploadInstance._id,
  //     fileName: req.file.originalname,
  //   });
  //   for (let i = 0; i < sheet.length; i += CHUNK_SIZE) {
  //     const chunk = sheet.slice(i, i + CHUNK_SIZE);
  //     await agenda.now("queue_email_verification", {
  //       chunk,
  //       bulkUploadId: bulkUploadInstance._id,
  //       token: tokenFromServer,
  //     });
  //   }
  // } catch (err) {
  //   console.error("Upload error:", err.message);
  //   res.status(500).json({ message: "Error processing file" });
  // }
};

exports.getUploadStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const upload = await BulkUpload.findById(id);

    if (!upload) {
      return res.status(404).json({ message: "Upload not found" });
    }

    res.json({
      status: upload.status,
      inserted: upload.inserted,
      skipped: upload.skipped,
      total: upload.total,
      createdAt: upload.createdAt,
      error: upload.error,
      bulkUploadId: id,
    });
  } catch (err) {
    console.error("Error in getUploadStatus:", err.message);
    res.status(500).json({ message: "Error retrieving upload status" });
  }
};
