# Zip Files
zip -r hkbbkCountDemands.zip hkbbkCountDemands.js node_modules

# Require Async Library
npm install async 
npm install dateformat 

# Create Lambda Function
aws lambda create-function \ 
--region ap-northeast-1 \ 
--function-name hkbbkCountDemands \ 
--zip-file fileb://~/NetBeansProjects/hkbbkLambda/public_html/hkbbkCountDemands/hkbbkCountDemands.zip \ 
--role arn:aws:iam::310125058045:role/lambda_basic_execution \ 
--handler hkbbkCountDemands.handler \ 
--runtime nodejs4.3\ 
--profile default \ 
--description 'Update Market requestCounter base on Demand behavior (e.g. Insert, Delete, Cancel).' 
--timeout 10 \ 
--memory-size 1024 

# Update Lambda Function Code
aws lambda update-function-code \ 
--region ap-northeast-1 \ 
--function-name hkbbkCountDemands \ 
--zip-file fileb://~/NetBeansProjects/hkbbkLambda/public_html/hkbbkCountDemands/hkbbkCountDemands.zip 