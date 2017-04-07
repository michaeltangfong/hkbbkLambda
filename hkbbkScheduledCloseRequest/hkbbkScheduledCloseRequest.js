console.log('Loading function');

var AWS = require('aws-sdk');
var dateFormat = require('dateformat');
var dynamodb = new AWS.DynamoDB();
var sns = new AWS.SNS();
var async =  require('async');

exports.handler = function(event, context) {
    
    var date = new Date();

    var now = dateFormat(date, "yyyy-mm-dd HH:MM:ss");
    
    var requestQueryParams = {
        "TableName": "hkbbk_requests",
        "IndexName": "requestStatus-expiry-index",
        "ConsistentRead": false,
        "KeyConditionExpression": "requestStatus = :requestStatus AND expiry < :now",
        "ExpressionAttributeValues": 
        {
            ":requestStatus": {"S": "OPEN" },
            ":now": {"S": now }
        },
        "ReturnConsumedCapacity": "TOTAL"
    };
    
    dynamodb.query(requestQueryParams, function(err, requests) {
        if (err) {
            console.log(err, err.stack); // an error occurred
            context.fail(err)
        } else {
            
            async.eachSeries(requests.Items,
                function closeRequest(request, closeRequestCallback) {
                    var cnt = 0;
                    console.log("Processing request id: " + request.requestId.S + " created at: " + request.createdAt.S);
                    
                    async.waterfall([
                        function queryDemands(queryDemandsCallback){
                            console.log("**************************************************************************");
                            console.log("Step 1. Query demands...");
                            var demandQueryParams = {
                                "TableName": "hkbbk_demands",
                                "IndexName": "requestId-demandStatus-index",
                                "ConsistentRead": false,
                                "KeyConditionExpression": "requestId = :requestId AND demandStatus = :request",
                                "ExpressionAttributeValues": 
                                {
                                    ":requestId": {"S": request.requestId.S },
                                    ":request": {"S": "REQUEST" }
                                },
                                "ReturnConsumedCapacity": "TOTAL"
                            };
                            
                            dynamodb.query(demandQueryParams, function(err, demands) {
                                if (err) {
                                    console.log(err, err.stack); // an error occurred
                                    context.fail(err);
                                } else {
                                    console.log("Step 1. Acquired " + demands.Count + " demand record(s).");
                                    cnt = demands.Count;
                                    queryDemandsCallback(null, demands.Items);
                                }
                            });
                        },
                        function updateDemands(demands, updateDemandsCallback){
                            console.log("**************************************************************************");
                            console.log("Step 2. Updating demands...");
                            
                            if (cnt === 0 ){
                                console.log("Step 2: Don't need to update demands .");
                                updateDemandsCallback(null);
                            } else {
                            
                                async.eachSeries(demands, 
                                    function updateDemand(demand, updateDemandCallback) {
                                        var params = {
                                            "TableName": "hkbbk_demands",
                                            "Key": 
                                            {
                                                "requestId": {"S": demand.requestId.S },
                                                "marketId": {"S" : demand.marketId.S }
                                            },
                                            "UpdateExpression": "set demandStatus = :expired",
                                            "ConditionExpression": "demandStatus = :request",
                                            "ExpressionAttributeValues": {
                                                ":expired": {"S": "EXPIRED"},
                                                ":request": {"S": "REQUEST"}
                                            },
                                            "ReturnValues": "ALL_NEW"
                                        };

                                        dynamodb.updateItem(params, function(err, updatedDemand) {
                                            if (err) { 
                                                console.log(err, err.stack); // an error occurred
                                            } else {
                                                console.log("Updated demand (marketId: " + updatedDemand.Attributes.marketId.S + ") to status " + updatedDemand.Attributes.demandStatus.S );
                                                updateDemandCallback(null);
                                            }           
                                        });


                                    },
                                    function (err) {
                                        if (err) {
                                            console.error(err.stack);
                                            context.fail(err)
                                        } else {
                                            console.log("Step 2 Completed.");
                                            updateDemandsCallback(null);
                                        }
                                    }
                                );
                            }
                        },
                        function updateRequest(updateRequestCallback){
                            console.log("**************************************************************************");
                            console.log("Step 3. Updating request...");
                            
                            var params = {
                                "TableName": "hkbbk_requests",
                                "Key": 
                                {
                                    "requestId": {"S": request.requestId.S },
                                    "createdAt": {"S" : request.createdAt.S }
                                },
                                "UpdateExpression": "set requestStatus = :closed",
                                "ExpressionAttributeValues": {
                                    ":closed": {"S": "CLOSED"}
                                },
                                "ReturnValues": "ALL_NEW"
                            };

                            dynamodb.updateItem(params, function(err, updatedRequestData) {
                                if (err) { 
                                    console.log(err, err.stack); // an error occurred
                                } else {
                                    console.log("Updated request (requestId: " + updatedRequestData.Attributes.requestId.S + " createdAt: " + updatedRequestData.Attributes.createdAt.S +  ") to status " + updatedRequestData.Attributes.requestStatus.S );
                                    console.log("Step 3 Completed.");
                                    updateRequestCallback(null);
                                }           
                            });
                        },
                        function insertSNS(insertSNSCallback) {
                            console.log("**************************************************************************");
                            console.log("Step 4: Insert notice to DynamoDB.");
                            
                            if (cnt === 0 ){
                                console.log("Step 4: Don't need to insert SNS .");
                                insertSNSCallback(null);
                            } else {

                                var insertSNSParams = {
                                    "TableName": "hkbbk_notices",
                                    "Item": {
                                        "userId": {
                                            "S": request.supplicant.S
                                        },
                                        "alert": {
                                            "S": "[編號:" + request.requestNumber.S + "] 你向" + request.donorFullname.S + "請求的" + cnt + "本書已經逾期。"
                                        },
                                        "type": {
                                            "S": "EXPIRED"
                                        },
                                        "createdAt": {
                                            "S": now
                                        },
                                        "data" : {
                                            "M": {
                                              "fullname": {
                                                "S": request.donorFullname.S,
                                              },
                                              "donor": {
                                                "S": request.donor.S,
                                              },
                                              "requestId": {
                                                "S": request.requestId.S,
                                              },
                                            }
                                        },
                                        "isRead" : {
                                                "BOOL" : false
                                            }
                                    }
                                };
                                dynamodb.putItem(insertSNSParams, function(err, data) {
                                    if (err) {
                                        console.log(err, err.stack);
                                        insertSNSCallback(err);
                                    } else {
                                        console.log("Step 4: Insert notice to DynamoDB Complete.");
                                        insertSNSCallback(null);
                                    }
                                });
                            }
                                
                        },
                        function sendSNS(sendSNSCallback) {
                            console.log("**************************************************************************");
                            console.log("Step 5: Find supplicant Endpoint(s) and send notification to each device.");
                            
                            if (cnt === 0 ){
                                console.log("Step 5: Don't need to send SNS .");
                                sendSNSCallback(null);
                            } else {
                                console.log("Retrieving endpoint of supplicant id: " + request.supplicant.S);

                                var endpointQueryParams = {
                                    "TableName": "hkbbk_endpoints",
                                    "IndexName": "id-index",
                                    "ConsistentRead": false,
                                    "ProjectionExpression": "endpoint",
                                    "KeyConditionExpression": "id = :donorId",
                                    "ExpressionAttributeValues": {
                                        ":donorId": {"S": request.supplicant.S}
                                    },
                                    "ReturnConsumedCapacity": "TOTAL"
                                };

                                dynamodb.query(endpointQueryParams, function(err, supplicantEndpointData) {
                                    if (err) { 
                                        console.log(err, err.stack); // an error occurred
                                        sendSNSCallback(null);
                                    } else { 
                                        async.eachSeries(supplicantEndpointData.Items,
                                            function(endpoint, endpointCallback) {                                    
                                                var payload = {
                                                    "APNS": {
                                                        "aps": {
                                                            "alert": "[編號:" + request.requestNumber.S + "] 你向" + request.donorFullname.S + "請求的" + cnt + "本書已經逾期。",
                                                            "badge": 1,
                                                            "type": "EXPIRED",
                                                            "createdAt": now,
                                                            "sound":"1",
                                                            "data" : {
                                                                "donor" : request.donor.S,
                                                                "fullname" : request.donorFullname.S,
                                                                "requestId": request.requestId.S
                                                            },
                                                            "isRead" :false
                                                        }
                                                    }
                                                };
                                                // first have to stringify the inner APNS_SANDBOX object...
                                                payload.APNS = JSON.stringify(payload.APNS);
                                                // then have to stringify the entire message payload
                                                payload = JSON.stringify(payload);

                                                var params = {
                                                    Message: payload,
                                                    MessageStructure: 'json',
                                                    Subject: 'HKBBK',
                                                    TargetArn: endpoint.endpoint.S
                                                };

                                                sns.publish(params, function(err, snsData) {
                                                    if (err) {
                                                        console.log(err, err.stack); // an error occurred
                                                        endpointCallback(null);
                                                    }else {
                                                        console.log("SNS published to endpoint: " + endpoint.endpoint.S);
                                                        console.log(snsData);
                                                        endpointCallback(null);
                                                    }           // successful response

                                                }); 
                                            },
                                            function(err){
                                                if (err) { 
                                                    console.log("Step 5 Error: " + err);
                                                    sendSNSCallback(null);
                                                } else {
                                                    console.log("Step 5: Completed.");
                                                    sendSNSCallback(null);
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
                                closeRequestCallback(null);
                            }
                        }
                    );
                },
                function (err) {
                    if (err) {
                        console.error(err.stack);
                        context.fail(err)
                    } else {
                        console.log("Execute hkbbkScheduledCloseRequest() successfully.");
                        
                        var response = {
                            "success": true,
                            "message": "Execute hkbbkScheduledCloseRequest() successfully.",
                            "time" : now
                        };
                        response = JSON.stringify(response);
                        context.succeed(response);
                    }
                }
            );


        }
    });
};