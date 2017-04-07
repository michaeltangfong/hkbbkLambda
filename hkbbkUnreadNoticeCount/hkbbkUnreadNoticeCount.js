var AWS = require('aws-sdk');
var dynamodb = new AWS.DynamoDB();

exports.handler = function(event, context) {

    userId = event.identityId;
    
    console.log(event);
    var queryNoticeParams = {
        "TableName": "hkbbk_notices",
        "ConsistentRead": true,
        "KeyConditionExpression": "userId = :userId",
        "FilterExpression": "isRead = :isRead",
        "ExpressionAttributeValues": {
            ":userId": {"S": userId},
            ":isRead" : {"BOOL" : false},
        },
        
        "ReturnConsumedCapacity": "TOTAL",
        "Select" : "COUNT"
    };

    dynamodb.query(queryNoticeParams, function(err, data) {
        if (err) { 
            console.log(err, err.stack); // an error occurred
            context.fail(err);
        } else { 

            console.log(data);
            context.succeed(data.Count);
        }
    });
};