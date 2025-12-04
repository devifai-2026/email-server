const agenda = require("../jobs/agenda");
const EmailAccount = require("../models/emailaccount.model");
const User = require("../models/user.model");
const { roles } = require("../utils/config");

// GET all with filters + pagination + sorting

// maskEmail = (email) => {
//   const [name, domain] = email.split("@");
//   if (!name || !domain) return "*****";

//   const visible = name.slice(0, 1);
//   const masked = "*".repeat(Math.max(name.length - 1, 3));
//   return `${visible}${masked}@${domain}`;
// };

const maskEmail = (email) => {
  if (!email || typeof email !== "string") return email;
  const [user, domain] = email.split("@");
  if (!user || !domain) return email;
  const visible = user.slice(0, 3);
  return `${visible}${"*".repeat(Math.max(3, user.length - 3))}@${domain}`;
};

exports.getEmailAccounts = async (req, res) => {
  try {
    console.log('Query parameters received:', req.query);
    
    // ✅ Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // ✅ Sorting - Support both frontend and backend parameter names
    const sortField = req.query.sortname || req.query.sort || "createdAt";
    const sortOrder = req.query.sortype === "asc" || req.query.order === "asc" ? 1 : -1;
    const sort = { [sortField]: sortOrder };

    console.log('Sorting configuration:', {
      sortField,
      sortOrder,
      sortObject: sort
    });

    // ✅ Helper: build OR condition from comma-separated values
    const buildFieldCondition = (field, value) => {
      const values = value
        .split(",")
        .map((v) => v.trim())
        .filter((v) => v.length > 0);
      if (values.length > 0) {
        return { $or: values.map((v) => ({ [field]: new RegExp(v, "i") })) };
      }
      return null;
    };

    // ✅ Build filters
    const andConditions = [];

    const fields = [
      "email",
      "domain",
      "companyname",
      "name",
      "website",
      "role",
    ];

    fields.forEach((f) => {
      if (req.query[f]) {
        const cond = buildFieldCondition(f, req.query[f]);
        if (cond) andConditions.push(cond);
      }
    });

    // Handle individual filter parameters from frontend
    if (req.query.name) {
      andConditions.push({ name: new RegExp(req.query.name, "i") });
    }
    if (req.query.email) {
      andConditions.push({ email: new RegExp(req.query.email, "i") });
    }
    if (req.query.companyname) {
      andConditions.push({ companyname: new RegExp(req.query.companyname, "i") });
    }
    if (req.query.website) {
      andConditions.push({ website: new RegExp(req.query.website, "i") });
    }
    if (req.query.role) {
      andConditions.push({ role: new RegExp(req.query.role, "i") });
    }

    // ✅ Boolean filter for verified
    if (req.query.isverified) {
      andConditions.push({
        isverified: req.query.isverified === "true",
      });
    }

    const filter = andConditions.length > 0 ? { $and: andConditions } : {};

    console.log('Final filter:', JSON.stringify(filter, null, 2));
    console.log('Final sort:', sort);

    // ✅ Fetch data
    const [accounts, total] = await Promise.all([
      EmailAccount.find(filter).sort(sort).skip(skip).limit(limit),
      EmailAccount.countDocuments(filter),
    ]);

    // ✅ Check auth/subscription
    const isAuthenticated = !!req.user;
    const isSubscribed =
      isAuthenticated && req.user?.subscription?.expiresAt > new Date();

    res.status(200).json({
      success: true,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      isMasked: !isSubscribed,
      data: accounts,
    });
  } catch (err) {
    console.error("getEmailAccounts error:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Failed to fetch email accounts",
    });
  }
};

// GET masked data
exports.getMaskedAccounts = async (req, res) => {
  try {
    const {
      sort = "createdAt",
      order = "desc",
      email,
      companyname,
      name,
      website,
      role,
      isverified,
      page = 1
    } = req.query;

    const MAX_TOTAL = 25;
    const NORMAL_LIMIT = 10;
    const skip = (page - 1) * MAX_TOTAL;

    console.time("QueryExecution");

    // Build efficient query
    const query = {};
    const searchTerms = [];
    
    // For exact email matches (uses email_1 index)
    if (email) {
      const emails = email.split(',').map(e => e.trim()).filter(e => e);
      if (emails.length === 1) {
        // Exact match for single email
        query.email = { $regex: emails[0], $options: 'i' };
      } else if (emails.length > 1) {
        // Multiple emails
        query.email = { $in: emails.map(e => new RegExp(e, 'i')) };
      }
    }
    
    // For company name (uses companyname_1 index)
    if (companyname) {
      const companies = companyname.split(',').map(c => c.trim()).filter(c => c);
      if (companies.length > 0) {
        query.companyname = { $in: companies.map(c => new RegExp(c, 'i')) };
      }
    }
    
    // Add other filters
    if (isverified === 'true') query.isverified = true;

    // Determine which index to use for sorting
    let hintIndex = null;
    if (sort === 'email') hintIndex = 'email_1';
    else if (sort === 'companyname') hintIndex = 'companyname_1';
    else if (sort === 'name') hintIndex = 'name_1';
    else if (sort === 'createdAt') hintIndex = 'createdAt_1';

    // Query with timeout
    const [allResults, totalCount] = await Promise.all([
      EmailAccount.find(query)
        .sort({ [sort]: order === "asc" ? 1 : -1 })
        .skip(skip)
        .limit(MAX_TOTAL)
        .maxTimeMS(5000) // 5 second timeout
        .hint(hintIndex) // Force index usage
        .lean()
        .exec(),
      
      EmailAccount.countDocuments(query)
        .maxTimeMS(3000)
        .exec()
    ]);

    // Process results
    const normalEmails = allResults.slice(0, NORMAL_LIMIT);
    const maskedEmailsRaw = allResults.slice(NORMAL_LIMIT, MAX_TOTAL);

    const maskedEmails = maskedEmailsRaw.map(item => ({
      ...item,
      email: maskEmail(item.email),
      masked: true,
    }));

    const finalResults = [...normalEmails, ...maskedEmails];
    const totalPages = Math.ceil(totalCount / MAX_TOTAL);

    console.timeEnd("QueryExecution");
    console.log(`Found ${totalCount} records in query`);

    res.json({
      data: finalResults,
      total: totalCount,
      returned: finalResults.length,
      normalCount: normalEmails.length,
      maskedCount: maskedEmails.length,
      page: parseInt(page),
      totalPages,
      limit: MAX_TOTAL,
    });
  } catch (err) {
    console.error("Error in getMaskedAccounts:", err);
    
    if (err.name === 'MongoServerError' && err.code === 50) {
      return res.status(408).json({ 
        message: "Query timeout. Try a more specific search." 
      });
    }
    
    res.status(500).json({ 
      message: "Error fetching data",
      error: err.message 
    });
  }
};

// GET single
exports.getEmailAccount = async (req, res) => {
  try {
    const account = await EmailAccount.findById(req.params.id);
    if (!account) return res.status(404).json({ message: "Record not found" });

    res
      .status(200)
      .json({ account, message: "Emailaccount details fetched successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error fetching record" });
  }
};

// POST create
exports.createEmailAccount = async (req, res) => {
  try {
    const { email } = req.body;

    if (await EmailAccount.findOne({ email })) {
      return res.status(400).json({ message: "Email already exists" });
    }

    agenda.now("verify_and_save_email", { row: req.body });

    res.status(201).json(account);
  } catch (err) {
    res.status(500).json({ message: "Error creating record" });
  }
};

// PUT update
exports.updateEmailAccount = async (req, res) => {
  try {
    const account = await EmailAccount.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!account) return res.status(404).json({ message: "Record not found" });

    res
      .status(200)
      .json({ account, message: "Email account updated successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error updating record" });
  }
};

// DELETE
exports.deleteEmailAccount = async (req, res) => {
  try {
    const result = await EmailAccount.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ message: "Record not found" });

    res.json({ message: "Record deleted" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting record" });
  }
};

exports.bulkDeleteEmailAccounts = async (req, res) => {
  try {
    const { ids } = req.body;

    // Validate input
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "No IDs provided" });
    }
    // Perform bulk delete
    const result = await EmailAccount.deleteMany({ _id: { $in: ids } });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "No records found to delete" });
    }

    res.json({
      message: `${result.deletedCount} record(s) deleted successfully`,
    });
  } catch (err) {
    console.error("Bulk delete error:", err);
    res.status(500).json({ message: "Error deleting records" });
  }
};



// DELETE duplicate email accounts, keep the first created one

exports.deleteDuplicateEmailAccounts = async (req, res) => {
  try {
    let totalDeleted = 0;
    let totalProcessed = 0;
    const batchSize = 5000;
    let skip = 0;
    let hasMore = true;

    console.log("Starting batch duplicate deletion process...");

    while (hasMore) {
      // Fetch batch of 500 records
      const batch = await EmailAccount.find({})
        .sort({ createdAt: 1 }) // Process oldest first
        .skip(skip)
        .limit(batchSize)
        .select('_id email createdAt')
        .lean();

      if (batch.length === 0) {
        hasMore = false;
        break;
      }

      console.log(`Processing batch ${skip / batchSize + 1} with ${batch.length} records`);

      // Group current batch by email to find duplicates within this batch
      const emailGroups = {};
      
      // Group records by email
      batch.forEach(record => {
        if (!emailGroups[record.email]) {
          emailGroups[record.email] = [];
        }
        emailGroups[record.email].push(record);
      });

      // Process duplicates within this batch
      const deletionPromises = [];
      let batchDeleted = 0;

      for (const [email, records] of Object.entries(emailGroups)) {
        // If multiple records with same email in this batch
        if (records.length > 1) {
          // Sort by creation date (oldest first)
          records.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
          
          // Keep the oldest, delete the rest from this batch
          const idsToDelete = records.slice(1).map(record => record._id);
          
          if (idsToDelete.length > 0) {
            deletionPromises.push(
              EmailAccount.deleteMany({ _id: { $in: idsToDelete } })
                .then(result => {
                  batchDeleted += result.deletedCount;
                })
                .catch(err => {
                  console.error(`Error deleting duplicates for email ${email}:`, err);
                })
            );
          }
        }
      }

      // Wait for all deletions in current batch to complete
      if (deletionPromises.length > 0) {
        await Promise.all(deletionPromises);
        totalDeleted += batchDeleted;
      }

      totalProcessed += batch.length;
      skip += batchSize;

      console.log(`Batch ${skip / batchSize} completed: Processed ${batch.length} records, deleted ${batchDeleted} duplicates`);
      
      // Add small delay between batches to prevent overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    res.json({
      message: `Successfully processed ${totalProcessed} records and deleted ${totalDeleted} duplicate email account(s)`,
      totalProcessed,
      totalDeleted
    });

  } catch (err) {
    console.error("Delete duplicates error:", err);
    res.status(500).json({ message: "Error deleting duplicate records" });
  }
};