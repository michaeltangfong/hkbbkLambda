# Require Dateformat Library
npm install dateformat 

# Zip Files
zip -r hkbbkMyDemands.zip hkbbkMyDemands.js node_modules

# Create Lambda Function
aws lambda create-function \ 
--region ap-northeast-1 \ 
--function-name hkbbkMyDemands \ 
--zip-file fileb://~/NetBeansProjects/hkbbkLambda/public_html/hkbbkMyDemands/hkbbkMyDemands.zip \ 
--role arn:aws:iam::310125058045:role/lambda_basic_execution \ 
--handler hkbbkMyDemands.handler \ 
--runtime nodejs \ 
--profile default \ 
--description 'Get supplicant list with request book count by providing doner ID.' 
--timeout 10 \ 
--memory-size 1024 

# Update Lambda Function Code
aws lambda update-function-code \ 
--region ap-northeast-1 \ 
--function-name hkbbkMyDemands \ 
--zip-file fileb://~/NetBeansProjects/hkbbkLambda/public_html/hkbbkMyDemands/hkbbkMyDemands.zip 