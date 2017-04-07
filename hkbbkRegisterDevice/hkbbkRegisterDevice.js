var AWS = require('aws-sdk');
var async = require('async');
var dateFormat = require('dateformat');
var sns = new AWS.SNS();
var dynamodb = new AWS.DynamoDB();

//var platformApplicationArn = "arn:aws:sns:ap-northeast-1:310125058045:app/APNS_SANDBOX/hkbbk-dev" /* ap-northeast-1 development */
var platformApplicationArn = "arn:aws:sns:ap-northeast-1:310125058045:app/APNS/hkbbk"  /* us-east-1 production */
//var platformApplicationArn = "arn:aws:sns:us-east-1:310125058045:app/APNS_SANDBOX/devhkbbk" /* us-east-1 development */
//var platformApplicationArn = "arn:aws:sns:us-east-1:310125058045:app/APNS/hkbbk"  /* us-east-1 production */

exports.handler = function(event, context) {
    console.log(event);
    var now = dateFormat(new Date(), "yyyy-mm-dd h:MM:ss");
    var endpointArn = event.endpointArn;
    var identityId = event.identityId;
    var deviceToken = event.deviceToken;

    
    async.waterfall([
        function createPlatformEndpoint(createPlatformEndpointCallback) {
            var createPlatformEndpointParams = {
                PlatformApplicationArn: platformApplicationArn,
                Token: deviceToken
            };
            
            sns.createPlatformEndpoint(createPlatformEndpointParams, function(err, endpointResult) {
                if (err) { 
                    console.log("createEndpoint() createPlatformEndpoint: " + err, err.stack); /* an error occurred */
                    createPlatformEndpointCallback(err);
                } else {
                    createPlatformEndpointCallback(null, endpointResult);
                }
            });
        },
        function query(endpointResult, queryCallback){
            var queryParams = {
                "TableName": "hkbbk_endpoints",
                "ConsistentRead": true,
                "ProjectionExpression": "id, createdAt",
                "KeyConditionExpression": "endpoint = :endpoint",
                "ExpressionAttributeValues": {
                    ":endpoint": {"S": endpointResult.EndpointArn},
                },
                "ReturnConsumedCapacity": "TOTAL"
            };

            dynamodb.query(queryParams, function(err, queryResult) {
                if (err) { 
                    console.log(err, err.stack); // an error occurred
                    queryCallback(err);
                } else { 
                    console.log("Count: " + queryResult.Count);
                    endpointResult.Operation = queryResult.Count > 0 ? "UPDATE" : "CREATE";
                    queryCallback(null, endpointResult, queryResult);
                }
            });  
        },
        function putItem(endpointResult, queryResult, putItemCallback) {
            var createAt;
            switch(endpointResult.Operation) {
                case "UPDATE":
                    createdAt = queryResult.Items[0].createdAt.S;
                    break;
                case "CREATE":
                    createdAt = now;
                    break;
                default:
                    createdAt = now;
            }
            
            var putItemParams = {
                "TableName": "hkbbk_endpoints",
                "Item": {
                    "endpoint": {
                        "S": endpointResult.EndpointArn
                    },
                    "id": {
                        "S": identityId
                    },
                    "token": {
                        "S": deviceToken
                    },
                    "updatedAt": {
                        "S": now
                    },
                    "createdAt": {
                        "S": createdAt
                    }
                }
            }
            dynamodb.putItem(putItemParams, function(err, putItemResult) {
                if (err) {
                    putItemCallback(err);
                } else {
                    putItemCallback(null, endpointResult);
                }
            });
            
        }
        ],
        function (err, data) {
            if (err) { 
                console.log("Error: " + err);
                context.fail(err);
            } else {
                context.succeed(data);
            }
        }
    );
}