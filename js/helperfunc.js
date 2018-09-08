function getMetaData(globalMcatName)
{
	//$.mobile.loadingMessage = 'Loading...';
			$.mobile.showPageLoadingMsg();
			var lObj = $.mobile.path.parseUrl($(location).attr('href'));
			var urlPrefix = lObj.protocol + "//" + lObj.hostname;
						jQuery.ajax({
							url: urlPrefix+':5555',
							data: 'stype=4&McatName='+globalMcatName,
							dataType: 'jsonp',
							success: loadSuccessMeta,
							error: loadErrorMeta
				});
}
function loadSuccessMeta(response)
{
	globalStoredMetadata = response.DataService.Transaction.Response.MasterCatalogRecord.RelationshipData.Relationship[1].RelatedEntities.RecordAttribute;
	//call details
	if (globalMcatName == "PARTY")
	{
		getDetailsCust(globalFname,globalLname);
	}
	if (globalMcatName == "PRODUCT_MASTER")
	{
		getDetailsProd(globalProdId,globalMcatName);  
	}
}
function loadErrorMeta(jqXHR, textStatus, errorThrown)
		{
				$.mobile.hidePageLoadingMsg();
				// Title should be 'Transaction failed'
				alert('Unable to load search: ' + jqXHR.statusText + "(" + jqXHR.status + ")");
		}
function getAttribCat(entity)
{
	for(i=0;i<globalStoredMetadata.length;i++)
	{
		if (entity == globalStoredMetadata[i].ExternalKeys.Key.content)
		{
			//alert("Entity " + entity + " belongs in " + globalStoredMetadata[i].RelationshipData.Relationship.RelatedEntities.AttributeGroup.ExternalKeys.Key.content);
			return globalStoredMetadata[i].RelationshipData.Relationship.RelatedEntities.AttributeGroup.ExternalKeys.Key.content;
		}
	}
	return globalUnknownTab; //title not there
}
function getQuerystring(name) {
    var hash = document.location.hash;
    var match = "";
    if (hash != undefined && hash != null && hash != '') {
        match = RegExp('[?&]' + name + '=([^&]*)').exec(hash);
    }
    else {
        match = RegExp('[?&]' + name + '=([^&]*)').exec(document.location.search);
    }
    return match && decodeURIComponent(match[1].replace(/\+/g, ' '));
}
function connectTWM(connectionURLArg,msgUsernameArg,msgPasswordArg,topicArg)
{
                stompConnectionFactory = new StompConnectionFactory(connectionURLArg);
				//stompConnectionFactory = new StompConnectionFactory("ws://localhost:8001/jms");


            if (connection == null) {
                var connectionFuture = stompConnectionFactory.createConnection(msgUsernameArg, msgPasswordArg, function () {
                    try {
                        connection = connectionFuture.getValue();              
                       var session = connection.createSession(false, Session.AUTO_ACKNOWLEDGE);
                       var topic = session.createTopic(topicArg);
                       var consumer = session.createConsumer(topic);
                       consumer.setMessageListener(onTWebMsg);
                       connection.start(function () { /* Started */ });


                        }
                        catch (e) {
                            alert(e.message);
                        }
                    });
                }
                else {
                    try {
                        connection.close(function () { /* Closed */ });
                    }
                    finally {
                        connection = null;
                    }
                }
            }