
var async = require('async');
var AWS = require('aws-sdk');
var dateFormat = require('dateformat');
var sns = new AWS.SNS();
var dynamodb = new AWS.DynamoDB();


exports.handler = function(event, context) {
    var now = dateFormat(new Date(), "yyyy-mm-dd HH:MM:ss");
    var errorType= null;
    var marketStatus = null;
    var demandToUpdate = [];
    var donor = null;
    var donorFullname = null;
    async.waterfall([
        function Step1(step1Callback){
            console.log("***************************************");
            console.log("Step 1: Check market status.");
            
            console.log("check market item by donor id : " + event.donor.S);
            
            var getItemParams = {
                "TableName": "hkbbk_market",
                "Key": {
                    "isbn": {
                        "S": event.isbn.S
                    },
                    "donor": {
                        "S": event.donor.S
                    }
                },
                "ConsistentRead": false,
                "ReturnConsumedCapacity": "TOTAL"
            };
            
            dynamodb.getItem(getItemParams, function(err, data) {
                if (err) { 
                    console.log("Step 1 Error: " + err.stack); // an error occurred
                    errorType = "DB_get_item_error";
                    step1Callback(errorType);
                } else {
                    console.log("data: ", JSON.stringify(data));
                    
                    //check item, if no result ,return error
                    if (data.Item !== undefined) {
                        
                        marketStatus = data.Item.marketStatus.S;
                        donor = data.Item.donor;
                        donorFullname = data.Item.donorFullname;
                        console.log("Step 1 completed.");
                        step1Callback(null, data.Item);
                    }else{
                        console.log("Step 1 error.");
                        errorType = "DB_get_item_error";
                        step1Callback(errorType);
                    }
                }
            });
            
        },
        function Step2(market, step2Callback){
            console.log("***************************************");
            console.log("Step 2: Check donor credit.");
            


            console.log("check user item by donor id : " + donor.S);

            var getItemParams = {
                "TableName": "hkbbk_users",
                "Key": {
                    "id": {
                        "S": donor.S
                    } 
                },
                "ConsistentRead": true,
                "ProjectionExpression": "id, fullname, quickBloxId, credit",
                "ReturnConsumedCapacity": "TOTAL"
            };

            dynamodb.getItem(getItemParams, function(err, data) {
                if (err) { 
                    console.log("Step 2 Error: " + err.stack); // an error occurred
                    errorType = "DB_get_item_error";
                    step2Callback(errorType);
                } else {
                    
                    if (marketStatus === "OFFSHELF") {
                       console.log("market status is OFFSHELF.");
                       console.log("Step 2 completed.");
                       step2Callback(null, market, data.Item);
                       
                    } else {
                        console.log("market status is not OFFSHELF.");
                        console.log("Step 2 Error.");
                        errorType = "market_status_error";
                        step2Callback(errorType);

                    }
                }
            });
            
        },
        function Step3(market, donor, step3Callback){
            console.log("***************************************");
            console.log("Step 3: Update market table.");
            
            var newMarketStatus = "ONSHELF";
            var updateMarketParams = {
                "TableName": "hkbbk_market",
                "Key": {
                    "isbn": {"S": market.isbn.S },
                    "donor": {"S": market.donor.S}
                 },
                "UpdateExpression": "set marketStatus = :marketStatus, requestCounter = :requestCounter, updatedAt = :updatedAt",
                "ExpressionAttributeValues": {
                    ":marketStatus": {"S": newMarketStatus},
                    ":requestCounter": {"N":"0"},
                    ":updatedAt": {"S": now}
                },
            "ReturnValues": "UPDATED_NEW"
                };

            dynamodb.updateItem(updateMarketParams, function(err, data) {
                if (err) { 
                    console.log("Step 3 Error: " + err);
                    errorType = "DB_update_item_error";
                    step3Callback(errorType);
                } else {
                    console.log("Step 3 Complete");
                    step3Callback(null, market, donor);
                }
                });
                
        },
        function Step4(market, donor, step4Callback){
            console.log("***************************************");
            console.log("Step 4: Update user credit.");
            
            if (marketStatus === "OFFSHELF") {
                console.log("market old status is off shelf,add credit.");
                var updateSupplicantParams = {
                    "TableName": "hkbbk_users",
                    "Key": {
                        "id": {
                            "S": donor.id.S
                        }
                    },
                    "UpdateExpression": "set credit = credit + :credit",
                    "ExpressionAttributeValues": {
                        ":credit": {"N": "10"}
                    },
                    "ReturnValues": "ALL_NEW"
                };
            } else {
                console.log("market old status is not off shelf.");
                console.log("Step 4 Error.");
                errorType = "market_status_error";
                step4Callback(errorType);
            }
            dynamodb.updateItem(updateSupplicantParams, function(err, data) {
                if (err) {
                    console.log("Step 4 Error:" + err.stack); // an error occurred
                    errorType = "DB_update_item_error";
                    step4Callback(errorType);
                } else {    
                    console.log("Step 4 Complete.");
                    step4Callback(null);
                }
            });
            
        }
        
        
        ],
        function(err, results){
            if (err) { 
                console.log("Error: " + err);
                context.fail(err);
            } else {
                context.succeed("SUCCEED");
            }
        }
    );

};


