# Zip Files
zip -r hkbbkCountRequests.zip hkbbkCountRequests.js

# Create Lambda Function
aws lambda create-function \ 
--region ap-northeast-1 \ 
--function-name hkbbkCountRequests \ 
--zip-file fileb://~/NetBeansProjects/hkbbkLambda/public_html/hkbbkCountRequests/hkbbkCountRequests.zip \ 
--role arn:aws:iam::310125058045:role/lambda_basic_execution \ 
--handler hkbbkCountRequests.handler \ 
--runtime nodejs \ 
--profile default \ 
--description 'count donor and supplicant demands count.' 
--timeout 10 \ 
--memory-size 1024 

# Update Lambda Function Code
aws lambda update-function-code \ 
--region ap-northeast-1 \ 
--function-name hkbbkCountRequests \ 
--zip-file fileb://~/NetBeansProjects/hkbbkLambda/public_html/hkbbkCountRequests/hkbbkCountRequests.zip 