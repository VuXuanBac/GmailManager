
const MESSAGE_BATCH_LOAD = 25;
const STATE_REMEMBER = "save";
const STATE_NORMAL = "init";
const REDIRECT_URI = "http://127.0.0.1:5500/index.html";
const LOCALE = "vi-VN";

function changeUI(is_login) {
    // Change UI based on current state.
    location.hash = "";
    let notify = document.getElementById("notify");
    let btn_login_logout = document.getElementById("btn-login-logout");
    let remember_container = document.getElementById("remember-me").parentElement;
    let main_element = document.querySelector("main");
    notify.innerText = is_login ? "OK! You have already logged in." : "You need to login with Google";
    notify.className = is_login ? "success" : "info";
    btn_login_logout.innerText = is_login ? "Click here to logout" : "Click here to login";
    if (is_login) {
        remember_container.style.display = "none";
        main_element.style.display = "";
    }
    else {
        remember_container.style.display = "";
        main_element.style.display = "none";
    }
}

function populateUserInfo() {
    window.ApiManager.getUserInfo(false, (email_address, n_messages, n_threads) => {
        document.getElementById("user-address").innerHTML = `<b>${email_address}</b>`;
        document.getElementById("user-statistic").innerHTML = `<b>${n_messages}</b> Messages and <b>${n_threads}</b> Threads`;
    });
}

function handleLoginLogout() {
    if (window.AuthManager.is_login) {
        window.AuthManager.logout(changeUI);
    }
    else {
        window.AuthManager.login(
            document.getElementById("remember-me").checked ? STATE_REMEMBER : STATE_NORMAL,
            //changeUI
        );
    }
}

function handleOnload(event) {
    let state_from_hash = Utils.parseHash();
    let client_id = document.getElementById("client-id").value;
    let api_key = document.getElementById("api-key").value;
    if (!(client_id && api_key)) {
        alert("Does not know Client ID and API Key for this app.\nContact Developer for these values.\nOr you can create one, find the way in README.md");
        return;
    }
    window.AuthManager = new GoogleOAuth(
        client_id,
        REDIRECT_URI,
        ["modify"],
        [STATE_NORMAL, STATE_REMEMBER]
    ).load(state_from_hash,
        state_from_hash && state_from_hash["state"] === STATE_REMEMBER,
        changeUI);
    if (window.AuthManager.is_login) {

        let api_manager = new GmailAPI(
            window.AuthManager.access_token,
            api_key,
            (code, response) => {
                alert(`Error on Send Request:\n[Code] ${code}\n[Response] ${response}`);
                //window.AuthManager.logout(changeUI, true);
            }
        );

        let modal_manager = new Modal(
            document.querySelector(".modal"),
            ["mail-from", "mail-to", "mail-subject", "mail-content", "mail-cc", "mail-bcc", "mail-date"],
            initializeModal, populateDataToModal, updateDataToModal
        );

        let maillist_manager = new TableManager(
            document.querySelector("#mail-list"),
            createOneRow
        );

        window.MailboxManager = new Mailbox(
            maillist_manager, modal_manager, api_manager,
            MESSAGE_BATCH_LOAD, ""
        );

        window.MailboxManager.initialize();
    }
}

function handleClick(event) {
    let target = event.target;
    let btn_control = target.closest("[id^='btn']"); // closet ancestor (or target itself) has [id=btn-*]
    if (btn_control) {
        switch (btn_control.id) {
            case "btn-close-modal":
                window.MailboxManager.endShowMessage();
                break;
            case "btn-compose":
                window.MailboxManager.startCompose();
                break;
            case "btn-send":
                window.MailboxManager.sendMessage();
                break;
            case "btn-login-logout":
                handleLoginLogout();
                break;
            case "btn-attach":
                document.getElementById("attachment-chooser").click();
                break;
            case "btn-trash":
                window.MailboxManager.trashMessage();
                break;
            case "btn-reply":
                alert("[Not Implement Yet]");
            default:
                break;
        }
        // if (btn_control.id.startsWith("btn-trash-")) {
        //     let value = btn_control.id.split('-');
        //     let id = value[value.length - 2];
        //     window.Mailbox.trash(`#row-${id}`);

        //     // TODO: Move Trash message `id`. Remove row at index `index`
        // }
    }
    else {

        let element_in_group = target.closest("[data-group]");
        // console.log("Enter Group", element_in_group);
        if (element_in_group) {
            let group = element_in_group.getAttribute("data-group");
            if (group == "message-row") {
                if (event.ctrlKey) {
                    window.MailboxManager.trashMessage(target.closest("[data-messageid]"));
                }
                else {
                    window.MailboxManager.showMessage(element_in_group);
                }
            }
            else if (group == "message-attachment") {
                let attach_index = Number(element_in_group.getAttribute("data-index"));
                if (window.MailboxManager.compose && event.ctrlKey && !element_in_group.classList.contains("readonly")) { // delete
                    window.MailboxManager.removeAttachment(attach_index);
                    element_in_group.remove();
                    //console.log(window.MailboxManager.current_show_data);
                }
                else if (window.MailboxManager.show) {
                    if (attach_index != NaN) { // download
                        window.MailboxManager.downloadAttachment(attach_index);
                    }
                }
            }
            else if (group == "row-trash") {
                window.MailboxManager.trashMessage(target.closest("[data-messageid]"));
            }
        }
    }
}


function handleScroll(event) {
    let target = event.target;
    if (target.id == "mail-list") {
        if (window.MailboxManager.can_populate &&
            (target.scrollHeight < 5 + target.clientHeight + target.scrollTop)) {
            window.MailboxManager.populateBatch(); // continuous-scrolling problem is prevent by set lock in MailboxManager.
        }
        event.stopPropagation();
    }
}

function handleInput(event) {
    let target = event.target;
    if (target.id == "mail-content") {
        target.style.height = "auto";
        target.style.height = target.scrollHeight + "px";
    }
}

function handleKeyDown(event) {
    if (event.which == 113) {
        if (window.AuthManager.is_login) {
            alert("HELP Print:\n- Remove Attachment/Message Row: Ctrl + Left Mouse Click.");
            return false;
        }
    }
}

window.addEventListener("load", handleOnload, false);
document.addEventListener("click", handleClick, true);
document.addEventListener("scroll", handleScroll, true);
document.addEventListener("input", handleInput, true);
document.addEventListener("keydown", handleKeyDown);


document.getElementById("attachment-chooser").addEventListener("change",
    (event) => {
        let files = Array.from(event.target.files);
        let loaded_files = [];
        for (let i = 0, length = files.length; i < length; ++i) {
            new Promise((resolve) => {
                let reader = new FileReader();
                reader.onload = (e) => resolve(reader.result);
                reader.readAsDataURL(files[i]);
            }).then((data_uri) => {
                loaded_files.push(GmailAttachmentContent.fromUriAndFile(data_uri, files[i]));
                if (loaded_files.length == length) {
                    window.MailboxManager.addAttachment(loaded_files);
                }
            });
        }
        event.target.value = ""; // can choose same files.
    })