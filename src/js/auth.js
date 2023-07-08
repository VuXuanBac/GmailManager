// =============== Requires: request.js ===============

const GOOGLE_OAUTH_STATE = "oauth";
const STATE_SAVE_TIME_KEY = "seton";
const ACCESS_TOKEN_KEY = "access_token";
class GoogleOAuth {
    constructor(client_id, redirect_uri, scopes, valid_states) {
        this.client_id = client_id;
        this.redirect_uri = redirect_uri;
        this.scopes = GoogleOAuth.parseScopes(...scopes).join(" ");
        this.is_login = false;
        this.access_token = null;
        this.valid_states = valid_states;
        this.login = (state_to_send, callback) => {
            if (!this.is_login) {
                if (!this.valid_states.includes(state_to_send)) {
                    console.log("[AUTH] Could not Login because of Invalid State: " + state_to_send);
                    return;
                }
                this.removeState();
                GoogleOAuth.authorize(client_id, redirect_uri,
                    this.scopes,
                    state_to_send);
                this.is_login = true;
            }
            if (callback)
                callback(this.is_login);
        };
        this.logout = (callback, force) => {
            if (this.is_login) {
                if (force || confirm("Do you want to sign out?")) {
                    this.removeState();
                    GoogleOAuth.revokeAccess(this.access_token, this.redirect_uri);
                    this.is_login = false;
                }
            }
            if (callback)
                callback(this.is_login);
        };
        this.load = (current_state, remember, callback) => {
            if (!(ACCESS_TOKEN_KEY in current_state || "error" in current_state)) {
                let save_state = this.getState();
                if (save_state) {
                    if (("expires_in" in save_state) &&
                        (STATE_SAVE_TIME_KEY in save_state) &&
                        (Number(save_state[STATE_SAVE_TIME_KEY]) + Number(save_state["expires_in"]) * 1000 > Date.now())) {
                        current_state = save_state;
                    }
                    else {
                        //this.removeState();
                    }
                }
            }
            else {
                let granted_scopes = current_state["scope"] || "";
                if (granted_scopes && granted_scopes.includes(this.scopes)) { // TODO: Current version just support granted all scopes. This will change when using library.

                    if (remember) {
                        this.saveState(current_state);
                    }
                }
                else {
                    current_state = undefined;
                    alert("The website need you to grant the permission for running correctly.");
                }
            }

            this.is_login = current_state && (this.valid_states.includes(current_state["state"]));
            if (!this.is_login) {
                this.removeState();
            }
            else {
                this.access_token = current_state[ACCESS_TOKEN_KEY];
            }

            if (callback)
                callback(this.is_login);
            return this;
        };
        this.getState = () => JSON.parse(localStorage.getItem(GOOGLE_OAUTH_STATE));
        this.removeState = () => localStorage.removeItem(GOOGLE_OAUTH_STATE);
        this.saveState = (state) => {
            state[STATE_SAVE_TIME_KEY] = Date.now();
            localStorage.setItem(GOOGLE_OAUTH_STATE, JSON.stringify(state));
        };
    }

    static authorize(client_id, redirect_uri, scopes, state) {
        // https://accounts.google.com/o/oauth2/v2/auth?scope={scope}&include_granted_scopes=true
        // &response_type=token&state={state}&redirect_uri={redirect_uri}&client_id={client_id}
        // Client ID: App can authenticate with OAuth Server. Get from Credentials
        // Redirect URI: URI for receive response. Must match with `Authorized redirect URIs`
        // State: Keep state between request page and response page. In response, we have `state` field with same value
        // Scopes: API Scopes
        // Include Granted Scopes: True means in response, we get user-granted api scopes.

        let url = "https://accounts.google.com/o/oauth2/v2/auth";
        let params = {
            'client_id': client_id,
            'redirect_uri': redirect_uri,
            'response_type': 'token',
            'scope': scopes,
            'include_granted_scopes': 'true',
            'state': state
        };

        // Since this OAuth 2.0 endpoint does not support Cross-Origin Resource Sharing (CORS), 
        // we need to creates a form (instead of AJAX) that opens the request to that endpoint.
        Request.withForm('GET', url, params);

        // After that, listen at redirect_uri.
    }
    static revokeAccess(access_token, redirect_uri) {
        // https://oauth2.googleapis.com/revoke?token={token}
        let url = 'https://oauth2.googleapis.com/revoke';
        let params = { 'token': access_token };
        Request.withForm('POST', url, params).then(() =>
            location.href = redirect_uri
        );
    }
    static parseScopes(...scope_names) {
        let scope_map = {
            profile: "https://www.googleapis.com/auth/userinfo.profile",
            yout_profile: "https://www.googleapis.com/auth/youtube.readonly",
            read: "https://www.googleapis.com/auth/gmail.readonly",
            compose: "https://www.googleapis.com/auth/gmail.compose",
            modify: "https://www.googleapis.com/auth/gmail.modify",
            all: "https://mail.google.com/",
        };
        return scope_names.map((value) => scope_map[value]).filter(value => value !== undefined);
    }
}

