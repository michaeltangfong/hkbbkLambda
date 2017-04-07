# Require Async Library
npm install async 
npm install dateformat 

# Zip Files
zip -r hkbbkUpdateCredit.zip hkbbkUpdateCredit.js node_modules


#ap-northeast-1 (Tokoyo) Deployment
#########################################

# Create Lambda Function
aws lambda create-function \
--region ap-northeast-1 \
--function-name hkbbkUpdateCredit \
--zip-file fileb://~/NetBeansProjects/hkbbkLambda/public_html/hkbbkUpdateCredit/hkbbkUpdateCredit.zip \
--role arn:aws:iam::310125058045:role/hkbbk_Lambda_Execution_Role \
--handler hkbbkUpdateCredit.handler \
--runtime nodejs4.3 \
--profile default \
--description '2016-07-04 : Check if use tables credit update, send SNS to user update nav bar credit.' \
--timeout 10 \
--memory-size 128

# Update Lambda Function Code
aws lambda update-function-code \
--region ap-northeast-1 \
--function-name hkbbkUpdateCredit \
--zip-file fileb://~/NetBeansProjects/hkbbkLambda/public_html/hkbbkUpdateCredit/hkbbkUpdateCredit.zip



#us-east-1 (N. Virginia) deployment
#########################################

# Create Lambda Function
aws lambda create-function \
--region us-east-1 \
--function-name hkbbkUpdateCredit \
--zip-file fileb://~/NetBeansProjects/hkbbkLambda/public_html/hkbbkUpdateCredit/hkbbkUpdateCredit.zip \
--role arn:aws:iam::310125058045:role/hkbbk_Lambda_Execution_Role \
--handler hkbbkUpdateCredit.handler \
--runtime nodejs4.3 \
--profile default \
--description '2016-06-02 : Check if use tables credit update, send SNS to user update nav bar credit.' \
--timeout 10 \
--memory-size 128

# Update Lambda Function Code
aws lambda update-function-code \
--region us-east-1 \
--function-name hkbbkUpdateCredit \
--zip-file fileb://~/NetBeansProjects/hkbbkLambda/public_html/hkbbkUpdateCredit/hkbbkUpdateCredit.zip