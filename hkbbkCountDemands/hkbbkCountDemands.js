console.log('Loading function');

var AWS = require('aws-sdk');
var dynamodb = new AWS.DynamoDB();
var async = require('async');
var dateFormat = require('dateformat');

exports.handler = function(event, context) {
    
    var demand = {
        isbn: null,
        marketId: null,
        demandStatus: null
    };
    //console.log('Received event:', JSON.stringify(event, null, 2));
//    event.Records.forEach(function(record){
//        console.log(record.eventID);
//        console.log(record.eventName);
//        console.log('DynamoDB Record: %j', record.dynamodb);
//    });
    async.eachSeries(event.Records,
        function checkEventName(record, checkEventNameCallback){
            async.waterfall([
                function step1(step1Callback){
                    console.log("***************************************");
                    console.log("Step 1: Check event name.");
                    console.log('record event: ', JSON.stringify(record, null, 2));
                    if(record.eventName === 'INSERT' && record.dynamodb.NewImage.demandStatus.S === 'REQUEST') {
                        console.log("Event name: "+ record.eventName);
                        ('marketId' in record.dynamodb.Keys) ? demand.marketId = record.dynamodb.Keys.marketId.S : demand.marketId = null;
                        ('isbn' in record.dynamodb.NewImage) ? demand.isbn = record.dynamodb.NewImage.isbn.S : demand.isbn = null;
                        ('demandStatus' in record.dynamodb.NewImage) ? demand.demandStatus = record.dynamodb.NewImage.demandStatus.S : demand.demandStatus = null; 
                        
                        console.log("Step 1 Complete.");
                    step1Callback(null);     
                        
                    } else if (record.eventName === 'REMOVE') {
                        console.log("Event name: "+ record.eventName);
                        ('marketId' in record.dynamodb.Keys) ? demand.marketId = record.dynamodb.Keys.marketId.S : demand.marketId = null;
                        ('isbn' in record.dynamodb.OldImage) ? demand.isbn = record.dynamodb.OldImage.isbn.S : demand.isbn = null;
                        ('demandStatus' in record.dynamodb.OldImage) ? demand.demandStatus = record.dynamodb.OldImage.demandStatus.S : demand.demandStatus = null;
                        
                        step1Callback("Don't need count.");
                    } else if(record.eventName === 'MODIFY' && record.dynamodb.NewImage.demandStatus.S === 'REQUEST') {
                        console.log("Event name: "+ record.eventName);
                        ('marketId' in record.dynamodb.Keys) ? demand.marketId = record.dynamodb.Keys.marketId.S : demand.marketId = null;
                        ('isbn' in record.dynamodb.NewImage) ? demand.isbn = record.dynamodb.NewImage.isbn.S : demand.isbn = null;
                        ('demandStatus' in record.dynamodb.NewImage) ? demand.demandStatus = record.dynamodb.NewImage.demandStatus.S : demand.demandStatus = null;
                        
                        console.log("Step 1 Complete.");
                    step1Callback(null);     
                    } else {
                        step1Callback("Don't need count.");
                    }

                    

                }, 
                function step2(step2Callback){
                    console.log("***************************************");
                    console.log("Step 2: Query demand.");

                    console.log("Query demand item by marketId: "+ demand.marketId);
                    console.log("Query demand item by demandStatus: REQUEST. ");

                    var count = 0;

                    var item = {
                        "TableName": "hkbbk_demands",
                        "IndexName": "marketId-demandStatus-index",
                        "ConsistentRead": false,
                        "ProjectionExpression": "isbn, marketId",
                        "KeyConditionExpression": "marketId = :marketId AND demandStatus = :demandStatus",
                        "ExpressionAttributeValues": 
                        {
                            ":marketId": {"S": demand.marketId },
                            ":demandStatus":{"S": "REQUEST"}
                        },
                        "ReturnConsumedCapacity": "TOTAL"
                    };
                    dynamodb.query(item, function(err, data) {
                        if (err) {
                            console.log("Step 2 Error: " + err.stack);
                            //console.log(err.stack); // an error occurred
                        } else {

                            count = data.Count;
                            console.log("Step 2 Complete.");
                            step2Callback(null, count);
                        }
                    });    
                },
                function step3(count,step3Callback){

                    console.log("***************************************");
                    console.log("Step 3: Update market table demands count.");

                    if( null !== demand.isbn && null !== demand.marketId ) {

                        console.log("Update market item by marketId: " + demand.marketId);
                        var now = dateFormat(new Date(), "yyyy-mm-dd HH:MM:ss");
                        var updateItem = {
                            "TableName": "hkbbk_market",
                            "Key": {
                                "isbn": {
                                    "S": demand.isbn
                                },
                                "marketId": {
                                    "S": demand.marketId
                                }
                            },
                            "UpdateExpression": "set requestCounter = :demandCounter, updatedAt = :updatedAt",
                            "ExpressionAttributeValues":{
                                ":demandCounter": { "N": count.toString() },
                                ":updatedAt": {"S": now}
                            },
                            "ReturnValues": ("UPDATED_NEW")
                        };
                        console.log('Received event:', JSON.stringify(updateItem, null, 2));
                        dynamodb.updateItem(updateItem,function(err, data) {
                            if (err) {
                                console.log("Step 3 Error: " + err.stack);
                            }else{
                                console.log("Step 3 Complete.");
                                step3Callback(null, count);
                            }
                        });
                    }
                }
                ],
                function(err, results){
                    if (err) { 
                        console.log("Error: " + err);
                    } else {
                        checkEventNameCallback(null);
                    }
                }
            );
        },
        function (err) {
            if (err) { 
                console.log("Error: " + err);
                context.fail(err);
            } else {
                context.succeed("SUCCEED");
            }
        }
    );
};
