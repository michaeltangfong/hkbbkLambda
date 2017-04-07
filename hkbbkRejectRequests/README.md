# Require Async Dateformat Library
npm install async dateformat 

# Zip Files
zip -r hkbbkRejectRequests.zip hkbbkRejectRequests.js node_modules

# Create Lambda Function
aws lambda create-function \
--region ap-northeast-1 --function-name hkbbkRegisterDevice \
--zip-file fileb://~/NetBeansProjects/hkbbkLambda/public_html/hkbbkRejectRequests/hkbbkRejectRequests.zip \
--role arn:aws:iam::310125058045:role/lambda_basic_execution \
--handler hkbbkRejectRequests.handler \
--runtime nodejs4.3--profile default \
--description 'Reject Requests' \
--timeout 10 \
--memory-size 128

# Update Lambda Function Code
aws lambda update-function-code \
--region ap-northeast-1 \
--function-name hkbbkRejectRequests \
--zip-file fileb://~/NetBeansProjects/hkbbkLambda/public_html/hkbbkRejectRequests/hkbbkRejectRequests.zip
