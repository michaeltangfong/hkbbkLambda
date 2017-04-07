
var async = require('async');
var AWS = require('aws-sdk');
var util = require('util');
var dateFormat = require('dateformat');
var uuid = require('node-uuid');
var sns = new AWS.SNS();
var dynamodb = new AWS.DynamoDB();

exports.handler = function(event, context) {
    var date = new Date();
    var now = dateFormat(date, "yyyy-mm-dd HH:MM:ss");
    date.setDate(date.getDate() + 7);
    var expiry = dateFormat(date, "yyyy-mm-dd HH:MM:ss");
    console.log("now : "+ now) ;
    console.log("expiry : "+ expiry) ;
    var requestNumber = null;
    var supplicant = null;
    var donor = null;
    async.waterfall([
        function step1(step1Callback){
            console.log("***************************************");
            console.log("Step 1: Check duplicate REQUEST MarketId.");
            
            console.log("Query demend item with supplicant id: " + event.supplicant.S);
            var item = {
                "TableName": "hkbbk_demands",
                "IndexName": "supplicant-demandStatus-index",
                "ConsistentRead": false,
                "ScanIndexForward": false,
                "ProjectionExpression": "marketId, demandStatus",
                "KeyConditionExpression": "supplicant = :supplicant AND demandStatus = :demandStatus",
                "FilterExpression": "#donor = :donor",
                "ExpressionAttributeNames": {
                    "#donor": "donor"
                },
                "ExpressionAttributeValues": 
                {
                    ":donor": {"S": event.donor.S },
                    ":supplicant":{"S":event.supplicant.S},
                    ":demandStatus": {"S": "REQUEST" }
                },
                "ReturnConsumedCapacity": "TOTAL"
            };
            var marketIds = [];
            dynamodb.query(item, function(err, data) {
                if (err) {
                    
                    console.log("Step 1 Error: " + err.stack);
                    console.log(err.stack); // an error occurred

                }else{ 
                    console.log("Step 1 Query Complete : ");
                    data.Items.forEach(function(item) {
                        marketIds.push({marketId:item.marketId.S,demandStatus:item.demandStatus.S});
                    });
                    async.forEachOf(marketIds,
                        function checkMarketId(value, key, checkMarketIdCallback) {
                            
                            for (var j =0; j <event.markets.length; j++){
                                console.log("Check Market Id : " + value.marketId);
                                console.log("Check Market Id by : " + event.markets[j].marketId.S);
                                
                                if(value.marketId === event.markets[j].marketId.S){
                                    var marketId = event.markets[j].marketId.S;
                                    event.markets.splice(j,1);
                                    console.log("Remove event.markets.S : " + marketId);
                                }
                            }
                            checkMarketIdCallback(null);
                        },
                        function (err) {
                            if (err) {
                                console.log("Step 1 Error: " + err.stack);
                                console.error(err.stack);
                            } else {
                                console.log("Step 1 Complete.");
                                step1Callback(null);
                            }
                        }
                    );
               }
            });
            
        },
        function step2(step2Callback) {
            console.log("***************************************");
            console.log("Step 2: Get supplicant detail and credit.");
            console.log("Get user item with id: " + event.supplicant.S);
            
            if (event.supplicant.S === event.donor.S) {
                console.log("Step 2 Error: Equal User."); // an error occurred
                step2Callback("supplicant_equal_donor");
            } else {
                var getItemParams = {
                    "TableName": "hkbbk_users",
                    "Key": {
                        "id": {
                            "S": event.supplicant.S
                        } 
                    },
                    "ConsistentRead": true,
                    "ProjectionExpression": "id, fullname, quickBloxId, credit",
                    "ReturnConsumedCapacity": "TOTAL"
                };

                dynamodb.getItem(getItemParams, function(err, data) {
                    if (err) { 
                        console.log("Step 2 Error: " + err.stack); // an error occurred
                        step2Callback("DB_get_item_error");
                    } else { 
                        console.log("User detail received, step 2 completed.");
                        supplicant = data.Item;
                        step2Callback(null);
                    }
                });
            }
        },
        function step3(step3Callback) {
            console.log("***************************************");
            console.log("Step 3: Get donor detail.");
            console.log("Get user item with id: " + event.donor.S);
            var getItemParams = {
                "TableName": "hkbbk_users",
                "Key": {
                    "id": {
                        "S": event.donor.S
                    } 
                },
                "ConsistentRead": false,
                "ProjectionExpression": "id, fullname, quickBloxId",
                "ReturnConsumedCapacity": "TOTAL"
            };
            
            dynamodb.getItem(getItemParams, function(err, data) {
                if (err) { 
                    console.log("Step 3 Error: " + err.stack); // an error occurred
                    step3Callback("DB_get_item_error");
                } else { 
                    console.log("User detail received, step 3 completed.");
                    donor = data.Item;
                    step3Callback(null);
                }
            });
        },
        function step4(step4Callback) {
            console.log("***************************************");
            console.log("Step 4: Get market(s) details.");
            
            var markets = [];
            var totalConsumeCredit = 0;
           
            async.eachSeries(event.markets, 
                function getMarkets(market, getMarketsCallback){
                    console.log("Get market table item with market id: " + market.marketId.S);
                    

                    var getMarketParams = {
                        "TableName": "hkbbk_market",
                        "Key": {
                            "isbn": {"S": market.isbn.S },
                            "donor": {"S": donor.id.S }
                         },
                        "ConsistentRead": false,
                        "ProjectionExpression": "marketId, isbn, ageGroup, cover, credit, marketStatus, donor, title, userCover",
                        "ReturnConsumedCapacity": "TOTAL"
                    };

                    dynamodb.getItem(getMarketParams, function(err, data) {
                        if (err) { 
                            console.log(err, err.stack); // an error occurred
                            getMarketsCallback("DB_get_item_error");
                        } else {
                            if (data.Item !== undefined) {
                        
                                if ( data.Item.marketStatus.S === "ONSHELF" && data.Item.donor.S === donor.id.S && data.Item.marketId.S === market.marketId.S) {
                                        console.log("donor : " + data.Item.donor.S);
                                        console.log("Returned market status '" + data.Item.marketStatus.S + "', push for next step.");
                                        totalConsumeCredit += parseInt(data.Item.credit.N);
                                        markets.push(data.Item);
                                    } else {
                                        console.log("Returned market status '" + data.Item.marketStatus.S + "', skip record.");
                                    }
                            }                            
                            getMarketsCallback(null);
                        }
                    });
                }, 
                function (err) {
                    if (err) { 
                        console.log("Step 4 Error: " + err);
                        step4Callback("DB_get_item_error");
                    } else {
                        
                        console.log("Step 4 Complete");
                        step4Callback(null, markets, totalConsumeCredit);
                    }
                }
            );
        },
        function step5(markets, totalConsumeCredit, step5Callback) {
            console.log("***************************************");
            console.log("Step 5: real time check supplicant demand credit.");
            if( markets.length === 0 ){
                console.log("No market , Step5 skip.");
                step5Callback(null, markets, totalConsumeCredit);
            } else {
                console.log("Query demand item by supplicant : " + supplicant.id.S);
                var queryParams = {
                            "TableName": "hkbbk_demands",
                            "IndexName": "supplicant-demandStatus-index",
                            "ConsistentRead": false,
                            "ProjectionExpression": "credit",
                            "KeyConditionExpression": "supplicant = :supplicant AND demandStatus = :demandStatus",
                            "ExpressionAttributeValues": {
                                ":demandStatus": {"S": "REQUEST"},
                                ":supplicant": {"S": supplicant.id.S}
                            },
                            "ReturnConsumedCapacity": "TOTAL"
                        };

                dynamodb.query(queryParams, function(err, data) {
                    if (err) { 
                        console.log(err, err.stack); // an error occurred
                        step5Callback("DB_query_item_error");
                    } else {
                        var totalCredit = 0;
                        data.Items.forEach(function(item) {
                            totalCredit += parseInt(item.credit.N);
                        });
                        console.log("total credit : "+ totalCredit );
                        console.log("total Consume credit : "+ totalConsumeCredit );
                        var realCredit =  parseInt(supplicant.credit.N) - totalCredit - totalConsumeCredit;
                        console.log("real credit : "+ realCredit);
                        if (realCredit >= 0) {  // Supplicant has enough credit
                            console.log("Supplicant have enough credit.");
                            step5Callback(null, markets, totalConsumeCredit);
                        } else {
                            console.log("Supplicant does not have enough credit.");
                            console.log("Step 5 Error.");
                            step5Callback("credit_not_enough_request_books");
                        }
                    }
                });
            }
        },
        function step6(markets, totalConsumeCredit, step6Callback) {
            console.log("***************************************");
            console.log("Step 6: Add record to request.");
            
            requestNumber = Math.floor((Math.random() * 999999) + 1);
            //leftPad 
            length = 6;
            pad = '';
            padLength = length - requestNumber.toString().length;
            console.log("padLength : " + padLength);
            while(padLength--) {
                pad += '0';
            }
            requestNumber = pad + requestNumber ;
            console.log("requestNumber : " + requestNumber);
            var requestId = uuid.v4();
            if( markets.length === 0 ){
                console.log("No market , Step6 skip.");
                step6Callback(null, markets, totalConsumeCredit, requestId);
            } else {
                var putItemParams = {
                            "TableName": "hkbbk_requests",
                            "Item": {
                                "requestId": {
                                    "S": requestId
                                },
                                "requestNumber": {
                                    "S": requestNumber.toString()
                                },
                                "numberOfDemands": {
                                    "N": markets.length.toString()
                                },
                                "donor": {
                                    "S": donor.id.S
                                },
         
                                "supplicant": {
                                    "S": supplicant.id.S
                                },

                                "updatedAt": {
                                    "S": now
                                },
                                "expiry": {
                                    "S": expiry
                                },
                                "createdAt": {
                                    "S": now
                                },
                                "requestStatus": {
                                    "S": "OPEN" 
                                }
                            }
                };

                console.log("prarams : " + JSON.stringify(putItemParams));
                dynamodb.putItem(putItemParams, function(err, putItemResult) {
                            if (err) {
                                console.log(err);
                                step6Callback("DB_put_item_error");
                            } else {
                                console.log("Inserted record to request id: " + requestId);
                                step6Callback(null, markets, totalConsumeCredit, requestId);
                            }
                });
            }
        },
        function step7(markets, totalConsumeCredit, requestId, step7Callback) {
            console.log("***************************************");
            console.log("Step 7: Add record(s) to demand, throw error if supplicant does not have enough credit.");
            
            
                var donorIds = {};  // Store donor ids for sending SNS notification.
                
                async.eachSeries(markets,
                    function addDemand(market, addDemandCallback){

                        market.donor.S in donorIds ? donorIds[market.donor.S] += 1 :  donorIds[market.donor.S] = 1; // Count the number of requested book.
                        
                        var demandId = uuid.v4();
                        var putItemParams = {
                            "TableName": "hkbbk_demands",
                            "Item": {
                                "requestId": {
                                    "S": requestId
                                },"requestNumber": {
                                    "S": requestNumber.toString()
                                },
                                "marketId": {
                                    "S": market.marketId.S
                                },
                                "demandId": {
                                    "S": demandId
                                },
                                "ageGroup": {
                                    "S": market.ageGroup.S
                                },
                                "cover": {
                                    "S": market.cover.S
                                },
                                "credit": {
                                    "N": market.credit.N
                                },
                                "demandStatus": {
                                    "S": "REQUEST"
                                },
                                "donor": {
                                    "S": market.donor.S
                                },
                                
                                "isbn": {
                                    "S": market.isbn.S
                                },
                                "title": {
                                    "S": market.title.S
                                },
                                "supplicant": {
                                    "S": supplicant.id.S
                                },
                             
                                "updatedAt": {
                                    "S": now
                                },
                                "createdAt": {
                                    "S": now
                                }
                            }
                        };
                        
                        dynamodb.putItem(putItemParams, function(err, putItemResult) {
                            if (err) {
                                console.log(err);
                                addDemandCallback(err);
                            } else {
                                console.log("Inserted record to demand id: " + demandId);
                                addDemandCallback(null);
                            }
                        });
                    }, 
                    function (err) {
                        if (err) { 
                            console.log("Step 7 Error: " + err);
                            step7Callback("DB_put_item_error");
                        } else {
                            console.log("Step 7 Complete.");
                            step7Callback(null, markets, totalConsumeCredit, donorIds);
                        }
                    }
                );
            
        },
        function step8(markets, totalConsumeCredit, donorIds, step8Callback) {
            console.log("***************************************");
            console.log("Step 8: Add notice to DynamoDB.");
            
            
            async.forEachOfSeries(donorIds,
                function putNoticeToDB(bookCnt, donorId, putNoticeToDBCallback) {
                    var putItemParams = {
                        "TableName": "hkbbk_notices",
                        "Item": {
                            "userId": {
                                "S": donorId
                            },
                            "alert": {
                                "S": "[編號:" + requestNumber.toString() + "] " + supplicant.fullname.S + "向你請求了" + bookCnt + "本書"
                            },
                            "type": {
                                "S": "REQUEST"
                            },
                            "createdAt": {
                                "S": now
                            },
                            "data" : {
                                "M": {
                                  "fullname": {
                                    "S": supplicant.fullname.S
                                  },
                                  "supplicant": {
                                    "S": supplicant.id.S
                                  },
                                  "requestId": {
                                    "S": requestNumber.toString()
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
                            putNoticeToDBCallback(null, bookCnt, donorId);
                        }
                    });
                },
                function(err){
                    if (err) { 
                        console.log("Step 8 Error: " + err);
                        step8Callback("DB_put_item_error");
                    } else {
                        console.log("Step 8 Complete.");
                        step8Callback(null, markets, totalConsumeCredit, donorIds);
                    }
                }
            );
        },
        function step9(markets, totalConsumeCredit, donorIds, step9Callback) {
            console.log("***************************************");
            console.log("Step 9: Find donor Endpoint(s) and send notification to each device.");
            
            
            async.forEachOfSeries(donorIds,
                function queryEndpoint(bookCnt, donorId, queryEndpointCallback) {
                    console.log("Retrieving endpoint of user id: " + donorId);
                    
                    var endpointQueryParams = {
                        "TableName": "hkbbk_endpoints",
                        "IndexName": "id-index",
                        "ConsistentRead": false,
                        "ProjectionExpression": "endpoint",
                        "KeyConditionExpression": "id = :donorId",
                        "ExpressionAttributeValues": {
                            ":donorId": {"S": donorId}
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
                                                "alert": "[編號:" + requestNumber.toString() + "] " + supplicant.fullname.S + "向你請求了" + bookCnt + "本書",
                                                "badge": 1,
                                                "type": "REQUEST",
                                                "createdAt": now,
                                                "sound":"1",
                                                "data" : {
                                                    "supplicant" : supplicant.id.S,
                                                    "fullname" : supplicant.fullname.S,
                                                    "requestId" : requestNumber.toString()
                                                },
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
                                    console.log("Step 9: sns pulish start :");
                                    sns.publish(params, function(err, data) {
                                        if (err) {
                                            console.log(err, err.stack); // an error occurred
                                            endpointCallback(null);
                                        }else {
                                            console.log("Step 9: sns publish complete : " + data);
                                            endpointCallback(null);
                                        }           // successful response
                                        
                                    }); 
                                },
                                function(err){
                                    if (err) { 
                                        console.log("Step 9 Error: " + err);
                                        queryEndpointCallback(null);
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
        
        ],
        function(err, results){
            if (err) { 
                console.log("Error: " + err);
                context.fail(err);
            } else {
                context.succeed(requestNumber);
            }
        }
    );
};


