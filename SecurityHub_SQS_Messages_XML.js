
//Use AWS Secret Manager to fetch credentials and SQS API to fetch queue messages and write to XML file

require('dotenv').config();                 //load environment variables from a .env file into process.env

var AWS = require('aws-sdk'),               //load AWS SDK
    fs = require('fs'),                     //load fs
    builder = require('xmlbuilder'),        //load xmlbuilder to create XML from JSON object
    region = process.env.REGION,            //AWS region from .env file
    secretName = process.env.SECRETNAME,    //AWS Secret Manager Secret name
    accountId = process.env.ACCOUNTID,      //AWS account id
    queueName = process.env.SECURITYHUBQUEUE, //AWS Security Hub SQS queue name
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
//sqs receivemessage API to fetch messages from Security Hub queue
sqs.receiveMessage(params, (err, data) => {
    if (err) throw err; //throw error
    
    else {  //successful response
      var i;
      //create an XML file of required nodes from JSON sqs message to feed to third party application
      var root = builder.create('root');
      for (i = 0; i < data.Messages.length; i++) {
        var secHubMsg = JSON.parse(data.Messages[i].Body);
        //console.log('SecurityHub Finding JSON', JSON.stringify(secHubMsg));
        //console.log('SQS Message ', secHubMsg);
        var record = root.ele('record');
          var findings =
              record.ele('version', secHubMsg.version).up()
                  .ele('id', secHubMsg.id).up()
                  .ele('source', secHubMsg.source).up()
                  .ele('findings');
          //there can be multiple findings in a single sqs message. Looping through the findings array        
          for (j = 0; j < secHubMsg.detail.findings.length; j++) {
              var finding = findings.ele('finding')
                  .ele('id', secHubMsg.detail.findings[j].Id).up()
                  .ele('title', secHubMsg.detail.findings[j].Title).up()
                  .ele('sourceUrl', secHubMsg.detail.findings[j].SourceUrl).up()
                  .ele('description', secHubMsg.detail.findings[j].Description).up()
                  .ele('severity', secHubMsg.detail.findings[j].Severity.Label).up()
                  .ele('recordstate', secHubMsg.detail.findings[j].RecordState).up()
                  .ele('workflowstate', secHubMsg.detail.findings[j].WorkflowState).up()
                  .ele('workFlowstatus', secHubMsg.detail.findings[j].Workflow.Status).up()
                  .ele('lastObservedAt', secHubMsg.detail.findings[j].LastObservedAt).up()
                  .ele('firstObservedAt', secHubMsg.detail.findings[j].FirstObservedAt)                
          }
      }
  
      var secHubxml = root.end({ pretty: true });
      //console.log(secHubxml);
      
      fs.writeFile(`${__dirname}/securityhub_messages.xml`, secHubxml, function (err) {
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