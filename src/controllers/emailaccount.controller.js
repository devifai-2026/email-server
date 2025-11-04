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
    // ✅ Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // ✅ Filters
    const filter = {};
    if (req.query.email) {
      filter.email = { $regex: req.query.email, $options: "i" };
    }
    if (req.query.domain) {
      filter.domain = { $regex: req.query.domain, $options: "i" };
    }

    if (req.query.isverified) {
      filter.isverified = req.query.isverified === "true";
    }
    if (req.query.companyname) {
      filter.companyname = { $regex: req.query.companyname, $options: "i" };
    }
    if (req.query.name) {
      filter.name = { $regex: req.query.name, $options: "i" };
    }
    if (req.query.website) {
      filter.website = { $regex: req.query.website, $options: "i" };
    }
    if (req.query.role) {
      filter.role = { $regex: req.query.role, $options: "i" };
    }

    // ✅ Sorting
    const sortField = req.query.sort || "createdAt";
    const sortOrder = req.query.order === "asc" ? 1 : -1;
    const sort = { [sortField]: sortOrder };

    // ✅ Fetch accounts
    const [accounts, total] = await Promise.all([
      EmailAccount.find(filter).sort(sort).skip(skip).limit(limit),
      EmailAccount.countDocuments(filter),
    ]);

    // ✅ Check auth + subscription status
    const isAuthenticated = !!req.user;
    const isSubscribed =
      isAuthenticated && req.user?.subscription?.expiresAt > new Date();

    // ✅ Mask or show full data
    const finalData = accounts.map((acc) => {
      if (isAuthenticated && isSubscribed) {
        // full data
        return acc;
      } else {
        // masked data
        return {
          _id: acc._id,
          email: maskEmail(acc.email),
          domain: acc.domain,
          createdAt: acc.createdAt,
        };
      }
    });

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
    } = req.query;

    const MAX_TOTAL = 25;
    const NORMAL_LIMIT = 10;
    const MASKED_LIMIT = 15;

    console.log("Query params:", req.query);

    const query = {};

    // Helper to convert comma-separated search string to RegExp OR query
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

    // Build OR groups for search
    const orGroups = [];

    if (email) {
      const emailCond = buildFieldCondition("email", email);
      if (emailCond) orGroups.push(emailCond.$or);
    }

    if (companyname) {
      const companyCond = buildFieldCondition("companyname", companyname);
      if (companyCond) orGroups.push(companyCond.$or);
    }

    if (name) {
      const nameCond = buildFieldCondition("name", name);
      if (nameCond) orGroups.push(nameCond.$or);
    }

    if (website) {
      const websiteCond = buildFieldCondition("website", website);
      if (websiteCond) orGroups.push(websiteCond.$or);
    }

    if (role) {
      const roleCond = buildFieldCondition("role", role);
      if (roleCond) orGroups.push(roleCond.$or);
    }

    // Merge OR groups into AND structure
    if (orGroups.length > 0) {
      query.$and = orGroups.map((group) => ({ $or: group }));
    }

    if (isverified) query.isverified = true;

    //  Fetch normal emails (limit 10)
    const normalEmails = await EmailAccount.find(query)
      .sort({ [sort]: order === "asc" ? 1 : -1 })
      .limit(NORMAL_LIMIT);

    //  Fetch masked emails (limit 15)
    const maskedEmailsRaw = await EmailAccount.find(query)
      .sort({ [sort]: order === "asc" ? 1 : -1 })
      .skip(NORMAL_LIMIT) // skip first 10 so we don’t get duplicates
      .limit(MASKED_LIMIT);

    // Mask the email field (e.g. johndoe@example.com → joh***@example.com)

    const maskedEmails = maskedEmailsRaw.map((item) => ({
      ...item.toObject(),
      email: maskEmail(item.email),
      masked: true,
    }));

    // Merge both results
    const allResults = [...normalEmails, ...maskedEmails];

    // Count total matching documents
    const totalCount = await EmailAccount.countDocuments(query);
    const count = await EmailAccount.countDocuments(query);
    const totalPages = Math.ceil(count / 25);

    res.json({
      data: allResults,
      total: totalCount,
      returned: allResults.length,
      normalCount: normalEmails.length,
      maskedCount: maskedEmails.length,
      page: 1,
      totalPages,
      limit: MAX_TOTAL,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching data" });
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
