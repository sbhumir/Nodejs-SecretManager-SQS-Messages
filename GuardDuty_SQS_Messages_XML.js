
//Use AWS Secret Manager to fetch credentials
//Use SQS API to fetch queue messages and write to XML file

require('dotenv').config();                 //load environment variables from a .env file into process.env

var AWS = require('aws-sdk'),               //load AWS SDK
    fs = require('fs'),                     //load fs
    builder = require('xmlbuilder'),        //load xmlbuilder to create XML from JSON object
    region = process.env.REGION,            //AWS region from .env file
    secretName = process.env.SECRETNAME,    //AWS Secret Manager Secret name
    accountId = process.env.ACCOUNTID,      //AWS account id
    queueName = process.env.GUARDDUTYQUEUE, //AWS GuardDuty SQS queue name
    queueUrl = `https://sqs.us-east-1.amazonaws.com/${accountId}/${queueName}`,
    secret, //global variable to store AWS creds
    decodedBinarySecret;

// Set the region 
AWS.config.update({ region: process.env.REGION });

// Create SQS object
var sqs = new AWS.SQS({ apiVersion: '2012-11-05' });

// Setup SQS receiveMessage parameters
var params = {
    QueueUrl: queueUrl, //required
    MessageAttributeNames: [
        "All"
    ],
    MaxNumberOfMessages: 10, //value b/n 1-10
    VisibilityTimeout: 30,
    WaitTimeSeconds: 20 //value b/n 0-20
};
// Create a Secrets Manager client
var client = new AWS.SecretsManager({
    region: region
});

// use 'GetSecretValue' API to fetch AWS creds and handle errors
client.getSecretValue({ SecretId: secretName }, function (err, data) {
    if (err) {
        // Secrets Manager can't decrypt the protected secret text using the provided KMS key.
        if (err.code === 'DecryptionFailureException') throw err;
        // Missing credentials in config.    
        else if (err.code === 'CredentialsError') throw err;
        // An error occurred on the server side.
        else if (err.code === 'InternalServiceErrorException') throw err;
        // an invalid value for a parameter.
        else if (err.code === 'InvalidParameterException') throw err;
        // a parameter value that is not valid for the current state of the resource.
        else if (err.code === 'InvalidRequestException') throw err;
        // can't find the resource that you asked for.
        else if (err.code === 'ResourceNotFoundException') throw err;
        else throw err; //any other error
    }
    else {
        // Decrypts secret using the associated KMS CMK.
        // Depending on whether the secret is a string or binary, one of these fields will be populated.
        if ('SecretString' in data) {
            secret = data.SecretString;
            secret = JSON.parse(secret);
            //console.log('access key ' + secret.AWS_ACCESS_KEY_ID);
            //console.log('secret key ' + secret.AWS_SECRET_ACCESS_KEY);

        } else {
            buff = new Buffer(data.SecretBinary, 'base64');
            decodedBinarySecret = buff.toString('ascii');
        }
    }

});
//Actual code starts here...
//sqs receivemessage API to fetch messages from queue
sqs.receiveMessage(params, (err, data) => {

    if (err) throw err; //an error occurred
    else {  //successful response
        var i;
        //create an XML file of required nodes from JSON sqs message to feed to third party application
        var root = builder.create('root');
        for (i = 0; i < data.Messages.length; i++) {
            var msgData = JSON.parse(data.Messages[i].Body);
            //console.log('print JSON message ', JSON.stringify(msgData));
            //console.log('SQS Message ', msgData);
            var record = root.ele('record')
            var message = record
                .ele('id', msgData.id).up()
                .ele('version', msgData.version).up()
                .ele('title', msgData.detail.title).up()
                .ele('description', msgData.detail.description).up()
                /*
                .ele('networkInterfaces');        
                for(j=0;j<msgData.detail.resource.instanceDetails.networkInterfaces.length; j++) {
                  message.ele('networkInterface')          
                    .ele('ipV4', msgData.detail.resource.instanceDetails.networkInterfaces[j].publicIp).up()
                    .ele('DnsName', msgData.detail.resource.instanceDetails.networkInterfaces[j].publicDnsName)
                }
                */
                .ele('actionType', msgData.detail.service.action.actionType).up()
                .ele('serviceName', msgData.detail.service.serviceName).up()
                .ele('archived', msgData.detail.service.archived).up()
                .ele('eventFirstSeen', msgData.detail.service.eventFirstSeen).up()
                .ele('eventLastSeen', msgData.detail.service.eventLastSeen).up()
                .ele('count', msgData.detail.service.count).up()
                .ele('severity', msgData.detail.severity).up()
                .ele('createdAt', msgData.detail.createdAt).up()
                .ele('updatedAt', msgData.detail.updatedAt).up()
        }
        var guardDutyxml = root.end({ pretty: true });
        //console.log(guardDutyxml);

        fs.writeFile(`${__dirname}/guardduty_messages.xml`, guardDutyxml, function (err) {
            if (err) return console.log(err);
        });
        fs.close;
        /*
         // Do not want to delete all the messages, so commenting out delete messages code
         for (i = 0; i < data.Messages.length; i++) {
           var deleteParams = {
             QueueUrl: queueUrl,
             ReceiptHandle: data.Messages[i].ReceiptHandle //get the message receipthandle to delete
           };
     
           sqs.deleteMessage(deleteParams, (err, data) => {
             if (err) throw err;
             else {
               console.log('Successfully deleted message from queue');
             }
           });
         }
         */
    }
});