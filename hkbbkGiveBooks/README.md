# Require Async Library
npm install async 
npm install dateformat 

# Zip Files
zip -r hkbbkGiveBooks.zip hkbbkGiveBooks.js node_modules


#ap-northeast-1 (Tokoyo) Deployment
#########################################

# Create Lambda Function
aws lambda create-function \
--region ap-northeast-1 \
--function-name hkbbkGiveBooks \
--zip-file fileb://~/NetBeansProjects/hkbbkLambda/public_html/hkbbkGiveBooks/hkbbkGiveBooks.zip \
--role arn:aws:iam::310125058045:role/hkbbk_Lambda_Execution_Role \
--handler hkbbkGiveBooks.handler \
--runtime nodejs4.3 \
--profile default \
--description '2016-07-04 : Set market status to HOLD and update demands status accordingly, also SNS will be sent to supplicants.' \
--timeout 10 \
--memory-size 128

# Update Lambda Function Code
aws lambda update-function-code \
--region ap-northeast-1 \
--function-name hkbbkGiveBooks \
--zip-file fileb://~/NetBeansProjects/hkbbkLambda/public_html/hkbbkGiveBooks/hkbbkGiveBooks.zip 


#us-east-1 (N. Virginia) deployment
#########################################

# Create Lambda Function
aws lambda create-function \
--region us-east-1 \
--function-name hkbbkGiveBooks \
--zip-file fileb://~/NetBeansProjects/hkbbkLambda/public_html/hkbbkGiveBooks/hkbbkGiveBooks.zip \
--role arn:aws:iam::310125058045:role/hkbbk_Lambda_Execution_Role \
--handler hkbbkGiveBooks.handler \
--runtime nodejs4.3 \
--profile default \
--description '2016-06-02 : Set market status to HOLD and update demands status accordingly, also SNS will be sent to supplicants.' \
--timeout 10 \
--memory-size 128

# Update Lambda Function Code
aws lambda update-function-code \
--region us-east-1 \
--function-name hkbbkGiveBooks \
--zip-file fileb://~/NetBeansProjects/hkbbkLambda/public_html/hkbbkGiveBooks/hkbbkGiveBooks.zip 