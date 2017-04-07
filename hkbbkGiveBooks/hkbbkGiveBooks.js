
var async = require('async');
var AWS = require('aws-sdk');
var util = require('util');
var dateFormat = require('dateformat');
var sns = new AWS.SNS();
var dynamodb = new AWS.DynamoDB();

exports.handler = function(event, context) {
    var now = dateFormat(new Date(), "yyyy-mm-dd HH:MM:ss");
    var donor = null;
    async.waterfall([
        function Step1(step1Callback){
            console.log("***************************************");
            console.log("Step 1: Query marketId by donor.");
            
            if (event.donor.S === event.supplicant.S) {
                console.log("Step 1 Error: supplicant = donor .");
                step1Callback("supplicant_equal_donor");
            } else {
            
                console.log("Query market item with id: " + event.donor.S);
                var item = {
                    "TableName": "hkbbk_market",
                    "IndexName": "donor-marketStatus-index",
                    "ConsistentRead": false,
                    "ScanIndexForward": false,
                    "ProjectionExpression": "marketId",
                    "KeyConditionExpression": "donor = :donor AND marketStatus = :marketStatus",
                    "ExpressionAttributeValues": 
                    {
                        ":donor": {"S": event.donor.S },
                        ":marketStatus": {"S": "ONSHELF" }
                    },
                    "ReturnConsumedCapacity": "TOTAL"
                };
                var marketIds = [];
                dynamodb.query(item, function(err, data) {
                    if (err) {

                        console.log("Step 1 Error: " + err.stack);
                        step1Callback("DB_query_item_error");

                    }else{ 
                        data.Items.forEach(function(item) {
                            marketIds.push(item.marketId.S);
                        });
                        console.log("Step 1 Complete.");
                        step1Callback(null,marketIds);
                   }
                });
            }
        },
        function Step2(marketIds,step2Callback){
            console.log("***************************************");
            console.log("Step 2: Check and remove marketId if not in table.");
            
            for(var key = 0 ; key<event.demands.length; key++){
                var value = event.demands[key];
                console.log("Checking market Id: " + value.marketId.S);
                var same = true;
                for (var j = 0; j <marketIds.length; j++){
                    if(value.marketId.S === marketIds[j]){
                        same = false;
                        break;
                    } 
                }
                if (same === true){
                    var marketId = value.marketId.S;
                    event.demands.splice(key,1);
                    
                    console.log("Remove event.demands.marketId.S : " + marketId);
                    key--;

                }
            }
            console.log("Step 2 Complete.");
            step2Callback(null);
        },
        function Step3(step3Callback){
            console.log("***************************************");
            console.log("Step 3: Update market status.");
            
            async.eachSeries(event.demands,
                function updateMarket(demand, updateMarketCallback){
                    var updateMarketParams = {
                        "TableName": "hkbbk_market",
                        "Key": {
                            "isbn": {"S": demand.isbn.S },
                            "donor": {"S": event.donor.S}
                         },
                        "UpdateExpression": "set marketStatus = :marketStatus, requestCounter = :requestCounter, updatedAt = :updatedAt",
                        "ExpressionAttributeValues": {
                            ":marketStatus": {"S": "HOLD"},
                            ":requestCounter": {"N":"0"},
                            ":updatedAt": {"S": now}
                        },
                    "ReturnValues": "UPDATED_NEW"
                    };

                    dynamodb.updateItem(updateMarketParams, function(err, data) {
                        if (err) {
                            updateMarketCallback(err);
                        } else {
                            console.log('Successfully update market id: ' + demand.marketId.S);
                            updateMarketCallback();
                        }
                    });
                },
                function (err) {
                    if (err) { 
                        console.log("Step 3 Error: " + err);
                        step3Callback("DB_update_item_error");
                    } else {
                        console.log("Step 3 Complete");
                        step3Callback(null);
                    }
                }
            );
        },
        function Step4(step4Callback){
            console.log("***************************************");
            console.log("Step 4: Query demands table.");
            
            var demandToUpdate = [];
            var users = {};
            async.eachSeries(event.demands, 
                function queryDemand(demand, queryDemandCallback){
                    console.log("Query Demand Table with market ID: " + demand.marketId.S);
                    console.log("Query Demand Table with demand status: REQUEST");
                    
                    var queryDemandParams = {
                        "TableName": "hkbbk_demands",
                        "IndexName": "marketId-demandStatus-index",
                        "ConsistentRead": false,
                        "ProjectionExpression": "supplicant,credit,marketId,requestId,requestNumber",
                        "KeyConditionExpression": "marketId = :marketId AND demandStatus = :demandStatus",
                        "ExpressionAttributeValues": {
                            ":marketId": {"S": demand.marketId.S},
                            ":demandStatus":{"S": "REQUEST"}
                        },
                        "ReturnConsumedCapacity": "TOTAL"
                    };

                    dynamodb.query(queryDemandParams, function(err, data) {
                        if (err) { 
                            console.log(err, err.stack); // an error occurred
                            queryDemandCallback(err);
                        } else { 
                            
                            console.log("Count: " + data.Count);

                            for (i = 0; i < data.Count; i++) { 
                                console.log(" data: " + JSON.stringify(data.Items));
                                demandToUpdate.push( {partitionKey:data.Items[i].requestId.S.toString(), sortKey : data.Items[i].marketId.S.toString(), supplicant: data.Items[i].supplicant.S.toString() , demandStatus : event.supplicant.S === data.Items[i].supplicant.S ? "GIVE" : "GIVEN" } );
                                console.log("Market ID: " + data.Items[i].marketId.S.toString());
                                
                                var requestNumber = data.Items[i].requestNumber.S;

                                if( requestNumber in users ) {
                                    users[requestNumber].count += 1;
                                    console.log("Updated supplicant in user list by requestNumber: "+ requestNumber);
                                } else {
                                    console.log("Added supplicant in user list by requestNumber: "+ requestNumber);
                                    users[requestNumber] = {supplicant: data.Items[i].supplicant.S, credit:null, count:null};
                                    users[requestNumber].count = 1;
                                }

                                
                            } 
                            queryDemandCallback();
                        }
                    });
                }, 
                function (err) {
                    if (err) { 
                        console.log("Step 4 Error: " + err);
                        step4Callback("DB_query_item_error");
                    } else {
                        console.log("Step 4 Complete");
                        //console.log("demandToUpdate: "+ JSON.stringify(demandToUpdate));
                        console.log("user: "+ JSON.stringify(users));
                        step4Callback(null, demandToUpdate, users);
                    }
                }
            );
        },
        function Step5(demands, users, step5Callback){  
            console.log("***************************************");
            console.log("Step 5: Update Demand Table"); 
            
            async.eachSeries(demands,
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
                        console.log("Step 5 Error: " + err);
                    } else {
                        console.log("Step 5 Complete");
                        step5Callback(null, users);
                    }
                }
            );
        },
        function step6(users, step6Callback){
            console.log("***************************************");
            console.log("Step 6: Query donor profile");
            
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
                    console.log("Step 6 Error: " + err.stack); // an error occurred
                    step6Callback("DB_get_item_error");
                } else {
                    donor = data.Item;
                    console.log("Step 6 completed.");
                    step6Callback(null, users);
                }
            });
        },
        
        function step7(users, step7Callback){
            console.log("***************************************");
            console.log("Step 7: Save notice to table");
            
            var noticesToAdd = [];
            var data = {};
            for(var requestNumber in users ) {
                var value = users[requestNumber];
                console.log("Seting user notice by requestNumber: " + requestNumber);
                data = {donor: donor.id.S, fullname: donor.fullname.S, requestNumber: requestNumber };
                if (value.supplicant === event.supplicant.S){
                    noticesToAdd.push({userId:value.supplicant , createdAt:now,alert:"[編號:" + requestNumber + "] 您向" + data.fullname +"的" + value.count + "個書本請求已被接納。",type:"GIVE", data: data });
                } else {
                    noticesToAdd.push({userId:value.supplicant, createdAt:now,alert:"[編號:" + requestNumber + "] 您向" + data.fullname +"的" + value.count + "個書本請求沒有被接納。",type:"GIVEN", data: data });
                }   
            };

            async.eachSeries(noticesToAdd,
                function putNoticeToDB(user, putNoticeToDBCallback) {
                    
                    var putItemParams = {};

                    putItemParams = {
                        "TableName": "hkbbk_notices",
                        "Item": {
                            "userId": {
                                "S": user.userId
                            },
                            "alert": {
                                "S": user.alert
                            },
                            "type": {
                                "S": user.type
                            },
                            "createdAt": {
                                "S": user.createdAt
                            },
                            "data" : {
                                "M": {
                                  "fullname": {
                                    "S": user.data.fullname
                                  },
                                  "donor": {
                                    "S": user.data.donor
                                  },
                                  "requestNumber": {
                                    "S": user.data.requestNumber
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
                            console.log("Put user "+ user.userId +" Notice to DB Complete.");
                            putNoticeToDBCallback(null);
                        }
                    });
                },
                function(err){
                    if (err) { 
                        console.log("Step 7 Error: " + err);
                        step7Callback("DB_put_item_error");
                    } else {
                        console.log("Step 7 Complete.");
                        step7Callback(null, noticesToAdd);
                    }
                }
            );
            
        },
        function Step8(noticesToAdd, step8Callback) {
            console.log("***************************************");
            console.log("Step 8: Find donor Endpoint(s) and send notification to each device.");
            
            
            async.eachSeries(noticesToAdd,
                function queryEndpoint(user, queryEndpointCallback) {
                    console.log("Retrieving endpoint of user id: " + user.userId);
                    
                    var endpointQueryParams = {
                        "TableName": "hkbbk_endpoints",
                        "IndexName": "id-index",
                        "ConsistentRead": false,
                        "ProjectionExpression": "endpoint",
                        "KeyConditionExpression": "id = :id",
                        "ExpressionAttributeValues": {
                            ":id": {"S": user.userId}
                        },
                        "ReturnConsumedCapacity": "TOTAL"
                    };

                    dynamodb.query(endpointQueryParams, function(err, data) {
                        if (err) { 
                            console.log(err, err.stack); // an error occurred
                            queryEndpointCallback(null);
                        } else { 
                            async.eachSeries(data.Items,
                                function(endpoint, endpointCallback) {                                    
                                    var payload = {
                                        "APNS": {
                                            "aps": {
                                                "alert": user.alert,
                                                "badge": 1,
                                                "type": user.type,
                                                "sound":"1",
                                                "createdAt": user.createdAt,
                                                "data" : user.data,
                                                "isRead" :false
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
                                    console.log("Step 8: sns pulish start :");
                                    sns.publish(params, function(err, data) {
                                        if (err) {
                                            console.log(err, err.stack);
                                            endpointCallback(null);
                                        } // an error occurred
                                        else {
                                            console.log("Step 8: sns publish complete : " + data);
                                            endpointCallback(null);
                                        }           // successful response
                                        
                                    }); 
                                },
                                function(err){
                                    if (err) { 
                                        console.log("Step 8 Error: " + err);
                                        queryEndpointCallback(null);
                                    } else {
                                        console.log("Step 8: endpointCallback.");
                                        queryEndpointCallback(null);
                                    }
                                }
                            );
                            
                        }
                    });
                },
                function(err){
                    if (err) {
                        console.log("Step 8 Error: " + err);
                        step8Callback(null);
                    } else {
                        console.log("Step 8 Complete.");
                        step8Callback(null);
                    }
                }
            );
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
