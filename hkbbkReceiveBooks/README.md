# Require Async Library
npm install async dateformat node-uuid

# Zip Files
zip -r hkbbkReceiveBooks.zip hkbbkReceiveBooks.js node_modules


#ap-northeast-1 (Tokoyo) Deployment
#########################################

# Create Lambda Function
aws lambda create-function \
--region ap-northeast-1 \
--function-name hkbbkReceiveBooks \
--zip-file fileb://~/NetBeansProjects/hkbbkLambda/public_html/hkbbkReceiveBooks/hkbbkReceiveBooks.zip \
--role arn:aws:iam::310125058045:role/hkbbk_Lambda_Execution_Role \
--handler hkbbkReceiveBooks.handler \
--runtime nodejs4.3 \
--profile default \
--description '2016-07-04 : Confirm receive books to donor, update market status, demand status, user credit.' \
--timeout 10 \
--memory-size 128

# Update Lambda Function Code
aws lambda update-function-code \ 
--region ap-northeast-1 \ 
--function-name hkbbkReceiveBooks \ 
--zip-file fileb://~/NetBeansProjects/hkbbkLambda/public_html/hkbbkReceiveBooks/hkbbkReceiveBooks.zip 




#us-east-1 (N. Virginia) deployment
#########################################

# Create Lambda Function
aws lambda create-function \
--region us-east-1 \
--function-name hkbbkReceiveBooks \
--zip-file fileb://~/NetBeansProjects/hkbbkLambda/public_html/hkbbkReceiveBooks/hkbbkReceiveBooks.zip \
--role arn:aws:iam::310125058045:role/hkbbk_Lambda_Execution_Role \
--handler hkbbkReceiveBooks.handler \
--runtime nodejs4.3 \
--profile default \
--description '2016-06-02 : Confirm receive books to donor, update market status, demand status, user credit.' \
--timeout 10 \
--memory-size 128

# Update Lambda Function Code
aws lambda update-function-code \ 
--region us-east-1 \ 
--function-name hkbbkReceiveBooks \ 
--zip-file fileb://~/NetBeansProjects/hkbbkLambda/public_html/hkbbkReceiveBooks/hkbbkReceiveBooks.zip 