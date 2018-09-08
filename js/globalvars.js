
var globalStoredMetadata; //stores the JSON Metadata object
var globalMcatName; // stores the resp
var globalUnknownTab = "SYSTEM";
var globalFname;
var globalLname;
var globalProdId;

//Web Messaging variables
var connection = null; // web messaging connection object
var connectionURL = "ws://192.168.1.200:8001/jms"; //web messaging url
var msgUsername = "admin";
var msgPassword = "admin";
var msgTopic = "/topic/barcode" 