# Require Async Library
npm install async dateformat node-uuid

# Zip Files
zip -r hkbbkRequestBooks.zip hkbbkRequestBooks.js node_modules


#ap-northeast-1 (Tokoyo) Deployment
#########################################

# Create Lambda Function
aws lambda create-function \
--region ap-northeast-1 \
--function-name hkbbkRequestBooks \
--zip-file fileb://~/NetBeansProjects/hkbbkLambda/public_html/hkbbkRequestBooks/hkbbkRequestBooks.zip \
--role arn:aws:iam::310125058045:role/hkbbk_Lambda_Execution_Role \
--handler hkbbkRequestBooks.handler \
--runtime nodejs4.3 \
--profile default \
--description '2016-07-04 : Check User Credit, then create demand record(s) and sent notification to Donor.' \
--timeout 10 \
--memory-size 128

# Update Lambda Function Code
aws lambda update-function-code \
--region ap-northeast-1 \
--function-name hkbbkRequestBooks \
--zip-file fileb://~/NetBeansProjects/hkbbkLambda/public_html/hkbbkRequestBooks/hkbbkRequestBooks.zip


#us-east-1 (N. Virginia) deployment
#########################################

# Create Lambda Function
aws lambda create-function \
--region us-east-1 \
--function-name hkbbkRequestBooks \
--zip-file fileb://~/NetBeansProjects/hkbbkLambda/public_html/hkbbkRequestBooks/hkbbkRequestBooks.zip \
--role arn:aws:iam::310125058045:role/hkbbk_Lambda_Execution_Role \
--handler hkbbkRequestBooks.handler \
--runtime nodejs4.3 \
--profile default \
--description '2016-06-02 : Check User Credit, then create demand record(s) and sent notification to Donor.' \
--timeout 10 \
--memory-size 128

# Update Lambda Function Code
aws lambda update-function-code \
--region us-east-1 \
--function-name hkbbkRequestBooks \
--zip-file fileb://~/NetBeansProjects/hkbbkLambda/public_html/hkbbkRequestBooks/hkbbkRequestBooks.zip