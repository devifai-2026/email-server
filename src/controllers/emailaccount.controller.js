// controllers/emailAccount.controller.js
const axios = require("axios");
const OPENSEARCH_INDEX = "email_accounts";
const OPENSEARCH_URL =
  "https://vpc-email-search-uzaqvpiyheutyfluip6kc244fu.ap-south-1.es.amazonaws.com";

const AUTH = {
  username: "postgres",
  password: "emailFinder@2025"
};

const INDEX = "email_accounts"; // ✅ ADD THIS LINE

const pageCursorMap = new Map();

// Helper: mask email
const maskEmail = (email) => {
  if (!email || typeof email !== "string") return email;
  const [user, domain] = email.split("@");
  if (!user || !domain) return email;
  const visible = user.slice(0, 3);
  return `${visible}${"*".repeat(Math.max(3, user.length - 3))}@${domain}`;
};

// ====== GET EMAIL ACCOUNTS WITH FILTERS, PAGINATION ======
exports.getEmailAccounts = async (req, res) => {
  try {
    const {
      email,
      companyname,
      name,
      role,
      website,
      page = 1,
      limit = 100
    } = req.query;

    const pageNum = Math.max(parseInt(page) || 1, 1);
    const size = Math.min(parseInt(limit) || 100, 1000);
    const from = (pageNum - 1) * size;

    /* ---------- SAFE SORT (KEYWORD FIELD) ---------- */
    const sort = [{ "email.keyword": "asc" }];

    /* ---------- FILTERS ---------- */
    const must = [];

    if (email) {
      must.push({ term: { "email.keyword": email.toLowerCase() } });
    }

    if (website) {
      // Normalize the search term: remove www. and https?://
      let normalizedWebsite = website.toLowerCase();
      normalizedWebsite = normalizedWebsite.replace(/^https?:\/\//, '');
      normalizedWebsite = normalizedWebsite.replace(/^www\./, '');
      
      // Search using wildcard to match any variation
      must.push({
        wildcard: {
          "website.keyword": {
            value: `*${normalizedWebsite}*`,
            case_insensitive: true
          }
        }
      });
      
      // OR use regexp query for more flexible matching
      // must.push({
      //   regexp: {
      //     "website.keyword": `.*${normalizedWebsite.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*`
      //   }
      // });
    }

    if (companyname) {
      must.push({ match_phrase_prefix: { companyname } });
    }

    if (name) {
      must.push({ match_phrase_prefix: { name } });
    }

    if (role) {
      must.push({ match_phrase_prefix: { role } });
    }

    const body = {
      from,
      size,
      sort,
      track_total_hits: true,
      query: must.length ? { bool: { must } } : { match_all: {} }
    };

    /* ---------- SEARCH ---------- */
    const response = await axios.post(
      `${OPENSEARCH_URL}/${INDEX}/_search`,
      body,
      { auth: AUTH }
    );

    const hits = response.data.hits.hits;
    const total = response.data.hits.total.value;
    const totalPages = Math.ceil(total / size);

    /* ---------- FIX DATA SHAPE ---------- */
    const data = hits.map(hit => ({
      _id: hit._id,
      is_verified: hit._source.is_verified || false,
      ...hit._source
    }));

    res.json({
      success: true,
      total,
      totalPages,
      page: pageNum,
      limit: size,
      count: data.length,
      data
    });

  } catch (err) {
    console.error("Search error:", err.response?.data || err.message);
    res.status(500).json({
      success: false,
      error: err.response?.data || err.message
    });
  }
};


// ====== GET MASKED EMAILS ======
exports.getMaskedAccounts = async (req, res) => {
  try {
    const { companyname, limit = 25, page = 1 } = req.query;

    if (!companyname) return res.status(400).json({ message: "companyname filter is required" });

    const MAX_LIMIT = Math.min(parseInt(limit), 100);
    const from = (parseInt(page) - 1) * MAX_LIMIT;

    const body = {
      size: MAX_LIMIT,
      from: from,
      sort: [
        { created_at: "desc" }
      ],
      query: {
        match: {
          companyname: companyname
        }
      }
    };

    const { data } = await axios.post(
      `${OPENSEARCH_URL}/${OPENSEARCH_INDEX}/_search`,
      body,
      { auth: AUTH }
    );

    const hits = data.hits.hits;
    const totalCount = data.hits.total?.value || 0;

    // Apply masking logic
    const rows = hits.map(h => h._source);
    const normalEmails = rows.slice(0, 10);
    const maskedEmails = rows.slice(10).map(r => ({ ...r, email: maskEmail(r.email), masked: true }));

    res.json({
      data: [...normalEmails, ...maskedEmails],
      total: totalCount,
      returned: rows.length,
      normalCount: normalEmails.length,
      maskedCount: maskedEmails.length,
      page: parseInt(page),
      totalPages: Math.ceil(totalCount / MAX_LIMIT),
      limit: MAX_LIMIT,
    });
  } catch (err) {
    console.error("getMaskedAccounts error:", err.response?.data || err.message);
    res.status(500).json({ message: "Error fetching masked accounts" });
  }
};

// ====== GET SINGLE EMAIL ACCOUNT ======
exports.getEmailAccount = async (req, res) => {
  try {
    const email = req.params.id;

    if (!email.includes("@")) return res.status(400).json({ message: "Please provide valid email" });

    const body = {
      query: {
        term: {
          email: email
        }
      }
    };

    const { data } = await axios.post(
      `${OPENSEARCH_URL}/${OPENSEARCH_INDEX}/_search`,
      body,
      { auth: AUTH }
    );

    if (data.hits.hits.length === 0) return res.status(404).json({ message: "Record not found" });

    res.status(200).json({ account: data.hits.hits[0]._source, message: "Email account fetched successfully" });
  } catch (err) {
    console.error("getEmailAccount error:", err.response?.data || err.message);
    res.status(500).json({ message: "Error fetching record" });
  }
};

// ====== CREATE EMAIL ACCOUNT ======
exports.createEmailAccount = async (req, res) => {
  try {
    const { email, name, companyname, role, website, linkedin } = req.body;

    if (!email) return res.status(400).json({ message: "Email is required" });

    const accountData = {
      email,
      name: name || null,
      companyname: companyname || null,
      role: role || null,
      website: website || null,
      linkedin: linkedin || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_verified: true
    };

    // Create document in OpenSearch
    const response = await axios.put(
      `${OPENSEARCH_URL}/${OPENSEARCH_INDEX}/_doc/${encodeURIComponent(email)}`,
      accountData,
      { auth: AUTH }
    );

    res.status(201).json({ 
      account: accountData, 
      message: "Email account created successfully",
      _id: response.data._id 
    });
  } catch (err) {
    console.error("createEmailAccount error:", err.response?.data || err.message);
    res.status(500).json({ message: "Error creating record" });
  }
};

// ====== UPDATE EMAIL ACCOUNT ======
exports.updateEmailAccount = async (req, res) => {
  try {
    const emailParam = req.params.id;
    const updates = req.body;

    if (!emailParam.includes("@")) return res.status(400).json({ message: "Email is required" });

    // First, get existing document
    const getResponse = await axios.get(
      `${OPENSEARCH_URL}/${OPENSEARCH_INDEX}/_doc/${encodeURIComponent(emailParam)}`,
      { auth: AUTH }
    );

    if (!getResponse.data.found) return res.status(404).json({ message: "Record not found" });

    // Merge updates with existing data
    const existingData = getResponse.data._source;
    const updatedData = {
      ...existingData,
      ...updates,
      updated_at: new Date().toISOString()
    };

    // Update document in OpenSearch
    await axios.put(
      `${OPENSEARCH_URL}/${OPENSEARCH_INDEX}/_doc/${encodeURIComponent(emailParam)}`,
      updatedData,
      { auth: AUTH }
    );

    res.status(200).json({ account: updatedData, message: "Email account updated successfully" });
  } catch (err) {
    if (err.response?.status === 404) {
      return res.status(404).json({ message: "Record not found" });
    }
    console.error("updateEmailAccount error:", err.response?.data || err.message);
    res.status(500).json({ message: "Error updating record" });
  }
};

// ====== DELETE SINGLE EMAIL ACCOUNT ======
exports.deleteEmailAccount = async (req, res) => {
  try {
    const email = req.params.id;

    if (!email.includes("@")) return res.status(400).json({ message: "Please provide valid email" });

    // Delete document from OpenSearch
    await axios.delete(
      `${OPENSEARCH_URL}/${OPENSEARCH_INDEX}/_doc/${encodeURIComponent(email)}`,
      { auth: AUTH }
    );

    res.json({ message: "Record deleted successfully" });
  } catch (err) {
    if (err.response?.status === 404) {
      return res.status(404).json({ message: "Record not found" });
    }
    console.error("deleteEmailAccount error:", err.response?.data || err.message);
    res.status(500).json({ message: "Error deleting record" });
  }
};

// ====== BULK DELETE ======
exports.bulkDeleteEmailAccounts = async (req, res) => {
  try {
    const { emails } = req.body;

    if (!emails || !Array.isArray(emails) || emails.length === 0)
      return res.status(400).json({ message: "No emails provided" });

    const invalid = emails.filter(e => !e.includes("@"));
    if (invalid.length > 0) return res.status(400).json({ message: "Invalid emails found", invalid });

    // Prepare bulk delete operations
    const bulkOperations = [];
    emails.forEach(email => {
      bulkOperations.push({ delete: { _index: OPENSEARCH_INDEX, _id: encodeURIComponent(email) } });
    });

    // Execute bulk delete
    const bulkBody = bulkOperations.map(op => JSON.stringify(op)).join('\n') + '\n';
    const response = await axios.post(
      `${OPENSEARCH_URL}/_bulk`,
      bulkBody,
      { 
        auth: AUTH,
        headers: { 'Content-Type': 'application/x-ndjson' }
      }
    );

    // Check for errors in bulk response
    const errors = response.data.items.filter(item => item.delete && item.delete.error);
    if (errors.length > 0) {
      console.error("Bulk delete errors:", errors);
    }

    const deletedCount = response.data.items.filter(item => item.delete && item.delete.result === 'deleted').length;

    res.json({ 
      message: `${deletedCount} records deleted successfully`,
      totalRequested: emails.length,
      actuallyDeleted: deletedCount
    });
  } catch (err) {
    console.error("bulkDeleteEmailAccounts error:", err.response?.data || err.message);
    res.status(500).json({ message: "Error deleting records" });
  }
};

// ====== DELETE DUPLICATES ======
exports.deleteDuplicateEmailAccounts = async (req, res) => {
  try {
    // Find duplicate emails using terms aggregation
    const aggBody = {
      size: 0,
      aggs: {
        duplicate_emails: {
          terms: {
            field: "email.keyword",
            min_doc_count: 2,
            size: 1000
          }
        }
      }
    };

    const { data } = await axios.post(
      `${OPENSEARCH_URL}/${OPENSEARCH_INDEX}/_search`,
      aggBody,
      { auth: AUTH }
    );

    const duplicates = data.aggregations.duplicate_emails.buckets.map(bucket => bucket.key);
    let deletedCount = 0;

    // For each duplicate, keep the most recent one (based on created_at) and delete the rest
    for (const email of duplicates) {
      // Get all documents with this email, sorted by created_at
      const searchBody = {
        query: {
          term: { "email.keyword": email }
        },
        sort: [
          { created_at: "desc" }
        ]
      };

      const searchResponse = await axios.post(
        `${OPENSEARCH_URL}/${OPENSEARCH_INDEX}/_search`,
        searchBody,
        { auth: AUTH }
      );

      const hits = searchResponse.data.hits.hits;
      
      // Keep the first (most recent) document, delete the rest
      if (hits.length > 1) {
        const docsToDelete = hits.slice(1); // All except the first one
        
        // Prepare bulk delete for duplicates
        const bulkOperations = [];
        docsToDelete.forEach(hit => {
          bulkOperations.push({ delete: { _index: OPENSEARCH_INDEX, _id: hit._id } });
        });

        if (bulkOperations.length > 0) {
          const bulkBody = bulkOperations.map(op => JSON.stringify(op)).join('\n') + '\n';
          const bulkResponse = await axios.post(
            `${OPENSEARCH_URL}/_bulk`,
            bulkBody,
            { 
              auth: AUTH,
              headers: { 'Content-Type': 'application/x-ndjson' }
            }
          );
          
          deletedCount += docsToDelete.length;
        }
      }
    }

    res.json({ 
      message: `Deleted ${deletedCount} duplicate records`, 
      duplicatesFound: duplicates.length,
      actuallyDeleted: deletedCount 
    });
  } catch (err) {
    console.error("deleteDuplicateEmailAccounts error:", err.response?.data || err.message);
    res.status(500).json({ message: "Error deleting duplicates" });
  }
};