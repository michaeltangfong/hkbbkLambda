# Require Async Library
npm install async dateformat 

# Zip Files
zip -r hkbbkScheduledCloseRequest.zip hkbbkScheduledCloseRequest.js node_modules


#ap-northeast-1 (Tokoyo) Deployment
#########################################

# Create Lambda Function
aws lambda create-function \
--region ap-northeast-1 \
--function-name hkbbkScheduledCloseRequest \
--zip-file fileb://~/NetBeansProjects/hkbbkLambda/public_html/hkbbkScheduledCloseRequest/hkbbkScheduledCloseRequest.zip \
--role arn:aws:iam::310125058045:role/hkbbk_Lambda_Execution_Role \
--handler hkbbkScheduledCloseRequest.handler \
--runtime nodejs4.3 \
--profile default \
--description '2016-07-04 : Scheduled task to close out expired request, set all related demand to expired.' \
--timeout 10 \
--memory-size 128

# Update Lambda Function Code
aws lambda update-function-code \
--region ap-northeast-1 \
--function-name hkbbkScheduledCloseRequest \
--zip-file fileb://~/NetBeansProjects/hkbbkLambda/public_html/hkbbkScheduledCloseRequest/hkbbkScheduledCloseRequest.zip


#us-east-1 (N. Virginia) deployment
#########################################

# Create Lambda Function
aws lambda create-function \
--region us-east-1 \
--function-name hkbbkScheduledCloseRequest \
--zip-file fileb://~/NetBeansProjects/hkbbkLambda/public_html/hkbbkScheduledCloseRequest/hkbbkScheduledCloseRequest.zip \
--role arn:aws:iam::310125058045:role/hkbbk_Lambda_Execution_Role \
--handler hkbbkScheduledCloseRequest.handler \
--runtime nodejs4.3 \
--profile default \
--description '2016-06-02 : Scheduled task to close out expired request, set all related demand to expired.' \
--timeout 10 \
--memory-size 128

# Update Lambda Function Code
aws lambda update-function-code \
--region us-east-1 \
--function-name hkbbkScheduledCloseRequest \
--zip-file fileb://~/NetBeansProjects/hkbbkLambda/public_html/hkbbkScheduledCloseRequest/hkbbkScheduledCloseRequest.zip