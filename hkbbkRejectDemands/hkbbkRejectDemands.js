var async = require('async');
var AWS = require('aws-sdk');
var dateFormat = require('dateformat');
var sns = new AWS.SNS();
var dynamodb = new AWS.DynamoDB();

exports.handler = function(event, context) {
    
    var now = dateFormat(new Date(), "yyyy-mm-dd HH:MM:ss");
    var donor = null;
    async.waterfall([
        function step1(step1Callback){
            console.log("***************************************");
            console.log("Step 1: Query demand(s).");
            
             if (event.donor.S === event.supplicant.S) {
                console.log("Step 1 Error: supplicant = donor .");
                step1Callback("supplicant_equal_donor");
            } else {
                console.log("Query demand item with supplicant id: " + event.supplicant.S);
                var item = {
                    "TableName": "hkbbk_demands",
                    "IndexName": "supplicant-demandStatus-index",
                    "ConsistentRead": false,
                    "ScanIndexForward": false,
                    "ProjectionExpression": "demandStatus, marketId, requestId, requestNumber",
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
                var demands = [];
                dynamodb.query(item, function(err, data) {
                    if (err) {

                        console.log("Step 1 Error: " + err.stack);
                        step2Callback("DB_query_item_error");

                    }else{ 
                        data.Items.forEach(function(item) {
                            demands.push(item);
                        });
                        for(var key = 0 ; key<demands.length; key++){
                            var value = demands[key];
                            console.log("Checking market Id: " + value.marketId.S);
                            var same = false;
                            for (var j = 0; j <event.demands.length; j++){
                                if(value.marketId.S === event.demands[j].marketId.S){
                                    same = true;
                                    break;
                                } 
                            }
                            if (same === false){
                                var marketId = value.marketId.S;
                                demands.splice(key,1);

                                console.log("Remove demands.marketId.S : " + marketId);
                                key--;

                            }
                        }
                        console.log("Step 1 Complete.");
                        step1Callback(null,demands);
                   }
                });
            }
        },
        function step2(demands,step2Callback){
            console.log("***************************************");
            console.log("Step 2: update demand(s) status.");
            
            
            async.eachSeries(demands,
                function updateDemand(demand, updateDemandCallback){
                    var updateDemandParams = {
                        "TableName": "hkbbk_demands",
                        "Key": {
                            "requestId": {"S": demand.requestId.S },
                            "marketId": {"S": demand.marketId.S}
                         },
                        "UpdateExpression": "set demandStatus = :demandStatus, updatedAt = :updatedAt",
                        "ExpressionAttributeValues": {
                            ":demandStatus": {"S": "REJECTED"},
                            ":updatedAt": {"S": now}
                        },
                        "ReturnValues": "UPDATED_NEW"
                    };
                    dynamodb.updateItem(updateDemandParams, function(err, data) {
                        if (err) {
                            updateDemandCallback("DB_update_item_error");
                        } else {
                            console.log('Successfully update demand by request id: ' + demand.requestId.S);
                            console.log('Successfully update demand by market id: ' + demand.marketId.S);
                            updateDemandCallback();
                        }
                    });
                },
                function (err) {
                    if (err) { 
                        console.log("Step 2 Error: " + err);
                        step2Callback("DB_update_item_error");
                    } else {
                        console.log("Step 2 Complete.");
                        step2Callback(null, demands);
                    }
                }
            );
            
        },
        function step3(users, step3Callback){
            console.log("***************************************");
            console.log("Step 3: Query donor profile");
            
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
                    console.log("Step 3 Error: " + err.stack); // an error occurred
                    step3Callback("DB_get_item_error");
                } else {
                    donor = data.Item;
                    console.log("Step 3 completed.");
                    step3Callback(null, users);
                }
            });
        },
        function step4(demands, step4Callback){
            
           
                console.log("***************************************");
                console.log("Step 4: Save notice to table");
                var requestNumber = event.requestNumber.S;
                var data = {donor: donor.id.S, fullname: donor.fullname.S, requestNumber: requestNumber};
                var notice = {userId:event.supplicant.S,createdAt:now,alert:"[編號:" + requestNumber + "]您向" + data.fullname +"的"+ demands.length +"個書本請求沒有被接納。",type:"REJECTED", data: data };
            if(demands.length === 0){
                console.log("No demands, don't need send SNS");
                console.log("Step 4 skip.");
                step4Callback(null, notice, demands);
            } else {
            
                var putItemParams = {
                    "TableName": "hkbbk_notices",
                    "Item": {
                        "userId": {
                            "S": notice.userId
                        },
                        "alert": {
                            "S": notice.alert
                        },
                        "type": {
                            "S": notice.type
                        },
                        "createdAt": {
                            "S": notice.createdAt
                        },
                        "data" : {
                            "M": {
                              "fullname": {
                                "S": data.fullname
                              },
                              "donor": {
                                "S": data.donor
                              },
                              "requestNumber": {
                                "S": data.requestNumber
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
                        console.log("Step 4 Error: " + err);
                        step4Callback(err);
                    } else {
                        console.log("Step 4 Complete.");
                        step4Callback(null, notice, demands);
                    }
                });
            }

        },
        function step5(notice, demands, step5Callback){
            console.log("***************************************");
            console.log("Step 5: Find donor Endpoint(s) and send notification to each device.");
            if(demands.length === 0){
                console.log("No demands, don't need send SNS");
                console.log("Step 5 skip.");
                step5Callback(null);
            } else {
                console.log("Retrieving endpoint of user id: " + notice.userId);

                var endpointQueryParams = {
                    "TableName": "hkbbk_endpoints",
                    "IndexName": "id-index",
                    "ConsistentRead": false,
                    "ProjectionExpression": "endpoint",
                    "KeyConditionExpression": "id = :id",
                    "ExpressionAttributeValues": {
                        ":id": {"S": notice.userId}
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
                                            "alert": notice.alert,
                                            "badge": 1,
                                            "type": notice.type,
                                            "sound":"1",
                                            "createdAt": notice.createdAt,
                                            "data" : notice.data,
                                            "isRead": false
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
                                console.log("Step 5: sns pulish start :");
                                sns.publish(params, function(err, data) {
                                    if (err) {
                                        console.log(err, err.stack); // an error occurred
                                        endpointCallback(null);
                                    } else {
                                        console.log("Step 5: sns publish complete : " + data);
                                        endpointCallback(null);
                                    }           // successful response

                                }); 
                            },
                            function(err){
                                if (err) {
                                    console.log("Step 5 Error: " + err);
                                    step5Callback(null);
                                } else {
                                    console.log("Step 5 Complete.");
                                    step5Callback(null);
                                }
                            }
                        );

                    }
                });
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
