# Require Libraries
npm install async gm

# Zip Files
zip -r hkbbkCreateThumbnail.zip hkbbkCreateThumbnail.js node_modules


#ap-northeast-1 (Tokoyo) Deployment
#########################################

# Create Lambda Function
aws lambda create-function \
--region ap-northeast-1 \
--function-name hkbbkCreateThumbnail \
--zip-file fileb://~/NetBeansProjects/hkbbkLambda/public_html/hkbbkCreateThumbnail/hkbbkCreateThumbnail.zip \
--role arn:aws:iam::310125058045:role/hkbbk_Lambda_Execution_Role \
--handler hkbbkCreateThumbnail.handler \
--runtime nodejs4.3 \
--profile default \
--description '2016-07-04 : Create Thumbnail images.' \
--timeout 10 \
--memory-size 1024

# Update Lambda Function Code
aws lambda update-function-code \
--region ap-northeast-1 \
--function-name hkbbkCreateThumbnail \
--zip-file fileb://~/NetBeansProjects/hkbbkLambda/public_html/hkbbkCreateThumbnail/hkbbkCreateThumbnail.zip



#development


# Create Lambda Function
aws lambda create-function \
--region us-east-1 \
--function-name hkbbkCreateThumbnail \
--zip-file fileb://~/NetBeansProjects/hkbbkLambda/public_html/hkbbkCreateThumbnail/hkbbkCreateThumbnail.zip \
--role arn:aws:iam::310125058045:role/hkbbk_Lambda_Execution_Role \
--handler hkbbkCreateThumbnail.handler \
--runtime nodejs4.3 \
--profile default \
--description '2016-06-02 : Create Thumbnail images.' \
--timeout 10 \
--memory-size 1024

# Update Lambda Function Code
aws lambda update-function-code \
--region us-east-1 \
--function-name hkbbkCreateThumbnail \
--zip-file fileb://~/NetBeansProjects/hkbbkLambda/public_html/hkbbkCreateThumbnail/hkbbkCreateThumbnail.zip