// Reference the packages we require so that we can use them in creating the bot
var restify = require('restify');
var builder = require('botbuilder');
var rp = require('request-promise');

// Static variables that we can use anywhere in server.js
var BINGSEARCHKEY = '4b0ad13a83c94bad9554a69c573b7ec9';

//=========================================================
// Bot Setup
//=========================================================

// Setup Restify Server
// Listen for any activity on port 3978 of our local server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});

// Create chat bot
var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID || '886cf5e7-2ea9-41c4-a427-9368bfcb8ad0',
    appPassword: process.env.MICROSOFT_APP_PASSWORD || 'yLi563NoekAhkB5sKnm8wb0'
});
var bot = new builder.UniversalBot(connector);
// If a Post request is made to /api/messages on port 3978 of our local server, then we pass it to the bot connector to handle
server.post('/api/messages', connector.listen());

var luisRecognizer = new builder.LuisRecognizer('https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/614b453b-ad7a-4435-b0ba-5f02b1645c19?subscription-key=5fdda394dde44e499305b06cfb23613a');
var intentDialog = new builder.IntentDialog({recognizers: [luisRecognizer]});


intentDialog.matches(/\b(hi|hello|hey|howdy)\b/i, '/sayHi')
.matches("getNews", '/topNews')
.onDefault(builder.DialogAction.send("Sorry, I didn't understand what you said."));

bot.dialog('/', intentDialog);

bot.dialog('/sayHi', function(session){
    session.send("hi there, try asking 'get me the news in singapore'");
    session.endDialog();
});

bot.dialog('/topNews', [
    function (session){
        // Ask the user which category they would like
        // Choices are separated by |
        builder.Prompts.choice(session, "Which category would you like?", "Technology|Science|Sports|Business|Entertainment|Politics|Health|World|(quit)");
    }, function (session, results, next){
        // The user chose a category
        if (results.response && results.response.entity !== '(quit)') {
           //Show user that we're processing their request by sending the typing indicator
            session.sendTyping();
            // Build the url we'll be calling to get top news
            var url = "https://api.cognitive.microsoft.com/bing/v5.0/news/?" 
                + "category=" + results.response.entity + "&count=10&mkt=en-US&originalImg=true";
            // Build options for the request
            var options = {
                uri: url,
                headers: {
                    'Ocp-Apim-Subscription-Key': BINGSEARCHKEY
                },
                json: true // Returns the response in json
            }
            //Make the call
            rp(options).then(function (body){
                // The request is successful
                sendTopNews(session, results, body); // Prints the body out to the console in json format
                session.send("Managed to get your news.");
            }).catch(function (err){
                // An error occurred and the request failed
                console.log(err.message);
                session.send("Argh, something went wrong. :( Try again?");
            }).finally(function () {
                // This is executed at the end, regardless of whether the request is successful or not
                session.endDialog();
            });
        } else {
            // The user choses to quit
            session.endDialog("Ok. Mission Aborted.");
        }
    }
]);

function sendTopNews(session, results, body){
    session.send("Top news in " + results.response.entity + ": ");
    //Show user that we're processing by sending the typing indicator
    session.sendTyping();
    // The value property in body contains an array of all the returned articles
    var allArticles = body.value;
    var cards = [];
    // Iterate through all 10 articles returned by the API
    for (var i = 0; i < 10; i++){
        var article = allArticles[i];
        // Create a card for the article and add it to the list of cards we want to send
        cards.push(new builder.HeroCard(session)
            .title(article.name)
            .subtitle(article.datePublished)
            .images([
                //handle if thumbnail is empty
                builder.CardImage.create(session, article.image.contentUrl)
            ])
            .buttons([
                // Pressing this button opens a url to the actual article
                builder.CardAction.openUrl(session, article.url, "Full article")
            ]));
    }
    var msg = new builder.Message(session)
        .textFormat(builder.TextFormat.xml)
        .attachmentLayout(builder.AttachmentLayout.carousel)
        .attachments(cards);
    session.send(msg);
}
//=========================================================
// Bots Dialogs
//=========================================================

// This is called the root dialog. It is the first point of entry for any message the bot receives
/*
bot.dialog('/', function (session) {
    // Send 'hello world' to the user
    session.send("Hello World, my name is bot");
});
*/