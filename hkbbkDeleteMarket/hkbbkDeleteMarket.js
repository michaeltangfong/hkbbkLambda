
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
            
            if (marketStatus !== "ONSHELF" && marketStatus !== "HOLD") {
               console.log("market status is not on shelf or hold, not need to check donor credit.");
               console.log("Step 2 skip.");
               step2Callback(null, market, null);
            } else {
            
                console.log("check user item by donor id : " + event.donor.S);

                var getItemParams = {
                    "TableName": "hkbbk_users",
                    "Key": {
                        "id": {
                            "S": event.donor.S
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
                        if (parseInt(data.Item.credit.N) >= 10 ){
                            console.log("User detail received, step 2 completed.");
                            donor = data.Item;
                            step2Callback(null, market);
                        } else {
                            console.log("Donor does not have enough credit.");
                            errorType = "credit_not_enough_delete_market";
                            step2Callback(errorType);
                        }
                    }
                });
            }
        },
        function Step3(market, step3Callback){
            console.log("***************************************");
            console.log("Step 3: Delete market.");
            
            var deleteMarketParams = {
                "TableName": "hkbbk_market",
                "Key": {
                    "isbn": {"S": market.isbn.S },
                    "donor": {"S": market.donor.S}
                 },
                "ConditionExpression": "attribute_not_exists(Replies)",
                "ReturnValues": "ALL_OLD"
                };

            dynamodb.deleteItem(deleteMarketParams, function(err, data) {
                if (err) { 
                    console.log("Step 3 Error: " + err);
                    errorType = "DB_delete_item_error";
                    step3Callback(errorType);
                } else {
                    console.log("Step 3 Complete");
                    step3Callback(null, market);
                }
                });
                
        },
        function Step4(market, step4Callback){
            console.log("***************************************");
            console.log("Step 4: Add market in archive.");
//            console.log("market : "+ JSON.stringify(market));
            market.marketStatus = {"S":"INACTIVE"};
            market.deletedAt = {"S":now };
//            console.log("market archive : "+ JSON.stringify(market));
            var putItemParams = {
                "TableName": "hkbbk_market_archive",
                "Item": market
            };
            
            dynamodb.putItem(putItemParams, function(err, putItemResult) {
                if (err) {
                    console.log(err);
                    errorType = "DB_put_item_error";
                    step4Callback(errorType);
                } else {
                    console.log("Inserted record to market in archive. id: " + market.marketId.S);
                    console.log("Step 4 Complete");
                    step4Callback(null, market);
                }
            });

        },
        function Step5(market, step5Callback){
            console.log("***************************************");
            console.log("Step 5: Update user credit.");
            
            if (marketStatus !== "ONSHELF" && marketStatus !== "HOLD" ) {
                console.log("market status is not on shelf, not need to update donor credit.");
                console.log("Step 5 skip.");
                step5Callback(null, market);
            } else {
                if (marketStatus === "ONSHELF"){
                    var updateSupplicantParams = {
                        "TableName": "hkbbk_users",
                        "Key": {
                            "id": {
                                "S": donor.id.S
                            }
                        },
                        "UpdateExpression": "set credit = credit - :credit",
                        "ExpressionAttributeValues": {
                            ":credit": {"N": "10"}
                        },
                        "ReturnValues": "ALL_NEW"
                    };
                } else if (marketStatus === "HOLD"){
                    var updateSupplicantParams = {
                        "TableName": "hkbbk_users",
                        "Key": {
                            "id": {
                                "S": donor.id.S
                            }
                        },
                        "UpdateExpression": "set credit = credit - :credit, badrecord = badrecord + :badrecord",
                        "ExpressionAttributeValues": {
                            ":credit": {"N": "10"},
                            ":badrecord": {"N":"1"}
                        },
                        "ReturnValues": "ALL_NEW"
                    };
                } else {
                    step5Callback(null, market);
                }
                

                dynamodb.updateItem(updateSupplicantParams, function(err, data) {
                    if (err) {
                        console.log("Step 5 Error:" + err.stack); // an error occurred
                        errorType = "DB_update_item_error";
                        step5Callback(errorType);
                    } else {    
                        console.log("Step 5 Complete.");
                        step5Callback(null, market);
                    }
                });
            }
        },
        function Step6(market, step6Callback){
            console.log("***************************************");
            console.log("Step 6: Query demand table.");
            
            if (marketStatus !== "ONSHELF" && marketStatus !== "HOLD") {
                console.log("market status is not on shelf, not need to query demand table.");
                console.log("Step 6 skip.");
                step6Callback(null);
            } else {
                console.log("Query Demand Table with market ID: " + market.marketId.S);
                if (marketStatus === "ONSHELF") { 
                    console.log("Query Demand Table with demand status: REQUEST");
                    var queryDemandParams = {
                        "TableName": "hkbbk_demands",
                        "IndexName": "marketId-demandStatus-index",
                        "ConsistentRead": false,
                        "ProjectionExpression": "supplicant,credit,demandId,marketId,requestId,requestNumber",
                        "KeyConditionExpression": "marketId = :marketId AND demandStatus = :demandStatus",
                        "ExpressionAttributeValues": {
                            ":marketId": {"S": market.marketId.S},
                            ":demandStatus":{"S": "REQUEST"}
                        },
                        "ReturnConsumedCapacity": "TOTAL"
                    };
                } else if (marketStatus === "HOLD"){
                    console.log("Query Demand Table with demand status: GIVE");
                    var queryDemandParams = {
                        "TableName": "hkbbk_demands",
                        "IndexName": "marketId-demandStatus-index",
                        "ConsistentRead": false,
                        "ProjectionExpression": "supplicant,credit,demandId,marketId,requestId,requestNumber",
                        "KeyConditionExpression": "marketId = :marketId AND demandStatus = :demandStatus",
                        "ExpressionAttributeValues": {
                            ":marketId": {"S": market.marketId.S},
                            ":demandStatus":{"S": "GIVE"}
                        },
                        "ReturnConsumedCapacity": "TOTAL"
                    };
                } else {
                    step6Callback(null);
                }
                dynamodb.query(queryDemandParams, function(err, data) {
                    if (err) { 
                        console.log(err, err.stack); // an error occurred
                        errorType = "DB_query_item_error";
                        step6Callback(errorType);
                    } else { 
                        
                        console.log("Count: " + data.Count);
                        for (i = 0; i < data.Count; i++) { 
                            demandToUpdate.push( {partitionKey:data.Items[i].requestId.S.toString(), sortKey : data.Items[i].marketId.S.toString(), demandStatus : "OFFSHELF", demandId: data.Items[i].demandId.S.toString(), supplicant: data.Items[i].supplicant.S.toString(), requestNumber: data.Items[i].requestNumber.S.toString()  } );
                            console.log("Demand ID: " + data.Items[i].demandId.S.toString());
                            console.log("Market ID: " + data.Items[i].marketId.S.toString());
                        }
                        step6Callback(null);
                    }
                });
            }
        },
        function Step7(step7Callback){
            console.log("***************************************");
            console.log("Step 7: Update demand table.");
            
            if (marketStatus !== "ONSHELF" && marketStatus !== "HOLD") {
                console.log("market status is not on shelf, not need to update demand table.");
                console.log("Step 7 skip.");
                step7Callback(null);
            } else {    
                async.eachSeries(demandToUpdate,
                    function updateDemand(demand, updateDemandCallback){
                        console.log("Partition Key: " + demand.partitionKey);
                        console.log("Sort Key: " + demand.sortKey);
                        console.log("Demand Status: " + demand.demandStatus);
                        var updateDemandParams = {
                            "TableName": "hkbbk_demands",
                            "Key": {
                                "requestId": {"S": demand.partitionKey},
                                "marketId" : {"S": demand.sortKey}
                             },
                            "UpdateExpression": "set demandStatus = :demandStatus, updatedAt = :updatedAt",
                            "ExpressionAttributeValues": {
                                ":demandStatus": {"S": demand.demandStatus},
                                ":updatedAt": {"S": now}
                            },
                        "ReturnValues": "ALL_NEW"
                        };

                        dynamodb.updateItem(updateDemandParams, function(err, data) {
                            if (err) {
                                updateDemandCallback(err);
                            } else {
                                console.log('Successfully update ' + data);
                                updateDemandCallback();
                            }
                        });
                    }, 
                    function (err) {
                        if (err) { 
                            console.log("Step 7 Error: " + err);
                            errorType = "DB_update_item_error";
                            step7Callback(errorType);
                        } else {
                            console.log("Step 7 Complete");
                            step7Callback(null);
                        }
                    }
                );
            }
        },
        function Step8(step8Callback){
            console.log("***************************************");
            console.log("Step 8: Add notice to table.");
            
            if (marketStatus !== "ONSHELF" && marketStatus !== "HOLD") {
                console.log("market status is not on shelf, not need to add notice to table.");
                console.log("Step 8 skip.");
                step8Callback(null);
            } else { 
                async.eachSeries(demandToUpdate,
                    function putNoticeToDB(demand, putNoticeToDBCallback) {
                        var putItemParams = {
                            "TableName": "hkbbk_notices",
                            "Item": {
                                "userId": {
                                    "S": demand.supplicant
                                },
                                "alert": {
                                    "S": "[編號:" + demand.requestNumber + "] 您向" + donor.fullname.S + "的1個書本請求已下架"
                                },
                                "type": {
                                    "S": "OFFSHELF"
                                },
                                "createdAt": {
                                    "S": now
                                },
                                "data" : {
                                    "M": {
                                      "fullname": {
                                        "S": donor.fullname.S
                                      },
                                      "donor": {
                                        "S": donor.id.S
                                      }
                                    }
                                },
                                "isRead" : {
                                    "BOOL" : false
                                }
                            }
                        };
                        dynamodb.putItem(putItemParams, function(err, data) {
                            if (err) {
                                console.log(err, err.stack);
                                putNoticeToDBCallback(err);
                            } else {
                                console.log("Step 8: put Notice to DB Complete.");
                                putNoticeToDBCallback(null);
                            }
                        });
                    },
                    function(err){
                        if (err) { 
                            console.log("Step 8 Error: " + err);
                            errorType = "DB_put_item_error";
                            step8Callback(errorType);
                        } else {
                            console.log("Step 8 Complete.");
                            step8Callback(null);
                        }
                    }
                );
            }
        },
        function Step9(step9Callback){
            console.log("***************************************");
            console.log("Step 9: Find supplicant Endpoint(s) and send notification to each device.");
            
            if (marketStatus !== "ONSHELF" && marketStatus !== "HOLD") {
                console.log("market status is not on shelf, not need to send SNS.");
                console.log("Step 9 skip.");
                step9Callback(null);
            } else {
                async.eachSeries(demandToUpdate,
                    function queryEndpoint(demand, queryEndpointCallback) {
                        console.log("Retrieving endpoint of user id: " + demand.supplicant);

                        var endpointQueryParams = {
                            "TableName": "hkbbk_endpoints",
                            "IndexName": "id-index",
                            "ConsistentRead": false,
                            "ProjectionExpression": "endpoint",
                            "KeyConditionExpression": "id = :supplicant",
                            "ExpressionAttributeValues": {
                                ":supplicant": {"S": demand.supplicant}
                            },
                            "ReturnConsumedCapacity": "TOTAL"
                        };

                        dynamodb.query(endpointQueryParams, function(err, data) {
                            if (err) { 
                                console.log(err, err.stack); // an error occurred
                                queryEndpointCallback(err);
                            } else { 
                                async.eachSeries(data.Items,
                                    function(endpoint, endpointCallback) {                                    
                                        var payload = {
                                            "APNS": {
                                                "aps": {
                                                    "alert": "[編號:" + demand.requestNumber + "] 您向" + donor.fullname.S + "的1個書本請求已下架",
                                                    "badge": 1,
                                                    "type": "OFFSHELF",
                                                    "createdAt": now,
                                                    "sound":"1",
                                                    "data" : {
                                                        "donor" : donor.id.S,
                                                        "fullname" : donor.fullname.S
                                                    },
                                                    "isRead" : false
                                                }
                                            }
                                        };
                                        // first have to stringify the inner APNS object...
                                        payload.APNS = JSON.stringify(payload.APNS);
                                        // then have to stringify the entire message payload
                                        payload = JSON.stringify(payload);

                                        var params = {
                                            Message: payload,
                                            MessageStructure: 'json',
                                            Subject: 'HKBBK',
                                            TargetArn: endpoint.endpoint.S
                                        };
                                        console.log("Step 9: sns pulish start :");
                                        sns.publish(params, function(err, data) {
                                            if (err){ 
                                                console.log(err, err.stack); // an error occurred
                                                endpointCallback(null);
                                            } else {
                                                console.log("Step 9: sns publish complete : " + data);
                                                endpointCallback(null);
                                            }           // successful response

                                        }); 
                                    },
                                    function(err){
                                        if (err) { 
                                            console.log("Step 9 Error: " + err);
                                            errorType = "DB_query_item_error";
                                            queryEndpointCallback(errorType);
                                        } else {
                                            console.log("Step 9: endpointCallback.");
                                            queryEndpointCallback(null);
                                        }
                                    }
                                );

                            }
                        });
                    },
                    function(err){
                        if (err) {
                            console.log("Step 9 Error: " + err);
                            step9Callback(null);
                        } else {
                            console.log("Step 9 Complete.");
                            step9Callback(null);
                        }
                    }
                );
            }
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


