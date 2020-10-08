# AWS Secret Manager and SQS API Node.js Sample Project

A simple Node.js application illustrating usage of the AWS Secret Manager and SQS APIs for fetching findings for Node.js.

## Requirements

•	npm install aws-sdk

•	npm install xmlbuilder

•	npm install dotenv



## Basic Configuration
You need to set up your AWS security credentials before the sample code can connect to AWS.

Method 1: 
You can do this by creating a file named "credentials" at ~/.aws/ (C:\Users<USER_NAME>.aws\ for Windows users) and saving the following lines in the file:

```python
[default]
aws_access_key_id = <your access key id>
aws_secret_access_key = <your secret key>

```
Method 2: 
Install AWS CLI and run 'aws configure' to set access and secret keys

## Dependencies

Create .env file at the node js project root directory and add the following entries

ACCOUNTID = <your_account_id>

REGION = <your_AWS_region>

SECRETNAME = <your_AWS_secretmanager_secretname>
 
GUARDDUTYQUEUE = <your_guardduty_sqs_queue>   //SQS queue that is configured for GuardDuty findings
SECURITYHUBQUEUE = <your_securityhub_queue_name>  //SQS queue that is configured for Security Hub findings

## Running the node .js files

1.	This sample application connects to AWS Secret Manager and fetches the credentials.
2.	The script will fetch the messages(findings) from AWS Security Hub and GuardDuty queues.
3.	Take only the required nodes from JSON objects and convert them to XML file
 
run 'npm start' 
```python
$ npm start
```
