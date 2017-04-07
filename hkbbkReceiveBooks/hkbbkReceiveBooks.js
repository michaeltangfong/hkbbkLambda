
var async = require('async');
var AWS = require('aws-sdk');
var uuid = require('node-uuid');
var dateFormat = require('dateformat');
var sns = new AWS.SNS();
var dynamodb = new AWS.DynamoDB();


exports.handler = function(event, context) {
    var now = dateFormat(new Date(), "yyyy-mm-dd HH:MM:ss");
    var supplicant = null;
    var donor = null;
    var requestNumber = null;
    var returnCredit = 0;
    async.waterfall([
        function step1(step1Callback){
            console.log("***************************************");
            console.log("Step 1: Get supplicant data.");
            requestNumber = event.requestNumber.S ? event.requestNumber.S : null;
            var getItemParams = {
                "TableName": "hkbbk_users",
                "Key": {
                    "id" : event.supplicant
                },
                "ConsistentRead": false,
                "ProjectionExpression": "id,fullname,quickBloxId,dropMtrStation,dropRegion",
                "ReturnConsumedCapacity": "TOTAL"
                };

            dynamodb.getItem(getItemParams, function(err, data) {
                if (err) { 
                    console.log("Step 1 Error: " + err.stack); // an error occurred
                    step1Callback("DB_get_item_error");
                } else { 
                    if (data.Item !== undefined) {
                        supplicant = data.Item;
                        step1Callback(null);
                    }else{
                        console.log("Step 1 error.");
                        step1Callback("DB_get_item_error");
                    }

                }
            });
        },
        function step2(step2Callback){
            console.log("***************************************");
            console.log("Step 2: Query marketId by donor.");
            
            if (event.donor.S === event.supplicant.S) {
                console.log("Step 2 Error: supplicant = donor .");
                step2Callback("supplicant_equal_donor");
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
                        ":marketStatus": {"S": "HOLD" }
                    },
                    "ReturnConsumedCapacity": "TOTAL"
                };
                var marketIds = [];
                dynamodb.query(item, function(err, data) {
                    if (err) {

                        console.log("Step 2 Error: " + err.stack);
                        step2Callback("DB_query_item_error");

                    }else{ 
                        data.Items.forEach(function(item) {
                            marketIds.push(item.marketId.S);
                        });
                        console.log("Step 2 Complete.");
                        step2Callback(null,marketIds);
                   }
                });
            }
        },
        function step3(marketIds,step3Callback){
            console.log("***************************************");
            console.log("Step 3: Check and remove marketId if not in table.");
            
            for(var key = 0 ; key<event.demands.length; key++){
                var value = event.demands[key];
                console.log("Checking market Id: " + value.marketId.S);
                var same = false;
                for (var j = 0; j <marketIds.length; j++){
                    if(value.marketId.S === marketIds[j]){
                        same = true;
                        break;
                    } 
                }
                if (same === false){
                    var marketId = value.marketId.S;
                    event.demands.splice(key,1);
                    
                    console.log("Remove event.demands.marketId.S : " + marketId);
                    key--;

                }
            }
            console.log("Step 3 Complete.");
            step3Callback(null);
        },
        function step4(step4Callback){
            console.log("***************************************");
            console.log("Step 4: Update market status.");
            
            var keys = [];
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
                            ":marketStatus": {"S": "GIVEN"},
                            ":requestCounter": {"N":"0"},
                            ":updatedAt": {"S": now}
                        },
                        "ReturnValues": "UPDATED_NEW"
                    };

                    dynamodb.updateItem(updateMarketParams, function(err, data) {
                        if (err) {
                            updateMarketCallback("DB_update_item_error");
                        } else {
                            console.log('Successfully update market id: ' + demand.marketId.S);
                            keys.push(
                                {
                                    "isbn": {"S": demand.isbn.S },
                                    "donor": {"S": event.donor.S}
                                }
                            );
                            updateMarketCallback();
                        }
                    });
                },
                function (err) {
                    if (err) { 
                        console.log("Step 4 Error: " + err);
                        step4Callback("DB_update_item_error");
                    } else {
                        console.log("Step 4 Complete.");
                        step4Callback(null, keys);
                    }
                }
            );
        },
        function step5(keys,step5Callback){
            console.log("***************************************");
            console.log("Step 5: get old market item , add new market.");
            
            if (keys.length === 0){
                console.log("No market need add, Step 5 skip.");
                step5Callback(null);
            } else {
            
                async.eachSeries(keys,
                    function getMarket(key,getMarketCallback){
                        
                        var getItemParams = {
                            "TableName": "hkbbk_market",
                            "Key": {
                                "isbn": {"S": key.isbn.S },
                                "donor": {"S": supplicant.id.S}
                            },
                            "ConsistentRead": false,
                            "ProjectionExpression": "isbn",
                            "ReturnConsumedCapacity": "TOTAL"
                            };
                        dynamodb.getItem(getItemParams, function(err, data) {
                            if (err) { 
                                console.log("Step 5 Error: " + err.stack); // an error occurred
                                getMarketCallback("DB_get_item_error");
                            } else { 
                                if (data.Item !== undefined) {
                                    console.log("supplicant have this market");
                                    getMarketCallback(null);
                                } else {
                                    var getItemParams = {
                                    "TableName": "hkbbk_market",
                                    "Key": key,
                                    "ConsistentRead": false,
                                    "ProjectionExpression": "marketId, isbn, cover, category, credit",
                                    "ReturnConsumedCapacity": "TOTAL"
                                    };
                                    dynamodb.getItem(getItemParams, function(err, data) {
                                        if (err) { 
                                            console.log("Step 5 Error: " + err.stack); // an error occurred
                                            getMarketCallback("DB_get_item_error");
                                        } else { 
                                            if (data.Item !== undefined) {

                                                var market = data.Item;
                                                var newMarketId = uuid.v4();
                                                market.donor = supplicant.id;
                                                market.requestCounter = {"N":"0"};
                                                market.createdAt = {"S": now};
                                                market.updatedAt = {"S": now};
                                                market.marketStatus = {"S":"OFFSHELF"};
                                                market.marketId = {"S": newMarketId};
                                                var putItemParams = {
                                                    "TableName": "hkbbk_market",
                                                    "Item": market

                                                };
                                                dynamodb.putItem(putItemParams, function(err, putItemResult) {
                                                    if (err) {
                                                        console.log(err);
                                                        getMarketCallback("DB_put_item_error");
                                                    } else {
                                                        console.log("Inserted record to market by donor id: " + market.donor.S);
                                                        getMarketCallback(null);
                                                    }
                                                });
                                            } else {
                                                getMarketCallback("DB_get_item_error");
                                            }
                                        }
                                    });    
                                }
                            }
                        });
                   },
                   function (err) {
                        if (err) { 
                            console.log("Step 5 Error: " + err);
                            step5Callback("DB_get_item_error");
                        } else {
                            console.log("Step 5 Complete");
                            step5Callback(null);
                        }
                    }
                );
            }
        },
        function step6(step6Callback){
            console.log("***************************************");
            console.log("Step 6: Query demands table.");
            
            var demandToUpdate = [];
            var users = {};
            var totalCredit = 0;
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
                            ":demandStatus":{"S": "GIVE"}
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
                                demandToUpdate.push( {partitionKey:data.Items[i].requestId.S.toString(), sortKey : data.Items[i].marketId.S.toString(), supplicant: data.Items[i].supplicant.S.toString() , demandStatus : event.supplicant.S === data.Items[i].supplicant.S ? "RECEIVED" : "GIVEN" } );
                                console.log("Market ID: " + data.Items[i].marketId.S.toString());
                                
                                var requestNumber = data.Items[i].requestNumber.S;

                                if (event.supplicant.S !== data.Items[i].supplicant.S){
                                    if( requestNumber in users ) {
                                    users[requestNumber].count += 1;
                                    console.log("Updated supplicant in user list by requestNumber: "+ requestNumber);
                                    } else {
                                        console.log("Added supplicant in user list by requestNumber: "+ requestNumber);
                                        users[requestNumber] = {supplicant: data.Items[i].supplicant.S, credit:null, count:null};
                                        users[requestNumber].count = 1;
                                    }
                                } else if (event.supplicant.S === data.Items[i].supplicant.S) {
                                    console.log("Count total credit by marketId: "+ data.Items[i].marketId.S);
                                    totalCredit += parseInt(data.Items[i].credit.N);
                                    userCredit = parseInt(data.Items[i].credit.N);
                                    returnCredit += parseInt(userCredit/10) ;
                                    console.log("total credit: "+ totalCredit);
                                }
                                
                            } 
                            queryDemandCallback();
                        }
                    });
                }, 
                function (err) {
                    if (err) { 
                        console.log("Step 6 Error: " + err);
                        step6Callback("DB_query_item_error");
                    } else {
                        console.log("Step 6 Complete");
                        //console.log("demandToUpdate: "+ JSON.stringify(demandToUpdate));
                        console.log("user: "+ JSON.stringify(users));
                        step6Callback(null, demandToUpdate, users, totalCredit);
                    }
                }
            );
        },
        function step7(demands, users, totalCredit, step7Callback){  
            console.log("***************************************");
            console.log("Step 7: Update Demand Table"); 
            
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
                        console.log("Step 7 Error: " + err);
                        step7Callback("DB_update_item_error");
                    } else {
                        console.log("Step 7 Complete");
                        step7Callback(null, users, totalCredit);
                    }
                }
            );
        },
        function step8(users, totalCredit, step8Callback){
            console.log("***************************************");
            console.log("Step 8: Update supplicant credit.");

            console.log("Update user: " + event.supplicant.S);
            console.log("Credit: " + totalCredit);
            if (totalCredit === 0) {
                console.log("total credit is 0, don't need update user table.");
                console.log("Step 8 skip.");
                step8Callback(null, users, totalCredit);
            } else {
                var credit = totalCredit - returnCredit;
                var updateDemandParams = {
                    "TableName": "hkbbk_users",
                    "Key": {
                        "id": {"S": event.supplicant.S }
                     },
                    "UpdateExpression": "set credit = credit - :credit, bookReceived = bookReceived + :bookReceived",
                    "ExpressionAttributeValues": {
                        ":credit": {"N": credit.toString()},
                        ":bookReceived" : {"N" : "1"}

                    },
                "ReturnValues": "ALL_NEW"
                };

                dynamodb.updateItem(updateDemandParams, function(err, data) {
                    if (err) { 
                    console.log("Step 8 Error: " + err);
                    step8Callback("DB_update_item_error");
                } else {
                    console.log("Step 8 Complete");
                    step8Callback(null, users, totalCredit);
                }
                });
            }

        },
        function step9(users, totalCredit, step9Callback){
            console.log("***************************************");
            console.log("Step 9: Update donor credit.");

            console.log("Update user: " + event.donor.S);
            console.log("Credit: " + totalCredit);
            
            if (totalCredit === 0) {
                console.log("total credit is 0, don't need update user table.");
                console.log("Step 9 skip.");
                step9Callback(null, users, totalCredit);
            } else {
                var updateDemandParams = {
                    "TableName": "hkbbk_users",
                    "Key": {
                        "id": {"S": event.donor.S }
                     },
                    "UpdateExpression": "set credit = credit + :credit, bookGiven = bookGiven + :bookGiven",
                    "ExpressionAttributeValues": {
                        ":credit": {"N": totalCredit.toString()},
                        ":bookGiven": {"N": "1"}
                    },
                "ReturnValues": "ALL_NEW"
                };

                dynamodb.updateItem(updateDemandParams, function(err, data) {
                    if (err) { 
                    console.log("Step 9 Error: " + err);
                    step9Callback("DB_update_item_error");
                } else {
                    console.log("Step 9 Complete");
                    step9Callback(null, users, totalCredit);
                }
                });
            }
            
        },
        function step10(users, totalCredit, step10Callback){
            console.log("***************************************");
            console.log("Step 10: Query donor profile");
            
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
                    console.log("Step 10 Error: " + err.stack); // an error occurred
                    step10Callback("DB_get_item_error");
                } else {
                    donor = data.Item;
                    console.log("Step 10 completed.");
                    step10Callback(null, users, totalCredit);
                }
            });
        },
        function step11(users, totalCredit, step11Callback){
            console.log("***************************************");
            console.log("Step 11: Save notice to table");
            
            var noticesToAdd = [];
            var data = {donor: event.donor.S, fullname: donor.fullname.S};
            
            if (totalCredit !== 0 && event.demands.length !== 0) {
                console.log("Seting donor notice: " + event.donor.S);
                noticesToAdd.push({userId:event.donor.S,createdAt:now, alert: "[編號:" + requestNumber + "]" + supplicant.fullname.S +"已確認收到" + event.demands.length.toString() + "本書，您已獲贈 +" + totalCredit + "\ue022 。",type:"RECEIVED", data: {supplicant: event.supplicant.S, fullname: supplicant.fullname.S, requestNumber: requestNumber} });
            }
            async.forEachOfSeries(users,
                function addUserNotices(value, requestNumber, addUserNoticesCallback){
                    data = {donor: event.donor.S, fullname: donor.fullname.S, requestNumber: requestNumber };
                    console.log("Seting user notice: " + value.supplicnt);
                    noticesToAdd.push({userId:value.supplicnt,createdAt:now,alert:"[編號:" + requestNumber + "]您向" + donor.fullname.S +"的" + value.count + "本書本請求沒有被接納。",type:"GIVEN", data: data });
                    addUserNoticesCallback(null);
                }, 
                function (err) {
                    if (err) {
                        console.log("Step 11 Error: " + err);
                        step11Callback("DB_put_item_error");
                    }
                }
            );
            async.eachSeries(noticesToAdd,
                function putNoticeToDB(user, putNoticeToDBCallback) {
                    
                    var putItemParams = {};
                    
                    if (user.userId === event.donor.S) {
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
                                        "S": supplicant.fullname.S
                                      },
                                      "supplicant": {
                                        "S": supplicant.id.S
                                      },
                                      "requestNumber": {
                                        "S": requestNumber
                                      }
                                    }
                                },
                                "isRead" : {
                                    "BOOL" : false
                                }
                            }
                        };
                    } else {
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
                                        "S": donor.fullname.S
                                      },
                                      "donor": {
                                        "S": donor.id.S
                                      },
                                      "requestNumber":{
                                          "S": user.data.requestNumber
                                      }
                                    }
                                },
                                "isRead" : {
                                    "BOOL" : false
                                }
                            }
                        };
                    }
                    
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
                        console.log("Step 11 Error: " + err);
                        step11Callback("DB_put_item_error");
                    } else {
                        console.log("Step 11 Complete.");
                        step11Callback(null, noticesToAdd);
                    }
                }
            );
            
        },
        function step12(noticesToAdd, step12Callback) {
            console.log("***************************************");
            console.log("Step 12: Find donor Endpoint(s) and send notification to each device.");
            
            
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
                                    console.log("Step 12: sns pulish start :");
                                    sns.publish(params, function(err, data) {
                                        if (err) {
                                            console.log(err, err.stack);
                                            endpointCallback(null);
                                        } // an error occurred
                                        else {
                                            console.log("Step 12: sns publish complete : " + data);
                                            endpointCallback(null);
                                        }           // successful response
                                        
                                    }); 
                                },
                                function(err){
                                    if (err) { 
                                        console.log("Step 12 Error: " + err);
                                        queryEndpointCallback(null);
                                    } else {
                                        console.log("Step 12: endpointCallback.");
                                        queryEndpointCallback(null);
                                    }
                                }
                            );
                            
                        }
                    });
                },
                function(err){
                    if (err) {
                        console.log("Step 12 Error: " + err);
                        step12Callback(null);
                    } else {
                        console.log("Step 12 Complete.");
                        step12Callback(null);
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
                context.succeed(returnCredit.toString());
            }
        }
    );
};
