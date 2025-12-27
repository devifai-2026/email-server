const ExcelJS = require("exceljs");
const AWS = require("aws-sdk");
const dynamodb = new AWS.DynamoDB.DocumentClient({
  region: process.env.AWS_REGION || "ap-south-1"
});

const TABLE_NAME = "EmailAccounts";

// Helper: Scan DynamoDB with filters
async function scanDynamoDB(filter = {}, lastKey = null, limit = 50) {
  const params = {
    TableName: TABLE_NAME,
    Limit: limit,
    ExclusiveStartKey: lastKey
  };

  // Add search filter if provided
  if (filter.search) {
    params.FilterExpression = "contains(#email, :search)";
    params.ExpressionAttributeNames = {
      "#email": "email"
    };
    params.ExpressionAttributeValues = {
      ":search": filter.search
    };
  }

  try {
    const result = await dynamodb.scan(params).promise();
    return {
      items: result.Items || [],
      lastKey: result.LastEvaluatedKey,
      count: result.Count || 0
    };
  } catch (error) {
    console.error("DynamoDB scan error:", error);
    throw error;
  }
}

// Export emailaccounts to Excel with pagination and filter
exports.exportEmailAccounts = async (req, res) => {
  try {
    // Get query params for pagination and filter
    const { page = 1, limit = 50, search = "" } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    // Calculate how many items to skip
    const skip = (pageNum - 1) * limitNum;

    // Build filter for DynamoDB
    const filter = search ? { search } : {};

    // Since DynamoDB doesn't support skip, we need to fetch until we reach the desired page
    let allItems = [];
    let lastKey = null;
    let totalFetched = 0;

    // Keep fetching until we have enough items for the requested page
    while (allItems.length < (skip + limitNum)) {
      const batchSize = Math.min(100, limitNum * 2); // Fetch in batches
      const result = await scanDynamoDB(filter, lastKey, batchSize);
      
      if (result.items.length === 0) break;
      
      allItems = [...allItems, ...result.items];
      lastKey = result.lastKey;
      totalFetched += result.items.length;
      
      if (!lastKey) break; // No more items
    }

    // Apply pagination manually
    const emailAccounts = allItems.slice(skip, skip + limitNum);

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
      { header: "Is Verified", key: "isverified", width: 15 },
      { header: "Created At", key: "createdAt", width: 25 },
      { header: "Bulk Upload ID", key: "bulkUploadId", width: 30 },
    ];

    // Format date for Excel
    const formatDate = (timestamp) => {
      if (!timestamp) return "";
      const date = new Date(timestamp);
      return date.toISOString().split('T')[0] + ' ' + date.toLocaleTimeString();
    };

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
        isverified: account.isverified ? "Yes" : "No",
        createdAt: formatDate(account.createdAt),
        bulkUploadId: account.bulkUploadId || "",
      });
    });

    // Style the header row
    worksheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      let maxLength = 0;
      column.eachCell({ includeEmpty: true }, cell => {
        const columnLength = cell.value ? cell.value.toString().length : 10;
        if (columnLength > maxLength) {
          maxLength = columnLength;
        }
      });
      column.width = Math.min(maxLength + 2, 50); // Max width 50
    });

    // Set response headers for Excel download
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=emailaccounts-${Date.now()}.xlsx`
    );

    // Write workbook to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Export error:", err);
    res.status(500).json({ 
      message: "Error exporting email accounts",
      error: err.message 
    });
  }
};