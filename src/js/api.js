// ============== Require: request.js ==============
class GmailAPI {
    constructor(access_token, api_key, failure_callback) {
        this.access_token = access_token;
        this.api_key = api_key;
        /// Callback accept 3 arguments: 
        /// - Account Email Address
        /// - Number of Messages
        /// - Number of Threads
        this.getUserInfo = (async, callback) => {
            let url = 'https://gmail.googleapis.com/gmail/v1/users/me/profile';
            //let url = `https://content-gmail.googleapis.com/gmail/v1/users/me/profile?alt=json&key=` + this.api_key;
            Request.withAjax('GET', async, url, this.access_token, (response) => {
                callback(response['emailAddress'], response['messagesTotal'], response['threadsTotal'])
            }, failure_callback);
        };
        this.getMessageList = (async, callback, batch = undefined, page_token = undefined, labels = undefined) => {
            let url = 'https://gmail.googleapis.com/gmail/v1/users/me/messages';
            //let url = `https://content-gmail.googleapis.com/gmail/v1/users/me/messages?alt=json&key=` + this.api_key;
            let params = new URLSearchParams();
            if (batch)
                params.append('maxResults', batch);
            if (page_token)
                params.append('pageToken', page_token);
            if (labels && labels instanceof Array)
                labels.forEach(label => params.append('labelIds', label));

            Request.withAjax('GET', async, url, this.access_token, (response) => {
                callback(response['messages'], response['nextPageToken'])
            }, failure_callback, params);
        };
        this.getMessage = (async, callback, message_id, format = undefined, header_fields = undefined) => {
            let url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message_id}`;
            //let url = `https://content-gmail.googleapis.com/gmail/v1/users/me/messages/${message_id}?alt=json&key=` + this.api_key;
            let params = undefined;
            if (format) {
                format = format.toLowerCase();
                params = new URLSearchParams();
                params.append("format", format);
                if (format == "metadata" && header_fields && header_fields instanceof Array) {
                    header_fields.forEach(field => params.append("metadataHeaders", field));
                }
            }

            Request.withAjax('GET', async, url, this.access_token, callback, failure_callback, params);
        };

        this.getAttachment = (async, callback, message_id, attachment_id) => {
            let url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message_id}/attachments/${attachment_id}`;
            //let url = `https://content-gmail.googleapis.com/gmail/v1/users/me/messages/${message_id}/attachments/${attachment_id}?alt=json&key=` + this.api_key;
            Request.withAjax('GET', async, url, this.access_token, (result) => {
                callback(result["size"], result["data"])
            }, failure_callback);
        };

        this.sendMessage = (async, callback, based64_mime_message) => {
            //let url = `https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send`;
            let url = `https://content-gmail.googleapis.com/gmail/v1/users/me/messages/send?alt=json&key=` + this.api_key;
            Request.withAjax('POST', async, url, this.access_token, (result) => {
                callback(result["id"], result["threadId"], result["labelIds"])
            }, failure_callback, undefined, JSON.stringify({ "raw": based64_mime_message }));
        };

        this.trashMessage = (async, callback, message_id) => {
            //let url = `https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send`;
            let url = `https://content-gmail.googleapis.com/gmail/v1/users/me/messages/${message_id}/trash?alt=json&key=` + this.api_key;
            Request.withAjax('POST', async, url, this.access_token, callback, failure_callback, undefined, "");
        }
    }
}
