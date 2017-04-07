# Require Dateformat Library
npm install dateformat 

# Zip Files
zip -r hkbbkMyRequests.zip hkbbkMyRequests.js node_modules

# Create Lambda Function
aws lambda create-function \ 
--region ap-northeast-1 \ 
--function-name hkbbkMyRequests \ 
--zip-file fileb://~/NetBeansProjects/hkbbkLambda/public_html/hkbbkMyRequests/hkbbkMyRequests.zip \ 
--role arn:aws:iam::310125058045:role/lambda_basic_execution \ 
--handler hkbbkMyRequests.handler \ 
--runtime nodejs \ 
--profile default \ 
--description 'Get my requests list with request book count by providing supplicant ID.' 
--timeout 10 \ 
--memory-size 1024 

# Update Lambda Function Code
aws lambda update-function-code \ 
--region ap-northeast-1 \ 
--function-name hkbbkMyRequests \ 
--zip-file fileb://~/NetBeansProjects/hkbbkLambda/public_html/hkbbkMyRequests/hkbbkMyRequests.zip 