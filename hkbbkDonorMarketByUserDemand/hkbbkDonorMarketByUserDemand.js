console.log('Loading function');

var async = require('async');
var AWS = require('aws-sdk');
var dateFormat = require('dateformat');
var sns = new AWS.SNS();
var dynamodb = new AWS.DynamoDB();
var credit = null;

exports.handler = function(event, context) {
    var now = dateFormat(new Date(), "yyyy-mm-dd HH:MM:ss");
    var markets = {};
    var lastEvaluatedKey = null;
    ('lastEvaluatedKey' in event) ? lastEvaluatedKey = event.lastEvaluatedKey : lastEvaluatedKey = null;
    async.waterfall([
        function step1(step1Callback){
            console.log("***************************************");
            console.log("Step 1: Query market by donor.");
            
            console.log("Query market item with id: " + event.donor.S);
            console.log("Query market item with status: ONSHELF .");
            var limit = 12;
            var item = {
                "TableName": "hkbbk_market",
                "IndexName": "donor-marketStatus-index",
                "ConsistentRead": false,
                "ScanIndexForward": true,
                "ProjectionExpression": "marketId,title,cover,isbn,credit",
                "KeyConditionExpression": "marketStatus = :marketStatus AND donor = :donor",
                "ExpressionAttributeValues": 
                {
                    ":donor": {"S": event.donor.S },
                    ":marketStatus": {"S": "ONSHELF" }
                },
                "Limit":limit,
                "ExclusiveStartKey":lastEvaluatedKey,
                "ReturnConsumedCapacity": "TOTAL"
            };
            dynamodb.query(item, function(err, data) {
                if (err) {
                    console.log("Step1 error: " + err.stack); // an error occurred
                    step1Callback(err);
                } else {
                    console.log("Data : "+ JSON.stringify(data));
                    data.Items.forEach(function(item) {
                        console.log("MarketId: "+ item.marketId.S );
                        markets[item.marketId.S] = {title: item.title.S, cover: item.cover.S, isbn: item.isbn.S, demandStatus: "",credit: item.credit.N};
                    });

                    if (typeof data.LastEvaluatedKey !== "undefined") {
                        console.log("LastEvaluatedKey : "+ JSON.stringify(data.LastEvaluatedKey));
                        lastEvaluatedKey = data.LastEvaluatedKey;
                    } else {
                        lastEvaluatedKey = null;
                    }
                    console.log("Step 1 Complete.");
                    step1Callback(null);
                }
            });
        },
        function step2(step2Callback){
            console.log("***************************************");
            console.log("Step 2: Query demand by supplicant.");
            
            console.log("Query demand item with id: " + event.supplicant.S);
            console.log("Query demand item with status: REQUEST .");
            
            var item = {
                "TableName": "hkbbk_demands",
                "IndexName": "supplicant-demandStatus-index",
                "ConsistentRead": false,
                "ScanIndexForward": false,
                "ProjectionExpression": "marketId,demandStatus",
                "KeyConditionExpression": "supplicant = :supplicant AND demandStatus = :demandStatus",
                "FilterExpression": "#donor = :donor",
                "ExpressionAttributeNames": {
                    "#donor": "donor"
                },
                "ExpressionAttributeValues": 
                {
                    ":supplicant": {"S": event.supplicant.S },
                    ":demandStatus":{"S":"REQUEST"},
                    ":donor":{"S":event.donor.S}

                },
                "ReturnConsumedCapacity": "TOTAL"
            };
            dynamodb.query(item, function(err, data) {
                
                if (err) {
                    console.log("Step2 error: " + err.stack); // an error occurred
                    step2Callback(err);
                } else {
                    
                    data.Items.forEach(function(item) {
                    //console.log(item);
                        if (item.marketId.S in markets){
                            
                            markets[item.marketId.S].demandStatus = item.demandStatus.S;
                            console.log("Market item status is REQUSET : " + item.marketId.S);
                        }
                    });
                    
                    console.log("Step 2 Complete.");
                    step2Callback(null);
                }
            });
        }
        ],
        function(err, results){
            if (err) { 
                console.log("Error: " + err);
                context.fail(err);
            } else {
                var result = {markets:markets,lastEvaluatedKey:lastEvaluatedKey};
                
                context.succeed(result);
            }
        }
    );
};