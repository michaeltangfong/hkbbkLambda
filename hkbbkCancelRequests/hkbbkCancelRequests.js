console.log('Loading function');

var async = require('async');
var AWS = require('aws-sdk');
var dateFormat = require('dateformat');
var sns = new AWS.SNS();
var dynamodb = new AWS.DynamoDB();
var credit = null;

exports.handler = function(event, context) {
    
    async.waterfall([
        function Step1(step1Callback) {
            console.log("***************************************");
            console.log("Step 1: Get demand detail.");
            console.log("Query marketId item with supplicant : " + event.supplicant.S);
            var getItemParams = {
                "TableName": "hkbbk_demands",
                "Key": {
                    "marketId": {
                        "S": event.marketId.S
                    },
                    "supplicant": {
                        "S": event.supplicant.S
                    }
                },
                "ConsistentRead": false,
                "ProjectionExpression": "donor, demandStatus, supplicantFullname, credit, supplicant, marketId",
                "ReturnConsumedCapacity": "TOTAL"
            };
            
            dynamodb.getItem(getItemParams, function(err, data) {
                if (err) { 
                    console.log("Step 1 Error: " + err.stack); // an error occurred
                } else {
                    console.log("data: ", JSON.stringify(data));
                    
                    //check item, if no result ,return error
                    if (data.Item !== undefined) {
                        console.log("Step 1 completed.");
                        step1Callback(null, data.Item);
                    }else{
                        console.log("Step 1 error.");
                        step1Callback("Return no result.");
                    }
                }
            });
        },
        function step2(demand,step2Callback){
            console.log("***************************************");
            console.log("Step 2: check demand status and update demand.");
            
            if (demand.demandStatus.S !== "REQUEST"){
                step2Callback("Demand status error: The demand status is not REQUEST.");
            } else {
                console.log("Step 2: update demand item with market id: ", demand.marketId.S);
                
                var now = dateFormat(new Date(), "yyyy-mm-dd HH:MM:ss");
                var updateDemandParams = {
                        "TableName": "hkbbk_demands",
                        "Key": {
                            "marketId": {"S": demand.marketId.S},
                            "supplicant" : {"S": demand.supplicant.S}
                         },
                        "UpdateExpression": "set demandStatus = :demandStatus, updatedAt = :updatedAt",
                        "ExpressionAttributeValues": {
                            ":demandStatus": {"S": "CANCEL"},
                            ":updatedAt": {"S": now}
                        },
                        "ReturnValues": "ALL_NEW"
                    };
                    
                dynamodb.updateItem(updateDemandParams, function(err, data) {
                    if (err) {
                        step2Callback(err);
                    } else {
                        console.log("Step 2 completed.");
                        step2Callback(null,demand,now);
                    }
                });
            }
        },
        function step3(demand,now,step3Callback){
            console.log("***************************************");
            console.log("Step 3: Update user credit.");

            var updateDemandParams = {
                "TableName": "hkbbk_users",
                "Key": {
                    "id": {"S": demand.supplicant.S }
                 },
                "UpdateExpression": "set credit = credit + :credit",
                "ExpressionAttributeValues": {
                    ":credit": {"N": demand.credit.N.toString()}
                },
            "ReturnValues": "ALL_NEW"
            };

            dynamodb.updateItem(updateDemandParams, function(err, data) {
                if (err) {
                    step3Callback(err);
                } else {
                    console.log("Step 3 completed.");
                    step3Callback(null,demand,now);
                }
            });
        },
        function step4(demand, now, step4Callback){
            console.log("***************************************");
            console.log("Step 4: Save notice to table");
            
            var data = {supplicant: demand.supplicant.S, fullname: demand.supplicantFullname.S};
            var notice = {userId:demand.donor.S,createdAt:now,alert: demand.supplicantFullname.S +"向您的1個書本請求被取消。",type:"CANCEL", data: data };

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
                            "S": demand.supplicantFullname.S
                          },
                          "supplicant": {
                            "S": demand.supplicant.S
                          }
                        }
                    }
                }
            };
            dynamodb.putItem(putItemParams, function(err, data) {
                if (err) {
                    console.log("Step 4 Error: " + err);
                    putNoticeToDBCallback(err);
                } else {
                    console.log("Step 4 Complete.");
                    step4Callback(null, notice, demand);
                }
            });

        },
        function Step5(notice, demand,  step5Callback) {
            console.log("***************************************");
            console.log("Step 5: Find donor Endpoint(s) and send notification to each device.");
            
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
                    queryEndpointCallback(err);
                } else { 
                    async.eachSeries(data.Items,
                        function(endpoint, endpointCallback) {                                    
                            var payload = {
                                "APNS_SANDBOX": {
                                    "aps": {
                                        "alert": notice.alert,
                                        "badge": 1,
                                        "type": notice.type,
                                        "sound":"1",
                                        "createdAt": notice.createdAt,
                                        "data" : {
                                            "supplicant" : demand.supplicant.S,
                                            "fullname" : demand.supplicantFullname.S
                                        }
                                    }
                                }
                            };
                            // first have to stringify the inner APNS_SANDBOX object...
                            payload.APNS_SANDBOX = JSON.stringify(payload.APNS_SANDBOX);
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
                                if (err) console.log(err, err.stack); // an error occurred
                                else {
                                    console.log("Step 5: sns publish complete : " + data);
                                    endpointCallback(null);
                                }           // successful response

                            }); 
                        },
                        function(err){
                            if (err) {
                                console.log("Step 5 Error: " + err);
                            } else {
                                console.log("Step 5 Complete.");
                                credit = demand.credit.N;
                                step5Callback(null);
                            }
                        }
                    );

                }
            });
        }
        ],
        function(err, results){
            if (err) { 
                console.log("Error: " + err);
                context.fail(err);
            } else {
                
                context.succeed(credit);
            }
        }
    );
};