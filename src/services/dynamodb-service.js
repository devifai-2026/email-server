// services/dynamodb-service.js
const AWS = require("aws-sdk");
const dynamodb = new AWS.DynamoDB.DocumentClient({
  region: process.env.AWS_REGION || "ap-south-1",
  maxRetries: 3
});

const TABLE_NAME = "EmailAccounts";
const COMPANY_GSI_NAME = "companyname-index"; // Your GSI

class DynamoDBService {
  constructor() {
    this.cache = new Map();
    this.cacheTTL = 30000; // 30 second cache
  }

  // ========== FAST QUERY USING GSI (MILLISECONDS) ==========

  // Main query method for company searches
  async queryByCompany(companyName, limit = 100, lastKey = null) {
    const cacheKey = `query_company_${companyName}_${limit}_${lastKey ? JSON.stringify(lastKey) : 'first'}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      console.log(`Cache hit for company: ${companyName}`);
      return cached.value;
    }

    try {
      const params = {
        TableName: TABLE_NAME,
        IndexName: COMPANY_GSI_NAME,
        KeyConditionExpression: "companyname = :company",
        ExpressionAttributeValues: {
          ':company': companyName
        },
        Limit: limit,
        ExclusiveStartKey: lastKey,
        ScanIndexForward: false // Descending by createdAt
      };

      console.log(`Executing GSI query for company: ${companyName}`);
      const startTime = Date.now();
      const result = await dynamodb.query(params).promise();
      const queryTime = Date.now() - startTime;
      
      console.log(`GSI query completed in ${queryTime}ms, found ${result.Count} items`);

      const response = {
        items: result.Items || [],
        lastKey: result.LastEvaluatedKey,
        count: result.Count || 0,
        scannedCount: result.ScannedCount || 0
      };

      // Cache for 30 seconds
      this.cache.set(cacheKey, { value: response, timestamp: Date.now() });
      return response;

    } catch (error) {
      console.error(`GSI query error for company ${companyName}:`, error.message);
      
      // If GSI not ready yet, provide helpful message
      if (error.code === 'ResourceNotFoundException' || error.message.includes('index')) {
        throw new Error(`GSI '${COMPANY_GSI_NAME}' not active yet. Please wait a few minutes. Current status: CREATING`);
      }
      throw error;
    }
  }

  // Fast count using GSI
  async countByCompany(companyName) {
    const cacheKey = `count_company_${companyName}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.value;
    }

    try {
      const params = {
        TableName: TABLE_NAME,
        IndexName: COMPANY_GSI_NAME,
        KeyConditionExpression: "companyname = :company",
        ExpressionAttributeValues: {
          ':company': companyName
        },
        Select: 'COUNT'
      };

      const result = await dynamodb.query(params).promise();
      const count = result.Count || 0;
      
      this.cache.set(cacheKey, { value: count, timestamp: Date.now() });
      return count;

    } catch (error) {
      console.error(`Count error for company ${companyName}:`, error.message);
      return 0;
    }
  }

  // ========== OTHER INDEX QUERIES (ADD AS NEEDED) ==========

  // Query by role (when you create role-index GSI)
  async queryByRole(role, limit = 100, lastKey = null) {
    const params = {
      TableName: TABLE_NAME,
      IndexName: 'role-index', // Create this GSI later
      KeyConditionExpression: "role = :role",
      ExpressionAttributeValues: {
        ':role': role
      },
      Limit: limit,
      ExclusiveStartKey: lastKey
    };

    try {
      const result = await dynamodb.query(params).promise();
      return {
        items: result.Items || [],
        lastKey: result.LastEvaluatedKey,
        count: result.Count || 0
      };
    } catch (error) {
      console.error(`Role query error:`, error.message);
      throw error;
    }
  }

  // ========== PRIMARY KEY OPERATIONS (SUPER FAST) ==========

  // Get by email (1-10ms)
  async getByEmail(email) {
    const cacheKey = `email_${email}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.value;
    }

    const params = {
      TableName: TABLE_NAME,
      Key: { email }
    };

    try {
      const result = await dynamodb.get(params).promise();
      const item = result.Item || null;
      
      if (item) {
        this.cache.set(cacheKey, { value: item, timestamp: Date.now() });
      }
      return item;
    } catch (error) {
      console.error("Get by email error:", error);
      throw error;
    }
  }

  // Batch get emails (10-50ms for 100 emails)
  async batchGetEmails(emails) {
    const keys = emails.map(email => ({ email }));
    const params = {
      RequestItems: {
        [TABLE_NAME]: {
          Keys: keys,
          ConsistentRead: true
        }
      }
    };

    try {
      const result = await dynamodb.batchGet(params).promise();
      return result.Responses[TABLE_NAME] || [];
    } catch (error) {
      console.error("Batch get error:", error);
      throw error;
    }
  }

  // ========== WRITE OPERATIONS ==========

  // Create with duplicate check
  async create(item) {
    const params = {
      TableName: TABLE_NAME,
      Item: {
        ...item,
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      ConditionExpression: "attribute_not_exists(email)"
    };

    try {
      await dynamodb.put(params).promise();
      
      // Invalidate relevant caches
      this.cache.delete('total_count');
      if (item.companyname) {
        this.cache.delete(`count_company_${item.companyname}`);
      }
      
      return item;
    } catch (error) {
      if (error.code === "ConditionalCheckFailedException") {
        throw new Error("Email already exists");
      }
      throw error;
    }
  }

  // Batch write (1000+ items/second)
  async batchWrite(items) {
    const batchSize = 25;
    let processed = 0;
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const writeRequests = batch.map(item => ({
        PutRequest: {
          Item: {
            ...item,
            createdAt: item.createdAt || Date.now(),
            updatedAt: Date.now()
          }
        }
      }));

      const params = {
        RequestItems: {
          [TABLE_NAME]: writeRequests
        }
      };

      try {
        await dynamodb.batchWrite(params).promise();
        processed += batch.length;
        
        // Clear cache for affected companies
        batch.forEach(item => {
          if (item.companyname) {
            this.cache.delete(`count_company_${item.companyname}`);
          }
        });
        
      } catch (error) {
        console.error(`Batch write error at batch ${i/batchSize + 1}:`, error.message);
      }
    }

    return { processed };
  }

  // ========== UTILITIES ==========

  // Clear cache
  clearCache() {
    this.cache.clear();
    console.log("Cache cleared");
  }

  // Get cache stats
  getCacheStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.entries()).map(([key, value]) => ({
        key,
        timestamp: value.timestamp,
        age: Date.now() - value.timestamp
      }))
    };
  }



// Add these to your dynamodb-service.js:


// Scan with filters (fallback when no GSI)
async scanWithFilters(filters = {}, lastKey = null, limit = 100) {
  const params = {
    TableName: TABLE_NAME,
    Limit: Math.min(limit, 100),
    ExclusiveStartKey: lastKey
  };

  // Minimal filtering for performance
  if (filters.email) {
    params.FilterExpression = "email = :email";
    params.ExpressionAttributeValues = { ':email': filters.email };
  }

  try {
    const result = await dynamodb.scan(params).promise();
    return {
      items: result.Items || [],
      lastKey: result.LastEvaluatedKey,
      count: result.Count || 0,
      scannedCount: result.ScannedCount || 0
    };
  } catch (error) {
    console.error("Scan error:", error);
    throw error;
  }
}

// Batch delete
async batchDelete(emails) {
  const batchSize = 25;
  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);
    const deleteRequests = batch.map(email => ({
      DeleteRequest: { Key: { email } }
    }));

    const params = {
      RequestItems: { [TABLE_NAME]: deleteRequests }
    };

    try {
      await dynamodb.batchWrite(params).promise();
    } catch (error) {
      console.error(`Batch delete error:`, error.message);
    }
  }
  return { deleted: emails.length };
}

// Delete single
async delete(email) {
  const params = {
    TableName: TABLE_NAME,
    Key: { email }
  };
  await dynamodb.delete(params).promise();
  return { success: true };
}

// Update
async update(email, updates) {
  const updateExpressions = [];
  const expressionAttributeValues = {};
  const expressionAttributeNames = {};

  Object.keys(updates).forEach((key, index) => {
    if (key !== "email") {
      const valueKey = `:val${index}`;
      const nameKey = `#${key}`;
      updateExpressions.push(`${nameKey} = ${valueKey}`);
      expressionAttributeValues[valueKey] = updates[key];
      expressionAttributeNames[nameKey] = key;
    }
  });

  updateExpressions.push("#updatedAt = :updatedAt");
  expressionAttributeValues[":updatedAt"] = Date.now();
  expressionAttributeNames["#updatedAt"] = "updatedAt";

  const params = {
    TableName: TABLE_NAME,
    Key: { email },
    UpdateExpression: `SET ${updateExpressions.join(", ")}`,
    ExpressionAttributeValues: expressionAttributeValues,
    ExpressionAttributeNames: expressionAttributeNames,
    ReturnValues: "ALL_NEW"
  };

  const result = await dynamodb.update(params).promise();
  return result.Attributes;
}



// Add these methods inside your DynamoDBService class

// Fast approximate or cached exact total count
async getTotalCount(refresh = false) {
  const cacheKey = 'total_count';
  const cached = this.cache.get(cacheKey);

  if (!refresh && cached && Date.now() - cached.timestamp < 300000) { // 5 minutes
    return cached.value;
  }

  try {
    // Option A: Fastest - Use DescribeTable (approximate, updates every ~6 hours)
    const dynamodbRaw = new AWS.DynamoDB({ region: process.env.AWS_REGION || "ap-south-1" });
    const desc = await dynamodbRaw.describeTable({ TableName: TABLE_NAME }).promise();
    const approxCount = desc.Table.ItemCount || 0;

    // Option B: If you want exact (uncomment below, runs parallel scan once every 5-60 mins)
    // const exactCount = await this.getExactTotalCountParallel(16);
    // const total = exactCount > 0 ? exactCount : approxCount;

    const total = approxCount; // Using approximate for speed

    this.cache.set(cacheKey, { value: total, timestamp: Date.now() });
    console.log(`Total count cached: ${total} (approximate)`);
    return total;
  } catch (error) {
    console.error("getTotalCount error:", error);
    return 660550; // fallback hardcode if needed
  }
}

// Parallel scan for exact count (run rarely)
async getExactTotalCountParallel(segments = 16) {
  const scanSegment = async (segment) => {
    let count = 0;
    let lastKey = null;
    const docClient = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION || "ap-south-1" });

    do {
      const params = {
        TableName: TABLE_NAME,
        Select: 'COUNT',
        Segment: segment,
        TotalSegments: segments,
        ExclusiveStartKey: lastKey
      };
      const result = await docClient.scan(params).promise();
      count += result.Count || 0;
      lastKey = result.LastEvaluatedKey;
    } while (lastKey);

    return count;
  };

  const promises = [];
  for (let i = 0; i < segments; i++) {
    promises.push(scanSegment(i));
  }

  const counts = await Promise.all(promises);
  return counts.reduce((a, b) => a + b, 0);
}

// Paginated scan for unfiltered queries (efficient)
async scanPaginated(limit = 100, lastKey = null) {
  const params = {
    TableName: TABLE_NAME,
    Limit: limit,
    ExclusiveStartKey: lastKey || undefined
  };

  try {
    const result = await dynamodb.scan(params).promise();
    return {
      items: result.Items || [],
      lastKey: result.LastEvaluatedKey,
      scannedCount: result.ScannedCount
    };
  } catch (error) {
    console.error("scanPaginated error:", error);
    throw error;
  }
}

}

module.exports = new DynamoDBService();