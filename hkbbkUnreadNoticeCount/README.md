# Zip Files
zip -r hkbbkUnreadNoticeCount.zip hkbbkUnreadNoticeCount.js


#ap-northeast-1 (Tokoyo) Deployment
#########################################

# Create Lambda Function
aws lambda create-function \
--region ap-northeast-1 \
--function-name hkbbkUnreadNoticeCount \
--zip-file fileb://~/NetBeansProjects/hkbbkLambda/public_html/hkbbkUnreadNoticeCount/hkbbkUnreadNoticeCount.zip \
--role arn:aws:iam::310125058045:role/hkbbk_Lambda_Execution_Role \
--handler hkbbkUnreadNoticeCount.handler \
--runtime nodejs4.3 \
--profile default \
--description '2016-07-04 : Return number of unread notice by providing user id.' \
--timeout 10 \
--memory-size 128

# Update Lambda Function Code
aws lambda update-function-code \
--region ap-northeast-1 \
--function-name hkbbkUnreadNoticeCount \
--zip-file fileb://~/NetBeansProjects/hkbbkLambda/public_html/hkbbkUnreadNoticeCount/hkbbkUnreadNoticeCount.zip


#development


# Create Lambda Function
aws lambda create-function \
--region us-east-1 \
--function-name hkbbkUnreadNoticeCount \
--zip-file fileb://~/NetBeansProjects/hkbbkLambda/public_html/hkbbkUnreadNoticeCount/hkbbkUnreadNoticeCount.zip \
--role arn:aws:iam::310125058045:role/hkbbk_Lambda_Execution_Role \
--handler hkbbkUnreadNoticeCount.handler \
--runtime nodejs4.3 \
--profile default \
--description '2016-06-02 : Return number of unread notice by providing user id.' \
--timeout 10 \
--memory-size 128

# Update Lambda Function Code
aws lambda update-function-code \
--region us-east-1 \
--function-name hkbbkUnreadNoticeCount \
--zip-file fileb://~/NetBeansProjects/hkbbkLambda/public_html/hkbbkUnreadNoticeCount/hkbbkUnreadNoticeCount.zip