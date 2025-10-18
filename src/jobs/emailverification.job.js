module.exports = function (agenda) {
  agenda.define("queue_email_verification", async (job) => {
    const { chunk, bulkUploadId, token } = job.attrs.data;

    await Promise.settleAll(
      chunk
        .filter((r) => r.email)
        .map((r) =>
          agenda
            .create("verify_and_save_email", { row: r, bulkUploadId, token })
            .save()
        )
    );
  });
};
