// jobs/verifyAndSaveEmail.js
const EmailAccount = require("../models/emailaccount.model");
const BulkUpload = require("../models/bulkupload.model");
const { verifyEmail } = require("../utils/verifyEmail");

module.exports = (agenda) => {
  agenda.define("verify_and_save_email", async (job, done) => {
    const { row, bulkUploadId, token } = job.attrs.data;
    const {
      email,
      name,
      companyname,
      linkedin,
      // position,
      website,
      // personalcontactno,
      // location,
      // industry,
      // size,
      // funding,
      role,
      isverified = true,
    } = row;

    try {
      const alreadyExists = await EmailAccount.findOne({ email });

      if (alreadyExists) {
        if (bulkUploadId)
          await BulkUpload.findByIdAndUpdate(bulkUploadId, {
            $inc: { skipped: 1 },
          });
      } else {
        let code = "gibberish";
        let message = "gibberish";
        console.log(isverified, email);
        if (!isverified) {
          console.log(token, email, "before calling verification api");
          const response = await verifyEmail(email, token);
          code = response?.data?.code;
          message = response?.data?.message;
        }

        const newEmailAccount = await EmailAccount.create({
          name,
          email,
          companyname,
          linkedin,
          // position,
          // personalcontactno,
          // location,
          // industry,
          // size,
          // funding,
          role,
          isverified: isverified
            ? true
            : message === "Accepted" && code === "ok",
          emailData: {},
          website,
        });
        await BulkUpload.findByIdAndUpdate(bulkUploadId, {
          $inc: { inserted: 1 },
        });
      }
      if (bulkUploadId) {
        // Now check if processing is complete
        const updatedUpload = await BulkUpload.findById(bulkUploadId);
        if (
          updatedUpload &&
          updatedUpload.inserted + updatedUpload.skipped >=
            updatedUpload.total &&
          updatedUpload.status !== "completed"
        ) {
          await BulkUpload.findByIdAndUpdate(bulkUploadId, {
            status: "completed",
          });
        }
      }

      done();
      await job.remove(); // Remove from DB
    } catch (err) {
      console.error("Job error:", err.message);
      if (bulkUploadId) {
        await BulkUpload.findByIdAndUpdate(bulkUploadId, {
          status: "failed",
          error: err.message,
        });
      }
      done(err);
      await job.remove(); // Remove from DB
    }
  });
};
