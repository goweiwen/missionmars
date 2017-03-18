const restify = require('restify');
const builder = require('botbuilder');
const rp = require('request-promise');
const emailSender = require('./emailSender');

const LUIS_URL = 'https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/ff2282cd-9686-45b9-9c40-e503cedab909?subscription-key=eb8957b8eec544169009c80455c6371d&verbose=true';
const BING_SEARCH_KEY = 'cff0a8196c6446bb8cc2c7859b6a0e27';
const BING_CV_KEY = 'd0c9f9d4189d4ee59a99cd10b39afb3a';

let server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, () =>
    console.log("%s listening to %s", server.name, server.url));

let connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});

let bot = new builder.UniversalBot(connector);

server.post('/api/messages', connector.listen());

// LUIS
let luisRecognizer = new builder.LuisRecognizer(LUIS_URL);

let intentDialog = new builder.IntentDialog({recognizers: [luisRecognizer]});

intentDialog
    .matches(/\b(hi|hello|hey|howdy)\b/i, '/sayHi')
    .matches('GetNews', '/topNews')
    .matches('AnalyseImage', '/analyseImage')
    .matches('SendEmail', '/sendEmail')
    .onDefault(builder.DialogAction.send("Sorry, I didn't understand what you said."));

bot.dialog('/', intentDialog);

bot.dialog('/sayHi', session => {
    session.send("Hi there! Try saying things like \"Get news in Tokyo\"");
    session.endDialog();
});

bot.dialog('/topNews', [
    session => builder.Prompts.choice(session, "Which category would you like?",
        "Technology|Science|Sports|Business|Entertainment|Politics|Health|World|(quit)"),
    (session, results) => {
        let userResponse = results.response.entity;
        if (results.response && results.response.entity !== '(quit)') {
            session.sendTyping();
            let url = 'https://api.cognitive.microsoft.com/bing/v5.0/news/?category=' +
                results.response.entity + '&count=10&mkt=en-US&originalImg=true';
            let options = {
                uri: url,
                headers: {
                    'Ocp-Apim-Subscription-Key': BING_SEARCH_KEY
                },
                json: true
            };
            rp(options).then(body => {
                console.log(body);
                sendTopNews(session, results, body);
            }).catch(err => {
                console.log(err.message);
                session.send("Argh, something went wrong. :( Try again?");
            });
        } else {
            session.endDialog("Ok. Mission Aborted.");
        }
    }
]);

function sendTopNews(session, results, body) {
    session.send("Top news in " + results.response.entity + ": ");
    session.sendTyping();
    let allArticles = body.value;
    let cards = [];
    for (let i = 0; i < 10; i++) {
        let article = allArticles[i];
        cards.push(new builder.HeroCard(session)
            .title(article.name)
            .subtitle(article.datePublished)
            .images([
                builder.CardImage.create(session, article.image.contentUrl)
            ])
            .buttons([
                builder.CardAction.openUrl(session, article.url, "Full article")
            ]));
    }
    let msg = new builder.Message(session)
        .textFormat(builder.TextFormat.xml)
        .attachmentLayout(builder.AttachmentLayout.carousel)
        .attachments(cards);
    session.send(msg);
}

bot.dialog('/analyseImage', [
    session => builder.Prompts.text(session, "Send me an image link of it, please."),
    (session, results) => {
        let options = {
            method: 'POST',
            uri: 'https://westus.api.cognitive.microsoft.com/vision/v1.0/describe?maxCandidates=1',
            headers: {
                'Ocp-Apim-Subscription-Key': BING_CV_KEY,
                'Content-Type': 'application/json'
            },
            body: {
                url: results.response
            },
            json: true
        }
        rp(options).then(body => {
            session.send("I think it's " + body.description.captions[0].text)
        }).catch(err => {
            console.log(err.message);
            session.send("Argh, something went wrong. :( Try again?");
        }).finally(() => session.endDialog());
    }
]);

let emailAddress = '';
bot.dialog('/sendEmail', [
    session => builder.Prompts.text(session, "I can send an email to your team member on Earth, what's his/her address?"),
    (session, results) => {
        emailAddress = results.response;
        builder.Prompts.text(session, "What do you want to tell him/her?");
    },
    (session, results) => {
        emailSender.sendEmail(emailAddress, results.response, err => console.log(err));
        session.send("Sent!");
    }
]);
