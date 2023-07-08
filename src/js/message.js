// ============== Require mime.js, base64.js ===============
const BASIC_HEADER_FIELDS = Object.values(MIMEHeaderName);

const GmailUtils = {
    parseOneAddress(value) {
        // VD1: `Name With Space <address@gmail.com>`
        // VD2: `"Name With Quote" <address@gmail.com>`
        // VD3: `<address@gmail.com>`
        // VD4: `address@gmail.com.
        let result = /\b[<"]?([^<>"]*[^<>"\s])[">]?\s*<?([^<>]*)>?\b/g.exec(value);
        if (!result) {
            console.log(`[MESSAGE] Parse Address fail with value: ${value}`);
            return { name: "", address: "" };
        }
        if (result[2]) {
            return { name: result[1], address: result[2] };
        }
        return { name: "", address: result[1] };
    },
    parseAddress(value) {
        let splits = value.split(",");
        let result = [];
        for (const v of splits) {
            if (v.trim()) {
                result.push(this.parseOneAddress(v));
            }
        }
        return result;
    },
}

class GmailHeader {
    static parse(headers, fields = BASIC_HEADER_FIELDS) {
        let temp = {};
        headers.forEach(h => {
            temp[h.name] = h.value;
        });
        let result = {};
        fields.forEach(f => {
            result[f] = (temp[f] || "");
        });
        return result;
    }
}

class GmailAttachmentContent extends MIMEAttachment {
    constructor(mime_type, attachment_id, size, filename, uri) {
        super(uri, filename);
        this.mime_type = mime_type;
        this.attachment_id = attachment_id;
        this.size = size;
    }
    static fromUriAndFile(data_uri, file_object) {
        return new GmailAttachmentContent(file_object.type, "", file_object.size, file_object.name, data_uri);
    }
}

class GmailTextContent {
    constructor(mime_type, content) {
        this.mime_type = mime_type;
        this.text = content;
        // this.size= size;
    }
}

class GmailMultiContent {
    constructor(mime_type) {
        this.mime_type = mime_type;
        this.text = [];
        this.attachment = [];
        this.addContent = (content) => {
            if (content instanceof GmailMultiContent) {
                this.text = this.text.concat(content.text);
                this.attachment = this.attachment.concat(content.attachment);
            }
            else if (content instanceof GmailTextContent) {
                this.text.push(content);
            }
            else if (content instanceof GmailAttachmentContent) {
                this.attachment.push(content);
            }
            else {
                console.log("[MESSAGE] Add content fail with Invalid subPart Content: ", content);
            }
        };
    }
}

class GmailMessage {
    constructor(data, header_fields) {
        this.message_id = data.id;
        this.thread_id = data.threadId;
        this.labels = data.labelIds;
        this.snippet = data.snippet;

        let payload = data.payload;
        this.header = GmailHeader.parse(payload.headers, header_fields);

        this.body = GmailMessage.parseContent(payload);

        this.getText = (mime_type) => {
            if (this.body instanceof GmailTextContent) {
                return this.body.text.toString();
            }
            else if (this.body instanceof GmailMultiContent) {
                for (const text of this.body.text) {
                    if (text.mime_type == mime_type)
                        return text.text.toString();
                }
                return this.body.text[0].text.toString();
            }
        };
        this.getAttachments = () => {
            if (this.body instanceof GmailAttachmentContent) {
                return [this.body];
            }
            else if (this.body instanceof GmailMultiContent) {
                return this.body.attachment;
            }
            return [];
        }
    }
    static parseContent(payload) {
        let mime_type = payload.mimeType;
        let filename = payload.filename;
        if (mime_type.startsWith("multipart/") ||
            mime_type.startsWith("message/")) {
            let content = new GmailMultiContent(mime_type);
            payload.parts.forEach(p => {
                content.addContent(GmailMessage.parseContent(p));
            });
            return content;
        }
        else {
            if ("attachmentId" in payload.body) {
                return new GmailAttachmentContent(mime_type, payload.body.attachmentId, payload.body.size, filename);
            }
            else if ("data" in payload.body && mime_type.startsWith("text/")) {
                return new GmailTextContent(mime_type, Base64Codec.decodeUrl(payload.body.data));
            }
            else {
                console.log("[MESSAGE] Parse Message fail with Unexpected Message Format: ", payload.mime_type, payload);
            }
        }
    }
}