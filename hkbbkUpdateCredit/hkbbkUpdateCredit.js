var AWS = require('aws-sdk');
var dateFormat = require('dateformat');
var dynamodb = new AWS.DynamoDB();
var sns = new AWS.SNS();
var async =  require('async');
var message = "您的心心數量已更新";
var type = "CREDIT";

exports.handler = function(event, context) {
    
    var eventRecord = null;
    var id = null;
    var oldCredit = null;
    var newCredit = null;
    event.Records.forEach(function(record) {
        eventRecord = record.eventName;
        console.log(record);
        if(eventRecord === 'MODIFY') {
            ('credit' in record.dynamodb.OldImage) ? oldCredit = record.dynamodb.OldImage.credit.N : oldCredit = null;
            ('credit' in record.dynamodb.NewImage) ? newCredit = record.dynamodb.NewImage.credit.N : newCredit = null;
            ('id' in record.dynamodb.Keys) ? id = record.dynamodb.Keys.id.S : id = null;
            if(newCredit !== oldCredit) {
                updateCredit(event, context, id);
            } else {
                context.done(null, event);
            }
        } else {
            context.done(null, event);
        }
    });
};

function updateCredit(event, context, id){
    
    var date = new Date();

    var now = dateFormat(date, "yyyy-mm-dd HH:MM:ss");
    
    async.waterfall([
        function queryEndpoints(queryEndpointsCallback){
 
            var item = {
                "TableName": "hkbbk_endpoints",
                "IndexName": "id-index",
                "ConsistentRead": false,
                "ProjectionExpression": "endpoint",
                "KeyConditionExpression": "id = :id",
                "ExpressionAttributeValues": 
                {
                    ":id": {"S": id }
                },
                "ReturnConsumedCapacity": "TOTAL"
            };
            dynamodb.query(item, function(err, data) {
                if (err) {
                    console.log(err, err.stack); // an error occurred
                    queryEndpointsCallback(err);
                } else {
                    var endpoints = [];
                    data.Items.forEach(function(item) {
                        endpoints.push(item.endpoint.S);
                    });
                    queryEndpointsCallback(null, endpoints);
                }
            });    

        },
//        function putItem(endpoints, putItemCallback) {
//            var putItemParams = {
//                "TableName": "hkbbk_notices",
//                "Item": {
//                    "userId": {
//                        "S": id
//                    },
//                    "alert": {
//                        "S": message
//                    },
//                    "type": {
//                        "S": type
//                    },
//                    "createdAt": {
//                        "S": now
//                    }
//                }
//            };
//            dynamodb.putItem(putItemParams, function(err, putItemResult) {
//                if (err) {
//                    putItemCallback(err);
//                } else {
//                    putItemCallback(null, endpoints);
//                }
//            });
//            
//        },
        function sendSNSs(endpoints, sendSNSsCallback){
            //APNS_SANDBOX need fixed
            var payload = {
                "APNS": {
                    "aps": {
                        "type": type,
                        "createdAt": now
                    }
                }
            };
            // first have to stringify the inner APNS_SANDBOX object...
            payload.APNS = JSON.stringify(payload.APNS);
            // then have to stringify the entire message payload
            payload = JSON.stringify(payload);
            
            async.eachSeries(endpoints,
                function sendSNS(endpoint, sendSNSCallback){

                    sns.publish({
                        Message: payload,
                        MessageStructure: "json",
                        TargetArn: endpoint
                    },
                    function(err, data) {
                        if (err) {
                            sendSNSCallback();
                        } else {
                            console.log('Successfully');
                            sendSNSCallback();
                        }
                    });
                },
                function (err) {
                    if (err) { 
                        console.log("sendSNSs Error: " + err);
                    } else {
                        console.log("sendSNSs Complete");
                        sendSNSsCallback(null);
                        context.done(null, event);
                    }
                }
            );
        }
        ],
        function (err, data) {
            if (err) { 
                console.log("Error: " + err);
                context.fail(err);
            } else {
                context.succeed("succeed" + data);
            }
        }
    );
}

