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
    const { email, limit = 25, page = 1 } = req.query;

    if (!email) return res.status(400).json({ message: "email filter is required" });

    const MAX_LIMIT = Math.min(parseInt(limit), 100);
    const from = (parseInt(page) - 1) * MAX_LIMIT;

    // Log the incoming query for debugging
    console.log("Searching for:", email);

    let body;
    
    // Check if it's a full email or just a domain
    if (email.includes("@")) {
      // Full email - use match query
      body = {
        size: MAX_LIMIT,
        from: from,
        sort: [{ created_at: "desc" }],
        query: {
          match: {
            email: email
          }
        }
      };
    } else {
      // Domain only - use regexp query for better performance than wildcard
      body = {
        size: MAX_LIMIT,
        from: from,
        sort: [{ created_at: "desc" }],
        query: {
          regexp: {
            email: {
              value: `.*@${email}.*`,
              flags: "ALL",
              case_insensitive: true
            }
          }
        }
      };
    }

    console.log("OpenSearch query body:", JSON.stringify(body, null, 2));

    const { data } = await axios.post(
      `${OPENSEARCH_URL}/${OPENSEARCH_INDEX}/_search`,
      body,
      { 
        auth: AUTH,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`Found ${data.hits.hits.length} results`);

    const hits = data.hits.hits;
    const totalCount = data.hits.total?.value || 0;

    // Apply masking logic
    const rows = hits.map(h => h._source);
    const normalEmails = rows.slice(0, 10);
    const maskedEmails = rows.slice(10).map(r => ({ 
      ...r, 
      email: maskEmail(r.email), 
      masked: true 
    }));

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
    console.error("Full error:", JSON.stringify(err.response?.data || err, null, 2));
    res.status(500).json({ 
      message: "Error fetching masked accounts",
      error: err.response?.data || err.message 
    });
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

    if (!email || !email.includes("@")) {
      return res.status(400).json({ message: "Please provide valid email" });
    }

    // Get PostgreSQL pool
    const pgPool = getPgPool();
    const client = await pgPool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Delete from PostgreSQL
      const pgResult = await client.query(
        'DELETE FROM email_accounts WHERE email = $1 RETURNING email',
        [email.toLowerCase().trim()]
      );
      
      if (pgResult.rowCount === 0) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(404).json({ 
          message: "Record not found in database",
          email: email 
        });
      }
      
      console.log(`Deleted email from PostgreSQL: ${email}`);
      
      // Delete from OpenSearch
      try {
        const emailId = email.toLowerCase().trim();
        const osResponse = await axios.delete(
          `${OPENSEARCH_URL}/${OPENSEARCH_INDEX}/_doc/${emailId}`,
          { 
            auth: AUTH,
            timeout: 10000
          }
        );
        
        console.log(`Deleted from OpenSearch: ${email} - Result: ${osResponse.data.result}`);
        
        await client.query('COMMIT');
        
        res.json({ 
          message: "Record deleted successfully from both databases",
          email: email,
          result: {
            postgres: "deleted",
            opensearch: osResponse.data.result
          }
        });
        
      } catch (osError) {
        // Handle OpenSearch errors
        if (osError.response?.status === 404) {
          console.log(`⚠️ ${email}: Not found in OpenSearch, but deleted from PostgreSQL`);
          
          // Commit PostgreSQL deletion anyway
          await client.query('COMMIT');
          
          return res.json({ 
            message: "Record deleted from PostgreSQL but not found in OpenSearch",
            email: email,
            result: {
              postgres: "deleted",
              opensearch: "not_found"
            }
          });
        } else {
          // Other OpenSearch errors - rollback PostgreSQL
          await client.query('ROLLBACK');
          console.error(`OpenSearch error for ${email}:`, osError.message);
          throw new Error(`OpenSearch deletion failed: ${osError.message}`);
        }
      }
      
    } catch (error) {
      // Rollback if not already handled
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Rollback error:', rollbackError.message);
      }
      throw error;
    } finally {
      client.release();
    }
    
  } catch (err) {
    console.error("deleteEmailAccount error:", {
      message: err.message,
      response: err.response?.data,
      stack: err.stack
    });
    
    // Handle specific error cases
    if (err.response?.status === 404) {
      return res.status(404).json({ message: "Record not found" });
    }
    
    res.status(500).json({ 
      message: "Error deleting record",
      error: err.message,
      details: err.response?.data || undefined
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
    
    const pgPool = getPgPool();
    const client = await pgPool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Delete from PostgreSQL using IN clause
      const placeholders = emails.map((_, i) => `$${i + 1}`).join(',');
      const deletePgQuery = `
        DELETE FROM email_accounts 
        WHERE email IN (${placeholders})
        RETURNING email
      `;
      
      const pgResult = await client.query(deletePgQuery, emails);
      const deletedFromPg = pgResult.rows.map(row => row.email);
      
      if (deletedFromPg.length === 0) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(404).json({ 
          message: "No records found in database",
          requested: emails.length,
          found: 0
        });
      }
      
      console.log(`Deleted ${deletedFromPg.length} emails from PostgreSQL:`, deletedFromPg);
      
      // Delete from OpenSearch using bulk API
      const bulkOperations = [];
      deletedFromPg.forEach(email => {
        // Clean the email for OpenSearch ID - remove special characters that might cause issues
        const emailId = email.toLowerCase().trim();
        console.log(`Preparing to delete from OpenSearch: ${email} -> ID: ${emailId}`);
        
        bulkOperations.push({ 
          delete: { 
            _index: OPENSEARCH_INDEX, 
            _id: emailId  // Try without encoding first
          } 
        });
      });
      
      const bulkBody = bulkOperations.map(op => JSON.stringify(op)).join('\n') + '\n';
      console.log('OpenSearch bulk request body:', bulkBody);
      
      try {
        const bulkResponse = await axios.post(
          `${OPENSEARCH_URL}/_bulk`,
          bulkBody,
          { 
            auth: AUTH,
            headers: { 
              'Content-Type': 'application/x-ndjson',
              'Content-Length': Buffer.byteLength(bulkBody)
            },
            timeout: 30000 // 30 second timeout
          }
        );
        
        console.log('OpenSearch bulk response:', JSON.stringify(bulkResponse.data, null, 2));
        
        // Check OpenSearch deletion results
        const osErrors = bulkResponse.data.items.filter(item => item.delete && item.delete.error);
        const deletedFromOS = bulkResponse.data.items.filter(
          item => item.delete && item.delete.result === 'deleted'
        ).length;
        
        const notDeletedFromOS = bulkResponse.data.items.filter(
          item => item.delete && item.delete.result === 'not_found'
        ).length;
        
        console.log(`OpenSearch results: ${deletedFromOS} deleted, ${notDeletedFromOS} not found, ${osErrors.length} errors`);
        
        if (osErrors.length > 0) {
          console.error("OpenSearch bulk delete errors:", osErrors);
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
            notFoundInOpenSearch: notDeletedFromOS,
            notFoundInPostgres: notFoundEmails.length,
            openSearchErrors: osErrors.length
          },
          details: {
            deletedEmails: deletedFromPg,
            notFoundEmails: notFoundEmails.length > 0 ? notFoundEmails : undefined,
            openSearchErrorDetails: osErrors.length > 0 ? osErrors.map(e => e.delete.error) : undefined
          }
        });
        
      } catch (osError) {
        console.error('OpenSearch API error:', {
          message: osError.message,
          response: osError.response?.data,
          status: osError.response?.status,
          headers: osError.response?.headers
        });
        
        // Rollback PostgreSQL deletion since OpenSearch failed
        await client.query('ROLLBACK');
        
        throw new Error(`OpenSearch deletion failed: ${osError.message}`);
      }
      
    } catch (error) {
      // Rollback already handled in the OpenSearch catch block
      if (error.message.includes('OpenSearch deletion failed')) {
        // Already rolled back
      } else {
        await client.query('ROLLBACK');
      }
      throw error;
    } finally {
      client.release();
    }
    
  } catch (err) {
    console.error("bulkDeleteEmailAccounts error:", {
      message: err.message,
      response: err.response?.data,
      stack: err.stack
    });
    
    // Handle specific error cases
    if (err.response?.status === 404) {
      return res.status(404).json({ message: "Records not found in OpenSearch" });
    }
    
    res.status(500).json({ 
      message: "Error deleting records",
      error: err.message,
      details: err.response?.data || undefined
    });
  }
};
// ====== DELETE DUPLICATES ======
// ====== DELETE DUPLICATES ======
exports.deleteDuplicateEmailAccounts = async (req, res) => {
  try {
    // Get PostgreSQL pool
    const pgPool = getPgPool();
    const client = await pgPool.connect();
    
    try {
      await client.query('BEGIN');
      
      console.log('Starting duplicate cleanup process...');
      
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
      
      if (allDuplicates.length === 0) {
        await client.query('ROLLBACK');
        client.release();
        return res.json({ 
          message: "No duplicates found",
          stats: {
            duplicatesFound: 0,
            deletedFromPostgres: 0,
            deletedFromOpenSearch: 0
          }
        });
      }
      
      console.log(`Found ${allDuplicates.length} duplicate records to clean up`);
      
      // Group duplicates by email
      const duplicatesByEmail = {};
      allDuplicates.forEach(row => {
        if (!duplicatesByEmail[row.email]) {
          duplicatesByEmail[row.email] = [];
        }
        duplicatesByEmail[row.email].push(row);
      });
      
      console.log(`Found ${Object.keys(duplicatesByEmail).length} unique emails with duplicates`);
      
      let pgDeletedCount = 0;
      let osDeletedCount = 0;
      const failedDeletions = [];
      const allOpenSearchIdsToDelete = [];
      
      // 2. First, delete all duplicates from PostgreSQL (keep only most recent)
      for (const [email, duplicateRows] of Object.entries(duplicatesByEmail)) {
        try {
          // Keep the most recent record (first in array since we sorted DESC)
          const keepRow = duplicateRows[0];
          const deleteRows = duplicateRows.slice(1); // All older duplicates
          
          // Delete from PostgreSQL - using timestamps to identify which to delete
          const timestamps = deleteRows.map(row => row.created_at);
          const placeholders = timestamps.map((_, i) => `$${i + 1}`).join(',');
          
          const deletePgQuery = `
            DELETE FROM email_accounts 
            WHERE email = $1 
            AND created_at IN (${placeholders})
            RETURNING email, created_at
          `;
          
          const params = [email, ...timestamps];
          const pgDeleteResult = await client.query(deletePgQuery, params);
          pgDeletedCount += pgDeleteResult.rowCount;
          
          console.log(`Deleted ${pgDeleteResult.rowCount} PostgreSQL duplicates for ${email}`);
          
          // Collect OpenSearch IDs to delete
          // We'll delete by email + timestamp
          deleteRows.forEach(row => {
            allOpenSearchIdsToDelete.push({
              email: email,
              timestamp: row.created_at.toISOString()
            });
          });
          
        } catch (emailError) {
          console.error(`Error processing duplicates for ${email}:`, emailError.message);
          failedDeletions.push({
            email,
            error: emailError.message
          });
        }
      }
      
      console.log(`Deleted ${pgDeletedCount} duplicates from PostgreSQL`);
      
      // 3. Now delete from OpenSearch in bulk
      if (allOpenSearchIdsToDelete.length > 0) {
        // First, search for all these duplicates in OpenSearch
        const searchBody = {
          query: {
            bool: {
              should: allOpenSearchIdsToDelete.map(item => ({
                bool: {
                  must: [
                    { term: { "email.keyword": item.email } },
                    { term: { "created_at": item.timestamp } }
                  ]
                }
              }))
            }
          },
          size: 1000
        };
        
        try {
          const searchResponse = await axios.post(
            `${OPENSEARCH_URL}/${OPENSEARCH_INDEX}/_search`,
            searchBody,
            { auth: AUTH, timeout: 30000 }
          );
          
          const hitsToDelete = searchResponse.data.hits.hits;
          console.log(`Found ${hitsToDelete.length} matching documents in OpenSearch`);
          
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
            
            try {
              const bulkResponse = await axios.post(
                `${OPENSEARCH_URL}/_bulk`,
                bulkBody,
                { 
                  auth: AUTH,
                  headers: { 
                    'Content-Type': 'application/x-ndjson',
                    'Content-Length': Buffer.byteLength(bulkBody)
                  },
                  timeout: 30000
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
                console.warn(`OpenSearch deletion errors:`, errors.length);
                errors.forEach((error, index) => {
                  const email = allOpenSearchIdsToDelete[index]?.email || 'unknown';
                  failedDeletions.push({
                    email,
                    error: error.delete.error
                  });
                });
              }
              
              console.log(`Deleted ${successfulDeletes} duplicates from OpenSearch`);
              
            } catch (bulkError) {
              console.error('OpenSearch bulk delete error:', bulkError.message);
              failedDeletions.push({
                error: 'OpenSearch bulk operation failed',
                details: bulkError.message
              });
            }
          }
          
        } catch (searchError) {
          console.error('OpenSearch search error:', searchError.message);
          failedDeletions.push({
            error: 'OpenSearch search failed',
            details: searchError.message
          });
        }
      }
      
      await client.query('COMMIT');
      
      res.json({ 
        message: "Duplicate cleanup completed",
        stats: {
          totalDuplicatesFound: allDuplicates.length,
          uniqueDuplicateEmails: Object.keys(duplicatesByEmail).length,
          deletedFromPostgres: pgDeletedCount,
          deletedFromOpenSearch: osDeletedCount,
          failedOperations: failedDeletions.length
        },
        details: failedDeletions.length > 0 ? { 
          note: "Some operations failed, but transaction was committed for successful ones",
          failedDeletions: failedDeletions.slice(0, 10) // Limit output
        } : undefined
      });
      
    } catch (err) {
      await client.query('ROLLBACK');
      console.error("deleteDuplicateEmailAccounts transaction error:", err.message);
      throw err;
    } finally {
      client.release();
    }
    
  } catch (err) {
    console.error("deleteDuplicateEmailAccounts error:", {
      message: err.message,
      response: err.response?.data,
      stack: err.stack
    });
    
    res.status(500).json({ 
      message: "Error deleting duplicates",
      error: err.message,
      details: err.response?.data || undefined
    });
  }
};


// ====== DELETE ALL EMAIL ACCOUNTS ======
exports.deleteAllEmailAccounts = async (req, res) => {
  try {
    // Get PostgreSQL pool
    const pgPool = getPgPool();
    const client = await pgPool.connect();
    
    try {
      await client.query('BEGIN');
      
      console.log('Starting deletion of all email accounts...');
      
      // 1. First, just count the total records
      const countQuery = `SELECT COUNT(*) as total FROM email_accounts`;
      const countResult = await client.query(countQuery);
      const totalRecords = parseInt(countResult.rows[0].total);
      
      if (totalRecords === 0) {
        await client.query('ROLLBACK');
        client.release();
        return res.json({ 
          message: "No email accounts found in database",
          stats: {
            totalRecords: 0,
            deletedFromPostgres: 0,
            deletedFromOpenSearch: 0
          }
        });
      }
      
      console.log(`Found ${totalRecords} email accounts to delete`);
      
      // 2. Delete from PostgreSQL using TRUNCATE for efficiency
      // This is much faster and doesn't load records into memory
      console.log('Deleting from PostgreSQL...');
      const deleteAllPgQuery = `TRUNCATE TABLE email_accounts`;
      await client.query(deleteAllPgQuery);
      console.log(`Deleted ${totalRecords} records from PostgreSQL`);
      
      // 3. Delete from OpenSearch using delete_by_query (most efficient for large datasets)
      console.log('Starting OpenSearch deletion...');
      let osDeletedCount = 0;
      const failedDeletions = [];
      
      try {
        // Use delete_by_query to delete all documents efficiently
        const deleteByQueryBody = {
          query: {
            match_all: {}
          }
        };
        
        console.log('Sending delete_by_query to OpenSearch...');
        const deleteByQueryResponse = await axios.post(
          `${OPENSEARCH_URL}/${OPENSEARCH_INDEX}/_delete_by_query?conflicts=proceed&refresh=true&wait_for_completion=false`,
          deleteByQueryBody,
          { 
            auth: AUTH,
            timeout: 120000 // 120 seconds for large dataset
          }
        );
        
        // Get the task ID to monitor progress
        const taskId = deleteByQueryResponse.data.task;
        console.log(`OpenSearch delete task started: ${taskId}`);
        
        // Poll for task completion
        let taskCompleted = false;
        let attempts = 0;
        const maxAttempts = 120; // 10 minutes maximum
        
        while (!taskCompleted && attempts < maxAttempts) {
          attempts++;
          await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
          
          try {
            const taskResponse = await axios.get(
              `${OPENSEARCH_URL}/_tasks/${taskId}`,
              { auth: AUTH, timeout: 30000 }
            );
            
            const task = taskResponse.data.task;
            console.log(`Task progress: ${task.status.total} total, ${task.status.deleted} deleted, ${task.status.created} created, ${task.status.updated} updated`);
            
            if (task.completed) {
              taskCompleted = true;
              osDeletedCount = task.response.deleted || 0;
              console.log(`OpenSearch deletion completed: ${osDeletedCount} records deleted`);
              
              // Check for failures in the task
              if (task.response.failures && task.response.failures.length > 0) {
                console.warn(`OpenSearch had ${task.response.failures.length} failures`);
                failedDeletions.push({
                  error: 'Some OpenSearch deletions failed',
                  totalFailures: task.response.failures.length,
                  sampleFailures: task.response.failures.slice(0, 3)
                });
              }
            }
          } catch (taskError) {
            console.error(`Error checking task status (attempt ${attempts}):`, taskError.message);
          }
        }
        
        if (!taskCompleted) {
          console.warn('OpenSearch deletion task timed out after maximum attempts');
          failedDeletions.push({
            error: 'OpenSearch deletion task timed out',
            taskId: taskId
          });
        }
        
      } catch (osError) {
        console.error('OpenSearch deletion error:', osError.message);
        
        // Try alternative approach if delete_by_query fails
        try {
          console.log('Trying alternative deletion method...');
          
          // Try to delete the entire index if that's acceptable
          // WARNING: This will delete the index entirely
          const deleteIndexResponse = await axios.delete(
            `${OPENSEARCH_URL}/${OPENSEARCH_INDEX}`,
            { auth: AUTH, timeout: 30000 }
          );
          
          console.log(`OpenSearch index deleted successfully`);
          osDeletedCount = totalRecords; // Assuming all were deleted
          
        } catch (indexError) {
          console.error('Failed to delete OpenSearch index:', indexError.message);
          failedDeletions.push({
            error: 'All OpenSearch deletion attempts failed',
            details: indexError.message
          });
        }
      }
      
      await client.query('COMMIT');
      
      // Prepare response
      const response = {
        message: "All email accounts deleted successfully",
        stats: {
          totalRecords: totalRecords,
          deletedFromPostgres: totalRecords,
          deletedFromOpenSearch: osDeletedCount,
          failedOperations: failedDeletions.length
        },
        timestamp: new Date().toISOString()
      };
      
      // Add details if there were failures
      if (failedDeletions.length > 0) {
        response.details = {
          note: "Some OpenSearch deletions may have failed, but all PostgreSQL records were deleted",
          failures: failedDeletions
        };
      }
      
      res.json(response);
      
    } catch (err) {
      await client.query('ROLLBACK');
      console.error("deleteAllEmailAccounts transaction error:", err.message);
      throw err;
    } finally {
      client.release();
    }
    
  } catch (err) {
    console.error("deleteAllEmailAccounts error:", {
      message: err.message,
      response: err.response?.data,
      stack: err.stack
    });
    
    res.status(500).json({ 
      message: "Error deleting all email accounts",
      error: err.message,
      details: err.response?.data || undefined
    });
  }
};