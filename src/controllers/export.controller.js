const EmailAccount = require("../models/emailaccount.model");
const ExcelJS = require("exceljs");

// Export emailaccounts to Excel with pagination and filter
exports.exportEmailAccounts = async (req, res) => {
  try {
    // Get query params for pagination and filter
    const { page = 1, limit = 50, search = "" } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build filter (case-insensitive partial match on email)
    const filter = search ? { email: { $regex: search, $options: "i" } } : {};

    // Fetch filtered and paginated emailaccounts
    const emailAccounts = await EmailAccount.find(filter)
      .skip(skip)
      .limit(parseInt(limit));

    // Create Excel workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Email Accounts");

    // Add header row
    worksheet.columns = [
      { header: "Name", key: "name", width: 25 },
      { header: "Role", key: "role", width: 20 },
      { header: "Location", key: "location", width: 20 },
      { header: "Industry", key: "industry", width: 20 },
      { header: "Size", key: "size", width: 15 },
      { header: "Funding", key: "funding", width: 15 },
      { header: "Email", key: "email", width: 30 },
      { header: "Phone", key: "phone", width: 20 },
      { header: "Personal Contact No", key: "personalcontactno", width: 20 },
      { header: "Company Name", key: "companyname", width: 25 },
      { header: "Position", key: "position", width: 20 },
      { header: "Website", key: "website", width: 30 },
      { header: "LinkedIn", key: "linkedin", width: 30 },
      { header: "Status", key: "status", width: 15 },
      { header: "Created At", key: "createdAt", width: 25 },
    ];

    // Add data rows
    emailAccounts.forEach((account) => {
      worksheet.addRow({
        name: account.name || "",
        role: account.role || "",
        location: account.location || "",
        industry: account.industry || "",
        size: account.size || "",
        funding: account.funding || "",
        email: account.email || "",
        phone: account.phone || "",
        personalcontactno: account.personalcontactno || "",
        companyname: account.companyname || "",
        position: account.position || "",
        website: account.website || "",
        linkedin: account.linkedin || "",
        status: account.status || "",
        createdAt: account.createdAt ? account.createdAt.toISOString() : "",
      });
    });

    // Set response headers for Excel download
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=emailaccounts.xlsx"
    );

    // Write workbook to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Export error:", err);
    res.status(500).json({ message: "Error exporting email accounts" });
  }
};
