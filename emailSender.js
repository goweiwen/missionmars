const nodemailer = require('nodemailer');
const wellknown = require('nodemailer-wellknown');

let emailSender = {};

let transporter = nodemailer.createTransport({
    service: 'hotmail',
    auth: {
        user: 'marsbothol@outlook.com',
        pass: 'marsmission97'
    }
});

emailSender.sendEmail = function(recipientEmail, text, callback) {
    let mailOptions = {
        from: '"Mars Bot" <marsbothol@outlook.com>',
        to: recipientEmail,
        subject: 'Message from Mars',
        text: text
    }

    transporter.sendMail(mailOptions, (err, info) => {
        if (!err) {
            console.log('Message successfully sent: ' + info.response);
            callback(null);
        } else {
            console.log(err);
            callback(err);
        }
    });
}

module.exports = emailSender;
