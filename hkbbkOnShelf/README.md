# Require Async Library
npm install async dateformat

# Zip Files
zip -r hkbbkOnShelf.zip hkbbkOnShelf.js node_modules

# Create Lambda Function
aws lambda create-function --region ap-northeast-1 --function-name hkbbkOnShelf --zip-file fileb://~/NetBeansProjects/hkbbkLambda/public_html/hkbbkOnShelf/hkbbkOnShelf.zip --role arn:aws:iam::310125058045:role/lambda_basic_execution --handler hkbbkOnShelf.handler --runtime nodejs4.3 --profile default --description 'On shelf market and update user credit.' --timeout 10 --memory-size 128

# Update Lambda Function Code
aws lambda update-function-code \
--region ap-northeast-1 \
--function-name hkbbkOnShelf \
--zip-file fileb://~/NetBeansProjects/hkbbkLambda/public_html/hkbbkOnShelf/hkbbkOnShelf.zip
