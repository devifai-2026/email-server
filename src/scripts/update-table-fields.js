const AWS = require('aws-sdk');


AWS.config.update({
  region: 'ap-south-1',  // Mumbai region (change if different)
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const dynamodb = new AWS.DynamoDB.DocumentClient();

async function addPaginationKey() {
  let lastKey = null;
  let updatedCount = 0;
  
  do {
    // Scan all items
    const scanParams = {
      TableName: 'EmailAccounts',
      Limit: 100,
      ExclusiveStartKey: lastKey
    };
    
    const result = await dynamodb.scan(scanParams).promise();
    
    // Update each item
    for (const item of result.Items) {
      if (!item.paginationKey) {
        const updateParams = {
          TableName: 'EmailAccounts',
          Key: { email: item.email },
          UpdateExpression: 'SET paginationKey = :pk',
          ExpressionAttributeValues: { ':pk': 'ALL' }
        };
        await dynamodb.update(updateParams).promise();
        updatedCount++;
      }
    }
    
    lastKey = result.LastEvaluatedKey;
    console.log(`Updated ${updatedCount} items so far...`);
    
  } while (lastKey);
  
  console.log(`Total updated: ${updatedCount} items`);
}

addPaginationKey();