# Require Async Dateformat Library
npm install async dateformat 

# Zip Files
zip -r hkbbkDonorMarketByUserDemand.zip hkbbkDonorMarketByUserDemand.js node_modules


#ap-northeast-1 (Tokoyo) Deployment
#########################################

# Create Lambda Function
aws lambda create-function \
--region ap-northeast-1 --function-name hkbbkDonorMarketByUserDemand \
--zip-file fileb://~/NetBeansProjects/hkbbkLambda/public_html/hkbbkDonorMarketByUserDemand/hkbbkDonorMarketByUserDemand.zip \
--role arn:aws:iam::310125058045:role/hkbbk_Lambda_Execution_Role \
--handler hkbbkDonorMarketByUserDemand.handler \
--runtime nodejs4.3 \
--profile default \
--description '2016-07-04 : Retrieve Donor market(s) by user demand' \
--timeout 10 \
--memory-size 128

# Update Lambda Function Code
aws lambda update-function-code \
--region ap-northeast-1 \
--function-name hkbbkDonorMarketByUserDemand \
--zip-file fileb://~/NetBeansProjects/hkbbkLambda/public_html/hkbbkDonorMarketByUserDemand/hkbbkDonorMarketByUserDemand.zip


#development


# Create Lambda Function
aws lambda create-function \
--region us-east-1 \
--function-name hkbbkDonorMarketByUserDemand \
--zip-file fileb://~/NetBeansProjects/hkbbkLambda/public_html/hkbbkDonorMarketByUserDemand/hkbbkDonorMarketByUserDemand.zip \
--role arn:aws:iam::310125058045:role/hkbbk_Lambda_Execution_Role \
--handler hkbbkDonorMarketByUserDemand.handler \
--runtime nodejs4.3 \
--profile default \
--description '2016-06-02 : Retrieve Donor market(s) by user demand' \
--timeout 10 \
--memory-size 128

# Update Lambda Function Code
aws lambda update-function-code \
--region us-east-1 \
--function-name hkbbkDonorMarketByUserDemand \
--zip-file fileb://~/NetBeansProjects/hkbbkLambda/public_html/hkbbkDonorMarketByUserDemand/hkbbkDonorMarketByUserDemand.zip