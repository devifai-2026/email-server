// controllers/emailAccount.controller.js
const axios = require("axios");
// In your controller file
const { getPgPool } = require('../config/db'); // Adjust path as needed

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

    /* ---------- SAFE SORT ---------- */
    const sort = [{ email: "asc" }];

    const must = [];
    const should = [];

    /* ---------- EMAIL / DOMAIN FIX ---------- */
    if (email) {
      const values = email.split(",").map(v =>
        v.trim().replace(/^www\./, "").toLowerCase()
      );

      values.forEach(value => {
        if (value.includes("@")) {
          // ✅ real email
          should.push({ term: { email: value } });
        } else {
          // ✅ domain → search website
          should.push({
            wildcard: {
              website: `*${value}`
            }
          });
        }
      });
    }

    /* ---------- WEBSITE PARAM (CORRECT ONE) ---------- */
    if (website) {
      const domains = website.split(",").map(v =>
        v.trim().replace(/^www\./, "").toLowerCase()
      );

      domains.forEach(domain => {
        should.push({
          wildcard: {
            website: `*${domain}`
          }
        });
      });
    }

    /* ---------- OTHER FILTERS ---------- */
    if (companyname) {
      must.push({ match_phrase_prefix: { companyname } });
    }

    if (name) {
      must.push({ match_phrase_prefix: { name } });
    }

    if (role) {
      must.push({ match_phrase_prefix: { role } });
    }

    /* ---------- QUERY BUILD ---------- */
    const query = {
      bool: {
        must,
        ...(should.length ? { should, minimum_should_match: 1 } : {})
      }
    };

    const body = {
      from,
      size,
      sort,
      track_total_hits: true,
      query: must.length || should.length ? query : { match_all: {} }
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

    const data = hits.map(hit => ({
      _id: hit._id,
      is_verified: false,
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
    const email = req.params.id; // This is for single deletion via URL parameter

    if (!email || !email.includes("@")) {
      return res.status(400).json({ message: "Please provide valid email" });
    }

    const client = await pgPool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Delete from PostgreSQL
      const pgResult = await client.query(
        'DELETE FROM email_accounts WHERE email = $1 RETURNING email',
        [email]
      );
      
      if (pgResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: "Record not found in database" });
      }
      
      // Delete from OpenSearch
      await axios.delete(
        `${OPENSEARCH_URL}/${OPENSEARCH_INDEX}/_doc/${encodeURIComponent(email)}`,
        { auth: AUTH }
      );
      
      await client.query('COMMIT');
      
      res.json({ 
        message: "Record deleted successfully from both databases",
        email: email 
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      
      // Check if it's a 404 from OpenSearch
      if (error.response?.status === 404) {
        // Record was deleted from PostgreSQL but not found in OpenSearch
        // Commit the PostgreSQL deletion anyway
        await client.query('COMMIT');
        return res.json({ 
          message: "Record deleted from PostgreSQL but not found in OpenSearch",
          email: email 
        });
      }
      throw error;
    } finally {
      client.release();
    }
    
  } catch (err) {
    console.error("deleteEmailAccount error:", err.response?.data || err.message);
    
    if (err.response?.status === 404) {
      return res.status(404).json({ message: "Record not found" });
    }
    
    res.status(500).json({ 
      message: "Error deleting record",
      error: err.message 
    });
  }
};

// ====== BULK DELETE ======
// ====== BULK DELETE ======
exports.bulkDeleteEmailAccounts = async (req, res) => {
  try {
    // Get emails from request body (accept both 'emails' or 'ids' field)
    const emails = req.body.emails || req.body.ids;
    
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ message: "No emails provided" });
    }

    // Validate emails
    const invalidEmails = emails.filter(e => !e || typeof e !== 'string' || !e.includes("@"));
    if (invalidEmails.length > 0) {
      return res.status(400).json({ 
        message: "Invalid emails found", 
        invalid: invalidEmails 
      });
    }
    const pgPool = getPgPool()
    const client = await pgPool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Delete from PostgreSQL using IN clause
      const placeholders = emails.map((_, i) => `$${i + 1}`).join(',');
      const deletePgQuery = `
        DELETE FROM email_accounts 
        WHERE email IN (${placeholders})
        RETURNING email, id
      `;
      
      const pgResult = await client.query(deletePgQuery, emails);
      const deletedFromPg = pgResult.rows.map(row => row.email);
      
      if (deletedFromPg.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ 
          message: "No records found in database",
          requested: emails.length,
          found: 0
        });
      }
      
      // Delete from OpenSearch using bulk API
      const bulkOperations = [];
      deletedFromPg.forEach(email => {
        bulkOperations.push({ 
          delete: { 
            _index: OPENSEARCH_INDEX, 
            _id: encodeURIComponent(email) 
          } 
        });
      });
      
      const bulkBody = bulkOperations.map(op => JSON.stringify(op)).join('\n') + '\n';
      const bulkResponse = await axios.post(
        `${OPENSEARCH_URL}/_bulk`,
        bulkBody,
        { 
          auth: AUTH,
          headers: { 'Content-Type': 'application/x-ndjson' }
        }
      );
      
      // Check OpenSearch deletion results
      const osErrors = bulkResponse.data.items.filter(item => item.delete && item.delete.error);
      const deletedFromOS = bulkResponse.data.items.filter(
        item => item.delete && item.delete.result === 'deleted'
      ).length;
      
      // If there are OpenSearch errors, decide whether to rollback
      if (osErrors.length > 0) {
        console.error("OpenSearch bulk delete errors:", osErrors);
        // Option 1: Commit anyway (PostgreSQL deletions succeeded)
        // Option 2: Rollback on critical errors
        
        // For now, we'll commit PostgreSQL deletions and report OS errors
        // You can change this based on your requirements
      }
      
      await client.query('COMMIT');
      
      // Find which emails weren't deleted from PostgreSQL
      const notFoundEmails = emails.filter(email => !deletedFromPg.includes(email));
      
      res.json({ 
        message: "Bulk delete completed",
        stats: {
          requested: emails.length,
          deletedFromPostgres: deletedFromPg.length,
          deletedFromOpenSearch: deletedFromOS,
          notFoundInPostgres: notFoundEmails.length,
          openSearchErrors: osErrors.length
        },
        details: {
          deletedEmails: deletedFromPg,
          notFoundEmails: notFoundEmails.length > 0 ? notFoundEmails : undefined,
          openSearchErrorDetails: osErrors.length > 0 ? osErrors.map(e => e.delete.error) : undefined
        }
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (err) {
    console.error("bulkDeleteEmailAccounts error:", err.response?.data || err.message);
    
    // Handle specific error cases
    if (err.response?.status === 404) {
      return res.status(404).json({ message: "Records not found in OpenSearch" });
    }
    
    res.status(500).json({ 
      message: "Error deleting records",
      error: err.message 
    });
  }
};

// ====== DELETE DUPLICATES ======
exports.deleteDuplicateEmailAccounts = async (req, res) => {
  const client = await pgPool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1. Find duplicates in PostgreSQL
    const pgDuplicatesQuery = `
      WITH duplicates AS (
        SELECT email, 
               created_at,
               ROW_NUMBER() OVER (PARTITION BY email ORDER BY created_at DESC) as rn
        FROM email_accounts
      )
      SELECT email, created_at
      FROM duplicates 
      WHERE rn > 1
      ORDER BY email, created_at DESC
    `;
    
    const pgResult = await client.query(pgDuplicatesQuery);
    const allDuplicates = pgResult.rows;
    
    // Group duplicates by email
    const duplicatesByEmail = {};
    allDuplicates.forEach(row => {
      if (!duplicatesByEmail[row.email]) {
        duplicatesByEmail[row.email] = [];
      }
      duplicatesByEmail[row.email].push(row);
    });
    
    let pgDeletedCount = 0;
    let osDeletedCount = 0;
    const failedDeletions = [];
    
    // 2. Process each duplicate group
    for (const [email, duplicateRows] of Object.entries(duplicatesByEmail)) {
      try {
        // Keep the most recent record (first in array since we sorted DESC)
        const keepRow = duplicateRows[0];
        const deleteRows = duplicateRows.slice(1); // All older duplicates
        
        // Delete from PostgreSQL
        const placeholders = deleteRows.map((_, i) => `$${i + 1}`).join(',');
        const deleteIds = deleteRows.map(row => row.id); // Assuming you have an 'id' column
        
        const deletePgQuery = `
          DELETE FROM email_accounts 
          WHERE id IN (${placeholders})
          RETURNING id, email, created_at
        `;
        
        const pgDeleteResult = await client.query(deletePgQuery, deleteIds);
        pgDeletedCount += pgDeleteResult.rowCount;
        
        // Delete from OpenSearch
        // First, find the OpenSearch documents for these duplicates
        const searchBody = {
          query: {
            bool: {
              must: [
                { term: { "email.keyword": email } },
                { 
                  bool: {
                    should: deleteRows.map(row => ({
                      term: { "created_at": row.created_at.toISOString() }
                    }))
                  }
                }
              ]
            }
          },
          size: 100
        };
        
        const searchResponse = await axios.post(
          `${OPENSEARCH_URL}/${OPENSEARCH_INDEX}/_search`,
          searchBody,
          { auth: AUTH }
        );
        
        const hitsToDelete = searchResponse.data.hits.hits;
        
        if (hitsToDelete.length > 0) {
          // Prepare bulk delete
          const bulkOperations = [];
          hitsToDelete.forEach(hit => {
            bulkOperations.push({ 
              delete: { 
                _index: OPENSEARCH_INDEX, 
                _id: hit._id 
              } 
            });
          });
          
          const bulkBody = bulkOperations.map(op => JSON.stringify(op)).join('\n') + '\n';
          const bulkResponse = await axios.post(
            `${OPENSEARCH_URL}/_bulk`,
            bulkBody,
            { 
              auth: AUTH,
              headers: { 'Content-Type': 'application/x-ndjson' }
            }
          );
          
          // Count successful deletions
          const successfulDeletes = bulkResponse.data.items.filter(
            item => item.delete && item.delete.result === 'deleted'
          ).length;
          
          osDeletedCount += successfulDeletes;
          
          // Log any errors
          const errors = bulkResponse.data.items.filter(
            item => item.delete && item.delete.error
          );
          
          if (errors.length > 0) {
            console.warn(`OpenSearch deletion errors for ${email}:`, errors);
            failedDeletions.push({
              email,
              errors: errors.map(e => e.delete.error)
            });
          }
        }
        
      } catch (emailError) {
        console.error(`Error processing duplicates for ${email}:`, emailError.message);
        failedDeletions.push({
          email,
          error: emailError.message
        });
        // Continue with next email instead of failing entire batch
      }
    }
    
    await client.query('COMMIT');
    
    res.json({ 
      message: "Duplicate cleanup completed",
      stats: {
        totalDuplicatesFound: allDuplicates.length,
        duplicateEmails: Object.keys(duplicatesByEmail).length,
        deletedFromPostgres: pgDeletedCount,
        deletedFromOpenSearch: osDeletedCount,
        failedOperations: failedDeletions.length
      },
      details: failedDeletions.length > 0 ? { failedDeletions } : undefined
    });
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("deleteDuplicateEmailAccounts error:", err.response?.data || err.message);
    res.status(500).json({ 
      message: "Error deleting duplicates",
      error: err.message 
    });
  } finally {
    client.release();
  }
};