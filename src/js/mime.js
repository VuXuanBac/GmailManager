// ========== Require: base64.js =============

const MIME_LINE_BREAK = "\r\n"; // CRLF
const MIME_LINE_LIMIT = 78;
const MIMEHeaderName = {
    TO: "To",
    FROM: "From",
    CC: "Cc",
    BCC: "Bcc",
    SUBJECT: "Subject",
    DATE: "Date",
    // MESSAGE_ID: "Message-Id",
    IN_REPLY_TO: "In-Reply-To",
    // REPLY_TO: "Reply-To",
    MIME_VERSION: "MIME-Version",
    CONTENT_TYPE: "Content-Type",
    CONTENT_TRANSFER_ENCODING: "Content-Transfer-Encoding",
    CONTENT_ID: "Content-Id",
    CONTENT_LOCATION: "Content-Location",
    CONTENT_DISPOSITION: "Content-Disposition"
};

const MIMEMessageHeader = ["From", "To", "Cc", "Bcc", "Subject", "Date", "In-Reply-To"];
const MIMEContentHeader = ["Content-Type", "Content-Transfer-Encoding", "Content-Id", "Content-Location", "Content-Disposition"];

const MIMEType = {
    // All text/ requires `charset`: us-ascii, utf-8,...
    // All multipart/ requires `boundary`.
    TEXT: "text/plain",
    HTML: "text/html",
    MUL_MIXED: "multipart/mixed",
    MUL_ALTERNATIVE: "multipart/alternative",
    MUL_RELATED: "multipart/related",
    MUL_PARALLEL: "multipart/parallel",
    JPEG: "image/jpeg",
    GIF: "image/gif",
    MPEG: "video/mpeg",
    AUDIO: "audio/basic",
    PDF: "application/pdf"
};

const MIMEEncoding = {
    BASE64: "base64",
    QUOTED_PRINTABLE: "quoted-printable",
    _7BIT: "7bit", // default
    _8BIT: "8bit",
    BINARY: "binary"
};

// =========== Structure ===========
// A [Message] is a [Part]
// A [Part] has a [Header] and a [Body]
// If [Part].[Header].Content-Type is not Multipart
//  - [Body] is Data.
// Else:
//  - [Body] is a list of [Part].

class MIMEAttachment {
    constructor(data_uri, file_name) {
        this.uri = data_uri;
        this.filename = file_name;
    }
}

class MIMEMessage {
    static createTextMessage(text, mime_type, subject) {
        return new MIMEPart()
            .setMIMEVersion()
            .setSubject(subject)
            .setTextContent(text, mime_type);
    }
    static createTextMessageWithSeparateAttachments(text, mime_type, subject, ...attachments) {
        /// one attachment must is a MIMEAttachment.
        if (attachments.length == 0) {
            return MIMEMessage.createTextMessage(text, mime_type, subject);
        }
        let sub_parts = [new MIMEPart().setTextContent(text, mime_type)];
        let temp_attachments = [];
        for (const a of attachments) {
            if (a instanceof MIMEAttachment) {
                temp_attachments.push(a);
            }
        }
        sub_parts.push(...(temp_attachments.map(attachment => new MIMEPart().setAttachmentContent(attachment))));
        return new MIMEPart()
            .setMIMEVersion()
            .setSubject(subject)
            .setMultipartContent(MIMEType.MUL_MIXED)
            .addContent(sub_parts);
    }
    static createMessage(content, subject) {
        if (content instanceof MIMEPart) {
            return content.setMIMEVersion()
                .setSubject(subject)
        }
        return MIMEMessage.createTextMessage(content.toString(), MIMEType.TEXT, subject);
    }
}

class MIMEPart {
    constructor() {
        this.header = new MIMEHeader();
        this.body = "";
        this.addRecipient = (type, ...addresses) => {
            if (addresses.length > 0)
                this.header.addItems(type, addresses);
            return this;
        };
        this.setMIMEVersion = (version = "1.0") => {
            this.header.setEntry(MIMEHeaderName.MIME_VERSION, version);
            return this;
        };
        this.setSubject = (subject) => {
            this.header.setEntry(MIMEHeaderName.SUBJECT, subject);
            return this;
        };
        this.setReplyTo = (message_id) => {
            this.header.setEntry(MIMEHeaderName.IN_REPLY_TO, message_id);
            return this;
        };
        this.setAttachmentContent = (attachment) => {
            // data:[mime_type][;base64],[content]
            // mime_type: default = text/plain
            // base64: missing => content is URL Encoded.
            if (!(attachment instanceof MIMEAttachment)) {
                console.log("[MIME] Add Attachment fail because of Invalid Attachment Format: ", (attachment));
                return this;
            }

            let file_name = attachment.filename;
            let uri = MIMEUtils.parseUri(attachment.uri);
            let content = uri.encoded_content;
            if (uri.encoding) { // if encoding is base64
                this.header.setEntry(MIMEHeaderName.CONTENT_TRANSFER_ENCODING, MIMEEncoding.BASE64);
            }
            else {
                content = decodeURIComponent(content);
            }

            let standard_file_name = MIMEUtils.wordEncode(file_name);
            this.body = content;
            this.header.setEntry(MIMEHeaderName.CONTENT_TYPE, uri.mime_type);
            this.header.setEntry(MIMEHeaderName.CONTENT_DISPOSITION, "attachment");
            this.header.setEntry(MIMEHeaderName.CONTENT_ID, `<${Base64Codec.encode(file_name)}-${Date.now()}>`)
            this.header.setParams(MIMEHeaderName.CONTENT_TYPE, { "name": '"' + standard_file_name + '"' });
            this.header.setParams(MIMEHeaderName.CONTENT_DISPOSITION, { "filename": '"' + standard_file_name + '"' });
            return this;
        };
        this.setTextContent = (content, mime_type) => {
            /// Use this for text/ content only
            mime_type = mime_type.toLowerCase();
            if (mime_type.startsWith("text/") && Object.values(MIMEType).includes(mime_type)) {
                if (!MIMEUtils.isASCII(content)) { // contains non-ascii characters
                    // If mostly content is ascii, use quoted-printable instead
                    // For simply, we use base64 for all case.
                    this.body = Base64Codec.encode(content);
                    this.header.setParams(MIMEHeaderName.CONTENT_TYPE, { "charset": "utf-8" });
                    this.header.setEntry(MIMEHeaderName.CONTENT_TRANSFER_ENCODING, MIMEEncoding.BASE64);
                }
                else {
                    this.body = content;
                }

                this.header.setEntry(MIMEHeaderName.CONTENT_TYPE, mime_type);
            }
            else {
                console.log("[MIME] Invalid MIME Type for Text: " + mime_type);
            }

            return this;
        };
        this.setMultipartContent = (mime_type, boundary = null) => {
            mime_type = mime_type.toLowerCase();
            if (mime_type.startsWith("multipart/") && Object.values(MIMEType).includes(mime_type)) {
                if (!boundary)
                    boundary = MIMEUtils.generateBoundary();
                this.header.setParams(MIMEHeaderName.CONTENT_TYPE, { "boundary": boundary });
                this.body = [];

                this.header.setEntry(MIMEHeaderName.CONTENT_TYPE, mime_type);

            }
            else {
                console.log("[MIME] Invalid MIME Type for Multipart: " + mime_type);
            }

            return this;
        };
        this.addContent = (parts) => {
            if (!this.header.get(MIMEHeaderName.CONTENT_TYPE).startsWith("multipart/")) {
                console.log("[MIME] Add content fail because of Non-Multipart Content. Call `setMultipartContent` first.");
                return this;
            }
            if (!(parts instanceof Array))
                parts = [parts];
            for (const part of parts) {
                if (!(part instanceof MIMEPart)) {
                    console.log("[MIME] Add Content fail because of Invalid Subcontent Format.");
                }
            }
            this.body.push(...parts);
            return this;
        };
        this.stringify = () => {
            let _header = this.header.stringify();
            let _body = "";
            if (this.body instanceof Array) {
                let params = this.header.getParams(MIMEHeaderName.CONTENT_TYPE);
                let boundary = "";
                if ("boundary" in params) {
                    boundary = params.boundary;
                }
                else {
                    console.log("[MIME] Stringify fail because the Multipart content does not specify `boundary`.");
                }
                _body = this.body.reduce((prev, cur) => {
                    return `${prev}--${boundary}${MIME_LINE_BREAK}${cur.stringify()}${MIME_LINE_BREAK}`;
                }, "") + `--${boundary}--`;
            }
            else {
                _body = MIMEUtils.chunk(this.body ? this.body : "", 76).join(MIME_LINE_BREAK); // choose that divisible by 4
            }
            return _header + MIME_LINE_BREAK + _body;
        };
    }
}

class MIMEHeader {
    constructor() {
        this.data = {
            "To": [],
            "Cc": [],
            "Bcc": []
        };
        this.params = {
            // "Content-Type": {},
        };
        this.get = (key) => this.data[key];
        this.getParams = (key) => this.params[key];

        this.setParams = (key, params) => {
            this.params[key] = params;
        }
        this.setEntry = (key, value) => {
            this.data[key] = value;
        }
        this.addItems = (key, items) => {
            this.data[key].push(...items);
        }
        this.stringify = () => {
            return Object.entries(this.data).reduce(
                (prev, cur) => {
                    let parse_cur = MIMEHeader.stringifyField(cur[0], cur[1], this.params[cur[0]]);
                    if (parse_cur)
                        return prev + parse_cur + MIME_LINE_BREAK;
                    else
                        return prev;
                }
                , "");
        }
    }
    static stringifyField(key, value, params) {
        let data = "";
        if (value instanceof Array) {
            if (value.length > 0) {
                data = value.join("," + MIME_LINE_BREAK + " ".repeat(key.length + 2));
            }
            else {
                return "";
            }
        }
        else {
            data = MIMEUtils.wordEncode(value); // chunk cut also
        }

        if (params) {
            data = Object.entries(params).reduce((prev, cur) => `${prev};${MIME_LINE_BREAK}${" ".repeat(key.length + 2)}${cur[0]}=${cur[1]}`, data);
        }
        return `${key}: ${data}`;
    }
}

const MIMEUtils = {
    parseUri(data_uri) {
        let temp = /(?<=data:)([^;]*);?(.*)(?=,)/g.exec(data_uri);
        let encoding = temp && temp[2] ? MIMEEncoding.BASE64 : "";
        let mime_type = (temp && temp[1]) || MIMEType.TEXT;
        if (!temp) {
            console.log("[MIME] Parse URI fail with Invalid Format: " + data_uri);
            return;
        }
        let encoded_content = temp ? data_uri.slice(temp.index + temp[0].length + 1) : data_uri;
        return { encoded_content, mime_type, encoding };
    },
    isASCII(str) {
        return /^[\x00-\x7F]*$/.test(str);
    },
    // base64Encode(str) {
    //     return window.btoa(unescape(encodeURIComponent(str)));
    // },
    // base64Decode(str) {
    //     return decodeURIComponent(escape(window.atob(str)));
    // },
    // base64UrlEncode(str) {
    //     return window.btoa(unescape(encodeURIComponent(str.replace(/-/g, '+').replace(/_/g, '/'))));
    // },
    // base64UrlDecode(str) {
    //     return decodeURIComponent(escape(window.atob(str))).replace(/\+/g, '-').replace(/\//g, '_');
    // },
    wordEncode(str) {
        if (/^[\x00-\x7F]*$/.test(str)) { // is all ascii
            return str;
        }
        else {
            // =?UTF-8?B?<data>?=
            let charset = "UTF-8";
            let encoding = "B"; // Base64 (B) or Quoted Printable (Q)
            let data = Base64Codec.encode(str);
            return this.chunk(data, 64).map((value) => `=?${charset}?${encoding}?${value}?=`).join(MIME_LINE_BREAK + " ");
        }
    },
    chunk(str, size) {
        const numChunks = Math.ceil(str.length / size)
        const chunks = new Array(numChunks)

        for (let i = 0, o = 0; i < numChunks; ++i, o += size) {
            chunks[i] = str.substr(o, size)
        }

        return chunks
    },
    generateBoundary() {
        return `----=Part#${Math.random().toString(16).slice(2)}=`;
    },
}

// function generateBoundary() {
//     return `----=Part#${Date.now()}=`;
// }
// function chunk(str, size) {
//     const numChunks = Math.ceil(str.length / size)
//     const chunks = new Array(numChunks)

//     for (let i = 0, o = 0; i < numChunks; ++i, o += size) {
//         chunks[i] = str.substr(o, size)
//     }

//     return chunks
// }
// function wordEncode(str) {
//     if (/^[\x00-\x7F]*$/.test(str)) { // is all ascii
//         return str;
//     }
//     else {
//         // =?UTF-8?B?<data>?=
//         let charset = "UTF-8";
//         let encoding = "B"; // Base64 (B) or Quoted Printable (Q)
//         let data = base64Encode(str);
//         return chunk(data, 72 - 6 - charset.length - encoding.length).map((value) => `=?${charset}?${encoding}?${value}?=`).join(MIME_ + " ");
//     }
// }
// function base64Encode(str) {
//     return window.btoa(unescape(encodeURIComponent(str)));
// }

// function base64Decode(str) {
//     return decodeURIComponent(escape(window.atob(str)));
// }

// function base64UrlEncode(str) {
//     return window.btoa(unescape(encodeURIComponent(str.replace(/-/g, '+').replace(/_/g, '/'))));
// }

// function base64Decode(str) {
//     return decodeURIComponent(escape(window.atob(str))).replace(/\+/g, '-').replace(/\//g, '_');
// }

