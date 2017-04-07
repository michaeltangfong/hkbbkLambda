console.log('Loading function');
var AWS = require('aws-sdk');
var dateFormat = require('dateformat');
var dynamodb = new AWS.DynamoDB();


exports.handler = function(event, context) {
    console.log("Querying for my requests");
    
    var date = new Date();
    var now = dateFormat(date, "yyyy-mm-dd HH:MM:ss");

    var donors = [];
    var returnValue =[];
    var item = {
        "TableName": "hkbbk_demands",
        "IndexName": "supplicant-createdAt-index",
        "ConsistentRead": false,
        "ScanIndexForward": false,
        "ProjectionExpression": "donorFullname,donor,demandStatus",
        "KeyConditionExpression": "supplicant = :supplicant AND createdAt <= :now",
        "FilterExpression": "#demandStatus = :demandStatus1 OR #demandStatus = :demandStatus2",
        "ExpressionAttributeNames": {
            "#demandStatus": "demandStatus"
        },
        "ExpressionAttributeValues": 
        {
            ":supplicant": {"S": event.supplicant },
            ":now": {"S": now },
            ":demandStatus1":{"S":"REQUEST"},
            ":demandStatus2":{"S":"ACCEPTED"}

        },
        "ReturnConsumedCapacity": "TOTAL"
    };
    dynamodb.query(item, function(err, data) {
        if (err) console.log(err, err.stack); // an error occurred
        else{
            //console.log(data);  
            data.Items.forEach(function(item) {
                //console.log(item);
                donors.push([item.donor.S,item.donorFullname.S,item.demandStatus.S]);
            });
            console.log(donors);
            var count = 0;
            for (var i =0;i <donors.length;i++){
                if(donors[i][2] === "REQUEST"){
                      count++;
                  }
              for (var j =i+1;j <donors.length;j++){

                if(donors[i][0] === donors[j][0] && donors[j][2] === "REQUEST"){
                    count++;
                    donors.splice(j,1);
                    j--;
                } else if (donors[i][0] === donors[j][0] && donors[j][2] === "ACCEPTED"){
                    donors.splice(j,1);
                    j--;
                }
            }
              returnValue.push({"donor":donors[i][0],"donorFullname":donors[i][1],"demandStatus":donors[i][2],"count":count});
                count =0;
            }
            console.log(returnValue);
            context.succeed(returnValue);
        }         // successful response
    });
};