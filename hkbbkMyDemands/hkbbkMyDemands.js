console.log('Loading function');
var AWS = require('aws-sdk');
var dateFormat = require('dateformat');
var dynamodb = new AWS.DynamoDB();


exports.handler = function(event, context) {
    console.log("Querying for my demands");
    
    var date = new Date();

    var now = dateFormat(date, "yyyy-mm-dd HH:MM:ss");
    //console.log("Now Time : " + now);
    
    var supplicants = [];
    var returnValue =[];
        var item = {
    "TableName": "hkbbk_demands",
    "IndexName": "donor-createdAt-index",
    "ConsistentRead": false,
    "ScanIndexForward": false,
    "ProjectionExpression": "supplicantFullname,supplicant,demandStatus",
    "KeyConditionExpression": "donor = :donor AND createdAt <= :now",
    "FilterExpression": "#demandStatus = :demandStatus1 OR #demandStatus = :demandStatus2",
    "ExpressionAttributeNames": {
        "#demandStatus": "demandStatus"
    },
    "ExpressionAttributeValues": 
    {
        ":donor": {"S": event.donor },
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
          supplicants.push([item.supplicant.S,item.supplicantFullname.S,item.demandStatus.S]);
      });
      console.log(supplicants);
      var count = 0;
      for (var i =0;i <supplicants.length;i++){
          if(supplicants[i][2] === "REQUEST"){
                count++;
            }
        for (var j =i+1;j <supplicants.length;j++){
            
          if(supplicants[i][0] === supplicants[j][0] && supplicants[j][2] === "REQUEST"){
              count++;
              supplicants.splice(j,1);
              j--;
          } else if (supplicants[i][0] === supplicants[j][0] && supplicants[j][2] === "ACCEPTED"){
              supplicants.splice(j,1);
              j--;
          }
      }
        returnValue.push({"supplicant":supplicants[i][0],"supplicantFullname":supplicants[i][1],"demandStatus":supplicants[i][2],"count":count});
          count =0;
      }
            console.log(returnValue);
            context.succeed(returnValue);
        }         // successful response
    });
};