//imported packages:
/*1.googleapis: This package is imported from the googleapis module and provides the necessary functionality to interact with various Google APIs, including the Gmail API.
  2.OAuth2: The OAuth2 class from the google.auth module is used to authenticate the application. It handles token refresh and retrying requests if necessary.*/

const { google } = require("googleapis");
const express = require("express");

const app = express();
const port = 3000;

/* 
1. Project Setup: Obtained the necessary credentials (client ID, client secret, and redirect URI) 
   by creating a project on the Google Cloud Console: https://console.developers.google.com. 

2. Authorization Process: Generated a refresh token by using the OAuth Playground: 
   https://developers.google.com/oauthplayground. Authorized the 'https://mail.google.com' 
   scope API, providing the client ID and client secret. Captured the generated authorization code.

3. Token Exchange: Exchanged the obtained authorization code for a refresh token by following 
   the appropriate steps. This step is crucial for secure and continuous access.

4. Credential Management: Imported the obtained credentials into the application using the 
   'secret.js' file. This ensures proper authentication when interacting with the Gmail API.
*/

  const {
    CLIENT_ID,
    CLEINT_SECRET,
    REDIRECT_URI,
    REFRESH_TOKEN,
  } = require("./secret");
  
 
//Implemented Google Login
  const oAuth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLEINT_SECRET,
    REDIRECT_URI
  );
  oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

  // Generate the consent URL
const consentUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: 'https://www.googleapis.com/auth/gmail.modify', // Add the necessary scope(s)
  });
  
    
 
    //Ensured Single Replies.
  const repliedUsers = new Set();
  
  //Step 1. check for new emails and sends replies .
  async function checkEmailsAndSendReplies() {
    try {
      const gmail = google.gmail({ version: "v1", auth: oAuth2Client });
  
      // Get the list of unread messages.
      const res = await gmail.users.messages.list({
        userId: "me",
        q: "is:unread",
      });
      const messages = res.data.messages;
  
      if (messages && messages.length > 0) {
        // Fetch the complete message details.
        for (const message of messages) {
          const email = await gmail.users.messages.get({
            userId: "me",
            id: message.id,
          });
          const from = email.data.payload.headers.find(
            (header) => header.name === "From"
          );
          const toHeader = email.data.payload.headers.find(
            (header) => header.name === "To"
          );
          const Subject = email.data.payload.headers.find(
            (header) => header.name === "Subject"
          );
          //who sends email extracted
          const From = from.value;
          //who gets email extracted
          const toEmail = toHeader.value;
          //subject of unread email
          const subject = Subject.value;
          console.log("email come From", From);
          console.log("to Email", toEmail);
          //check if the user already been replied to
          if (repliedUsers.has(From)) {
            console.log("Already replied to : ", From);
            continue;
          }
          // 2.send replies to Emails that have no prior replies
          // Check if the email has any replies.
          const thread = await gmail.users.threads.get({
            userId: "me",
            id: message.threadId,
          });
  
          //isolated the email into threads
          const replies = thread.data.messages.slice(1);
  
          if (replies.length === 0) {
            // Reply to the email.
            await gmail.users.messages.send({
              userId: "me",
              requestBody: {
                raw: await createReplyRaw(toEmail, From, subject),
              },
            });
  
            // Add a label to the email.
            const labelName = "onVacation";
            await gmail.users.messages.modify({
              userId: "me",
              id: message.id,
              requestBody: {
                addLabelIds: [await createLabelIfNeeded(labelName)],
              },
            });
  
            console.log("Sent reply to email:", From);
            //Add the user to replied users set
            repliedUsers.add(From);
          }
        }
      }
    } catch (error) {
      console.error("Error occurred:", error);
    }
  }
  
// Base64 Conversion Function:
async function createReplyRaw(from, to, subject) {
    const emailContent = `From: ${from}\nTo: ${to}\nSubject: ${subject}\n\nThank you for your message. i am  unavailable right now, but will respond as soon as possible...`;
    const base64EncodedEmail = Buffer.from(emailContent)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  
    return base64EncodedEmail;
  }
  
  // 3.add a Label to the email and move the email to the label
  async function createLabelIfNeeded(labelName) {
    const gmail = google.gmail({ version: "v1", auth: oAuth2Client });
    // Check if the label already exists.
    const res = await gmail.users.labels.list({ userId: "me" });
    const labels = res.data.labels;
  
    const existingLabel = labels.find((label) => label.name === labelName);
    if (existingLabel) {
      return existingLabel.id;
    }
  
    // Create the label if it doesn't exist.
    const newLabel = await gmail.users.labels.create({
      userId: "me",
      requestBody: {
        name: labelName,
        labelListVisibility: "labelShow",
        messageListVisibility: "show",
      },
    });
  
    return newLabel.data.id;
  }
  
  /*4.repeat this sequence of steps 1-3 in random intervals of 45 to 120 seconds*/
  function getRandomInterval(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
  }
  
app.get('/', (req, res) => {
    res.send(`Visit <a href="${consentUrl}">this link</a> to authorize the app.`);
  });
  
  // Route to trigger email check and replies
  app.get("/check-emails", async (req, res) => {
    await checkEmailsAndSendReplies();
    res.send("Email check completed!");
  });
  
  // Start the Express server
  app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
  });
  
  // Setting Interval and calling the main function in every interval
  setInterval(() => {
    checkEmailsAndSendReplies();
  }, getRandomInterval(45, 120) * 1000);
  
 