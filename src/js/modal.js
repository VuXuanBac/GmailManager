const MODAL_READ_MODE = "read";
const MODAL_WRITE_MODE = "write";
class Modal {
    constructor(modal_element, field_ids, show_initializer, data_populator, data_updater) {
        this.modal = modal_element;
        this.field_ids = field_ids;
        this.current_data = undefined;
        this.current_mode = undefined;
        this.close = () => {
            this.modal.style.display = "none"; // update on html element

            this.current_data = undefined;
            this.current_mode = undefined;
        };

        this.show = (mode, data) => {

            if (show_initializer)
                show_initializer(this, mode);

            this.modal.style.display = "block"; // update on html element => use css
            this.current_data = data;
            this.current_mode = mode;

            if (data_populator)
                data_populator(this, mode, data);
        };

        this.addData = (key, data) => {
            if (this.current_data) {
                if (data instanceof Array)
                    this.current_data[key].push(...data);
                else
                    this.current_data[key].push(data);
                if (data_updater)
                    data_updater(this, this.mode, { [key]: data }, "add");
            }
        };
        this.setData = (key, data) => {
            if (this.current_data) {
                this.current_data[key] = data;
                if (data_updater)
                    data_updater(this, this.mode, { [key]: data }, "set");
            }
        };

        this.getCurrentData = (key) => {
            if (this.current_data && key) {
                return this.current_data[key];
            }
            return this.current_data; // if current_data is null or key is null.
        };

        this.extract = () => {
            let result = {};
            for (const id of this.field_ids) {
                let element = this.modal.querySelector("#" + id);
                let key_in_data = this.getAttribute("#" + id, "name", "data-name", "id");
                if (element.nodeName == "INPUT" || element.nodeName == "TEXTAREA") {
                    result[key_in_data] = element.value;
                    if (element.required && !element.value) {
                        throw Error("Require Field: " + key_in_data);
                    }
                }
                else {
                    result[key_in_data] = element.innerHTML;
                }
            }
            return Object.assign(result, this.current_data);
        };

        this.getElement = (element_query) => {
            return this.modal.querySelector(element_query);
        };

        this.setContent = (element_query, content, title, is_readonly = false, is_display = true) => {
            let element = this.modal.querySelector(element_query);
            if (element) {
                if (element.nodeName == "INPUT" || element.nodeName == "TEXTAREA") {
                    element.value = content || "";
                    element.parentElement.style.display = is_display ? "" : "none";
                }
                else {
                    element.innerHTML = content || "";
                    element.style.display = is_display ? "" : "none";
                }

                element.title = title || "";

                if (is_readonly)
                    element.setAttribute("readonly", "");
                else
                    element.removeAttribute("readonly");
            }
        };

        this.addContent = (element_query, content_html, position = "beforeend") => {
            let container = this.modal.querySelector(element_query);
            if (container)
                container.insertAdjacentHTML(position, content_html);
        };

        this.getAttribute = (element_query, ...attributes) => {
            let element = this.modal.querySelector(element_query);
            let result = undefined;

            if (element) {
                for (const attr of attributes) {
                    result = element.getAttribute(attr);
                    if (result) {
                        return result;
                    }
                }
            }
            return result;
        };
    }
}

function initializeModal(modal_manager, mode) {
    // modal_manager.getElement().replaceChildren();
    //let button_container = modal_manager.getElement('#modal-btn-container');
    if (mode == MODAL_READ_MODE) {
        // ====== Control Buttons =======
        modal_manager.setContent('#modal-btn-container',
            `<li class="btn btn-icon" title="Reply" id="btn-reply" style="color: green;"><i class="fa-solid fa-reply"></i></li>
             <li class="btn btn-icon" title="Move to Trash" id="btn-trash" style="color: red;"><i class="fa-solid fa-trash"></i></li>
             <li class="split-flex"></li>
             <li class="" data-name="Date" id="mail-date"></li>`
        );
    }
    else {
        // ====== Control Buttons =======
        modal_manager.setContent('#modal-btn-container',
            `<li class="btn btn-round" id="btn-send">Send</li>
             <li class="btn btn-icon" title="Attach" id="btn-attach" style="color: black;"><i class="fa-solid fa-link"></i></li>
             <li class="split-flex"></li>
             <li class="" data-name="Date" id="mail-date"></li>`
        );
    }
    modal_manager.field_ids.forEach((id) => {
        modal_manager.setContent("#" + id);
    });

    modal_manager.setContent("#modal-attachment-container");
    modal_manager.setContent("#modal-labels-container");
}

function populateDataToModal(modal_manager, mode, data) {
    if (mode == MODAL_READ_MODE) {
        // Populate Input
        for (const id of modal_manager.field_ids) {
            let key_in_data = modal_manager.getAttribute("#" + id, "name", "data-name", "id");
            if (key_in_data in data) {
                let d = data[key_in_data];
                let value = d.value || d.toString();
                let title = key_in_data === "Text" ? "" : (d.title || value);

                modal_manager.setContent("#" + id, value, title, true, value.length > 0);
            }
        };

        // Populate Labels
        // Populate Attachments
        updateDataToModal(modal_manager, mode, data, "set");

        // Change style
        let mail_content = modal_manager.getElement("#mail-content");
        mail_content.style.height = "auto";
        mail_content.style.height = mail_content.scrollHeight + "px";
    }
    else {
        let from = data["From"];
        modal_manager.setContent("#mail-from", from.value || from.toString(), from.title || from.toString(), true);

        modal_manager.getElement("#mail-content").style.height = "";
    }
}

function updateDataToModal(modal_manager, mode, data, update_type = "add") {
    if ("Attachment" in data) {
        let content = '';
        let attachments = data["Attachment"];
        for (let i = 0, length = attachments.length; i < length; ++i) {
            content += `<li class="item-round attach-item ${mode == MODAL_READ_MODE ? "readonly" : ""}" 
                    title="${attachments[i].mime_type} [${Utils.formatSize(attachments[i].size)}]"
                    data-group="message-attachment" data-index="${i}">${attachments[i].filename}</li>`;
        }
        if (update_type == "add") {
            modal_manager.addContent("#modal-attachment-container", content, "beforeend");
        }
        else {
            modal_manager.setContent("#modal-attachment-container", content);
        }
    }
    if ("Label" in data) {
        let labels = data["Label"];
        let content = '';
        for (let i = 0, length = labels.length; i < length; ++i) {
            content += `<li class="item-round label-item readonly">${labels[i]}</li>`;
        }
        if (update_type == "add") {

            modal_manager.addContent("#modal-labels-container", content, "beforeend");
        } else {
            modal_manager.setContent("#modal-labels-container", content);
        }
    }
}