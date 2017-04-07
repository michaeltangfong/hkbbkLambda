var AWS = require('aws-sdk');
var dynamodb = new AWS.DynamoDB();

exports.handler = function(event, context) {
    
    console.log("supplicant : " + event.supplicant);
    console.log("donor : " + event.donor);
    
    var item = {
    "TableName": "hkbbk_demands",
    "IndexName": "supplicant-demandStatus-index",
    "ConsistentRead": false,
    "ScanIndexForward": false,
    "ProjectionExpression": "supplicant",
    "KeyConditionExpression": "supplicant = :supplicant AND demandStatus = :demandStatus",
    "FilterExpression": "#donor = :donor",
    "ExpressionAttributeNames": {
        "#donor": "donor"
    },
    "ExpressionAttributeValues": 
    {
        ":supplicant": {"S": event.supplicant },
        ":demandStatus": {"S": "REQUEST" },
        ":donor":{"S": event.donor}
        
    },
    "ReturnConsumedCapacity": "TOTAL"
    };
    
    dynamodb.query(item, function(err, data) {
        if (err) console.log(err, err.stack); // an error occurred
        else{
            console.log(data);
            context.succeed(data.Count);
        }
    });
    
};