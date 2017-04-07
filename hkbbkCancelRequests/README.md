# Require Async Dateformat Library
npm install async dateformat 

# Zip Files
zip -r hkbbkCancelRequests.zip hkbbkCancelRequests.js node_modules

# Create Lambda Function
aws lambda create-function \
--region ap-northeast-1 --function-name hkbbkCancelRequests \
--zip-file fileb://~/NetBeansProjects/hkbbkLambda/public_html/hkbbkCancelRequests/hkbbkCancelRequests.zip \
--role arn:aws:iam::310125058045:role/lambda_basic_execution \
--handler hkbbkCancelRequests.handler \
--runtime nodejs4.3--profile default \
--description '' \
--timeout 10 \
--memory-size 128

# Update Lambda Function Code
aws lambda update-function-code \
--region ap-northeast-1 \
--function-name hkbbkCancelRequests \
--zip-file fileb://~/NetBeansProjects/hkbbkLambda/public_html/hkbbkCancelRequests/hkbbkCancelRequests.zip
