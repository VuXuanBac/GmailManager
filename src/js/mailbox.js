class Mailbox {
    constructor(mailbox_table, modal,
        apicaller, batch_size) {
        this.maillist = mailbox_table;
        this.modal = modal;
        this.apicaller = apicaller;

        this.batch_size = batch_size;
        this.page_token = "";

        this.can_populate = true;
        this.compose = false;
        this.show = false;
        this.current_row = undefined;

        this.initialize = () => {
            this.apicaller.getUserInfo(false, (email_address, n_messages, n_threads) => {
                this.me = email_address;
                document.getElementById("user-address").innerHTML = `<b>${email_address}</b>`;
                document.getElementById("user-statistic").innerHTML = `<b>${n_messages}</b> Messages and <b>${n_threads}</b> Threads`;
            });
            this.populateBatch();
        };
        this.populateBatch = () => {
            if (!this.can_populate)
                return;
            this.can_populate = false;
            let items = [];
            let success_count = 0;
            let added_count = 0;
            this.apicaller.getMessageList(true, (message_list, next_page_token) => {
                for (let i = 0, length = message_list.length; i < length; ++i) {

                    let message_id = message_list[i].id;
                    let thread_id = message_list[i].threadId;

                    MailboxApi.getMessageBasicInfo(this.apicaller, message_id, this.me,
                        (result) => {
                            items[i] = this.maillist.createRow(result, {
                                messageId: message_id,
                                threadId: thread_id,
                                // index: i
                            });
                            // ===== Version 1: Add only when load all =====
                            // success_count++;
                            // if (success_count == batch_size) {
                            //     for (const item of items) {
                            //         this.maillist.appendRow(item);
                            //     }
                            // }

                            // ===== Version 2: Add when correct index =====
                            if (added_count == i) {
                                while (items[added_count] !== undefined) {
                                    this.maillist.appendRow(items[added_count]);
                                    added_count++;
                                }
                            }
                        });
                }
                this.page_token = next_page_token;
                this.can_populate = Boolean(next_page_token);
                //this.index += batch_size;
                // this.count += batch_size;
            }, this.batch_size, this.page_token);
        };
        this.showMessage = (element) => {
            let message_id = this.maillist.getRowState(element, "messageId");
            MailboxApi.getMessageFull(this.apicaller, message_id, this.me,
                (result) => {
                    this.modal.show(MODAL_READ_MODE, result);
                    this.show = true;
                });
            this.current_row = element;
        };
        this.endShowMessage = () => {
            this.modal.close();
            this.show = false;
            this.current_row = undefined;
        };
        this.startCompose = () => {
            this.compose = true;
            this.modal.show(MODAL_WRITE_MODE, { "From": this.me, "Attachment": [] });
        };
        this.sendMessage = () => {
            try {
                let input_message = this.modal.extract(); //Object.assign(this.current_show_data, this.modal.extract());
                alert("The message is pending...\nBased on your content, you may wait for a while.");
                MailboxApi.sendMessage(this.apicaller, input_message, MIMEType.TEXT,
                    (message_id, thread_id, labels) => {
                        alert("Send successfully");
                        MailboxApi.getMessageBasicInfo(this.apicaller, message_id, this.me,
                            (result) => {
                                this.maillist.insertFirstRow(this.maillist.createRow(result, {
                                    messageId: message_id,
                                    threadId: thread_id,
                                }));
                            });
                    });
                this.compose = false;
                this.modal.close();
            }
            catch (error) {
                alert(error.message);
                return;
            }
        };
        this.downloadAttachment = (index) => {
            let attachments = this.modal.getCurrentData("Attachment");
            if (attachments instanceof Array && attachments[index]) {
                let attach = attachments[index];
                if (attach.uri) {
                    MailboxUtils.download(attach.uri, attach.filename);
                }
                else {
                    MailboxApi.getAttachment(this.apicaller,
                        this.modal.getCurrentData("MessageId"), //this.current_show_data["MessageId"],
                        attach.attachment_id,
                        attach.mime_type,
                        (data_uri) => {
                            MailboxUtils.download(data_uri, attach.filename);
                            attach.uri = data_uri;
                        });
                }
            }
        };
        this.addAttachment = (attachments) => {
            this.modal.addData("Attachment", attachments);
        };
        this.removeAttachment = (index) => {
            let attachments = this.modal.getCurrentData("Attachment");
            attachments[index] = undefined;
        };
        this.trashMessage = (row) => {
            row = this.current_row || row;
            if (row) {
                let message_id = this.maillist.getRowState(row, "messageId");
                if (message_id) {
                    this.apicaller.trashMessage(true,
                        (result) => {
                            console.log("TRASH message ", result.id, " successfully");
                            //alert("Trash successfully");
                        }, message_id);
                    row.remove();
                }
            }
            if (this.current_row) {
                this.endShowMessage();
            }
        }
    }
}

class MailboxApi {
    static getMessageBasicInfo(apicaller, message_id, me, callback,
        address_parser = MailboxUtils.parseAddressGetBasic,
        date_parser = MailboxUtils.parseDateGetBasic) {
        let fields = ["From", "To", "Subject", "Date", "In-Reply-To"];
        //try {
        apicaller.getMessage(true, (message) => {
            if (message.payload && message.payload.headers) {
                let result = GmailHeader.parse(message.payload.headers, fields);
                if (address_parser) {
                    result["From"] = address_parser(result["From"], me);
                    result["To"] = address_parser(result["To"], me);
                }
                if (date_parser) {
                    result["Date"] = date_parser(result["Date"]);
                }
                if (callback) {
                    callback(result);
                }
            }
            else {
                console.log("[MAILBOX] Get Message fail with Invalid Format: ", (message));
            }
        }, message_id, "metadata", fields);
    }

    static getMessageFull(apicaller, message_id, me, callback,
        address_parser = MailboxUtils.parseAddressGetDetail,
        date_parser = MailboxUtils.parseDateGetDetail) {
        let fields = MIMEMessageHeader;
        apicaller.getMessage(true, (m) => {
            let message = new GmailMessage(m, fields);
            let result = message.header;
            result["MessageId"] = message_id;
            if (address_parser) {
                result["From"] = address_parser(result["From"], me);
                result["To"] = address_parser(result["To"], me);
                result["Cc"] = address_parser(result["Cc"], me);
                result["Bcc"] = address_parser(result["Bcc"], me);
            }
            if (date_parser) {
                result["Date"] = date_parser(result["Date"]);
            }
            result["Text"] = message.getText() || "";
            result["Attachment"] = message.getAttachments();
            result["Label"] = message.labels;
            if (callback) {
                callback(result);
            }
        }, message_id);
    }

    static getAttachment(apicaller, message_id, attachment_id, mime_type, callback) {
        apicaller.getAttachment(true, (size, body) => {
            let uri = `data:${mime_type};base64,${Base64Codec.unescape(body)}`;
            if (callback) {
                callback(uri);
            }
        }, message_id, attachment_id);
    }

    static sendMessage(apicaller, message, mime_type, callback) {
        let mime_message = MailboxUtils.createMIMEMessage(message, mime_type);
        apicaller.sendMessage(true, (message_id, thread_id, labels) => {
            if (callback) {
                callback(message_id, thread_id, labels);
            }
        }, Base64Codec.encode(mime_message));
    }
}

class MailboxUtils {
    static parseAddressGetBasic(address, me) {
        if (address.length > 0) {
            let addrs = GmailUtils.parseAddress(address);
            let title = "";
            let value = "";

            if (addrs.length == 1) {
                title = addrs[0].address;
                value = title == me ? "Me" : (addrs[0].name || /\b.*@/.exec(title) || title);
            }
            else {
                title = addrs.reduce((prev, a) => {
                    return prev + "\n" + a.address;
                }, "");
                value = `${addrs.length} accounts`;
            }
            return { value, title };
        }
        return "";// {value: "", title: ""};
    }

    static parseDateGetBasic(date) {
        let compare = "";
        date = new Date(Date.parse(date));
        let now = new Date(Date.now());
        if (date.getFullYear() == now.getFullYear()) {
            if (date.toDateString() != now.toDateString()) // date different
                compare = `${date.getDate()}/${date.getMonth() + 1}`;
            else
                compare = date.toTimeString().slice(0, 5);
        }
        else {
            compare = date.toLocaleDateString(LOCALE);
        }
        return { title: date.toLocaleString(LOCALE), value: compare };
    }

    static parseAddressGetDetail(address, me) {
        if (address.length > 0) {
            let addrs = GmailUtils.parseAddress(address);
            let title = "";
            let value = "";
            if (addrs.length == 1) {
                value = addrs[0].address;
                title = value == me ? "Me" : (addrs[0].name || value);
            }
            else {
                title = addrs.reduce((prev, a) => {
                    return prev + "\n" + a.address;
                }, "");
                value = addrs.length > 2 ? `${addrs.length} accounts` : address;
            }
            return { value, title };
        }
        return "";// {value: "", title: ""};
    }

    static parseDateGetDetail(date) {
        return new Date(Date.parse(date)).toLocaleString(LOCALE);
    }

    static createMIMEMessage(message, mime_type = MIMEType.TEXT) {
        let attachments = (message["Attachment"] || []);
        let text = message["Content"] || message["Text"] || ""; //message.toString();
        let result = MIMEMessage.createTextMessageWithSeparateAttachments(text, mime_type,
            message["Subject"] || "",
            ...attachments
        );
        if ("To" in message) {
            result.addRecipient(MIMEHeaderName.TO,
                ...GmailUtils.parseAddress(message["To"]).map(a => a.address));
        }
        if ("Cc" in message) {
            result.addRecipient(MIMEHeaderName.CC,
                ...GmailUtils.parseAddress(message["Cc"]).map(a => a.address));
        }
        if ("Bcc" in message) {
            result.addRecipient(MIMEHeaderName.BCC,
                ...GmailUtils.parseAddress(message["Bcc"]).map(a => a.address));
        }
        return result.stringify();
    }

    static download(uri, file_name) {
        let temp_ele = document.createElement("a");
        temp_ele.download = file_name;
        temp_ele.href = uri;
        document.body.appendChild(temp_ele);
        temp_ele.click();
        document.body.removeChild(temp_ele);
        temp_ele.remove();
    }
}