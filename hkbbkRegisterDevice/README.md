# Require Async Dateformat Library
npm install async dateformat 

# Zip Files
zip -r hkbbkRegisterDevice.zip hkbbkRegisterDevice.js node_modules



#ap-northeast-1 (Tokoyo) Deployment
#########################################

# Create Lambda Function
aws lambda create-function \
--region ap-northeast-1 \
--function-name hkbbkRegisterDevice \
--zip-file fileb://~/NetBeansProjects/hkbbkLambda/public_html/hkbbkRegisterDevice/hkbbkRegisterDevice.zip \
--role arn:aws:iam::310125058045:role/hkbbk_Lambda_Execution_Role \
--handler hkbbkRegisterDevice.handler \
--runtime nodejs4.3 \
--profile default \
--description '2016-07-04 : Register device for notification, create Endpoint ARN if not exist.' \
--timeout 10 \
--memory-size 128

# Update Lambda Function Code
aws lambda update-function-code \
--region ap-northeast-1 \
--function-name hkbbkRegisterDevice \
--zip-file fileb://~/NetBeansProjects/hkbbkLambda/public_html/hkbbkRegisterDevice/hkbbkRegisterDevice.zip




#us-east-1 (N. Virginia) deployment
#########################################

# Create Lambda Function
aws lambda create-function \
--region us-east-1 \
--function-name hkbbkRegisterDevice \
--zip-file fileb://~/NetBeansProjects/hkbbkLambda/public_html/hkbbkRegisterDevice/hkbbkRegisterDevice.zip \
--role arn:aws:iam::310125058045:role/hkbbk_Lambda_Execution_Role \
--handler hkbbkRegisterDevice.handler \
--runtime nodejs4.3 \
--profile default \
--description '2016-06-02 : Register device for notification, create Endpoint ARN if not exist.' \
--timeout 10 \
--memory-size 128

# Update Lambda Function Code
aws lambda update-function-code \
--region us-east-1 \
--function-name hkbbkRegisterDevice \
--zip-file fileb://~/NetBeansProjects/hkbbkLambda/public_html/hkbbkRegisterDevice/hkbbkRegisterDevice.zip