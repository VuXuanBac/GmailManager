
const RequestUtils = {
    parseParams(url, params) {
        if (params) {
            if (params instanceof URLSearchParams) {
                url += "?" + params.toString();
            }
            else {
                url += "?" + (new URLSearchParams(params)).toString();
            }
        }
        return url;
    },
}

// class AjaxRequestMaker {
//     constructor(headers) {
//         let xhr = new XMLHttpRequest();
//         this.success_callback = undefined;
//         this.failure_callback = undefined;
//         xhr.onreadystatechange = (event) => {
//             if (xhr.readyState == xhr.DONE) {
//                 if (xhr.status < 300) {
//                     if (this.success_callback)
//                         this.success_callback(JSON.parse(xhr.responseText), xhr.status);
//                 }
//                 else {
//                     if (this.failure_callback)
//                         this.failure_callback(JSON.parse(xhr.responseText), xhr.status);
//                 }
//             }
//         }
//         for (const h in headers) {
//             xhr.setRequestHeader(h, headers[h]);
//         }
//         this.sendAsync = (method, url, params, body, success_callback, failure_callback) => {
//             this.success_callback = success_callback;
//             this.failure_callback = failure_callback;
//             url = RequestUtils.parseParams(url, params);
//             xhr.open(method, url, true);
//             xhr.send(method == "GET" ? null : body.toString());
//         };
//         this.send = (method, url, params, body) => {
//             url = RequestUtils.parseParams(url, params);
//             xhr.open(method, url, false);
//             xhr.send(method == "GET" ? null : body.toString());
//             return JSON.parse(xhr.responseText);
//         }
//     }
// }

class Request {
    static withAjax(method, async, url, access_token, callback_success,
        callback_failure, params = undefined, body = undefined) {
        let xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function (event) {
            if (xhr.readyState == xhr.DONE) {
                if (xhr.status < 300) {
                    if (callback_success) callback_success(JSON.parse(xhr.responseText));
                }
                else {
                    if (callback_failure) callback_failure(xhr.status, xhr.responseText);
                }
            }
        }
        url = RequestUtils.parseParams(url, params);

        console.log((async ? "ASYNC" : ""), 'Request:', url);
        xhr.open(method, url, async);
        xhr.setRequestHeader("Authorization", `Bearer ${access_token}`);
        // if (method == "POST") {
        //     xhr.setRequestHeader("Referrer-Policy", "strict-origin-when-cross-origin");
        //     xhr.setRequestHeader("Access-Control-Allow-Origin", "*");
        // }
        xhr.send(method == "GET" ? null : body.toString());
    }

    static async withForm(method, url, params) {
        var form = document.createElement("form");
        form.setAttribute('method', method); // Send as a GET request.
        form.setAttribute('action', url);

        for (var p in params) {
            var input = document.createElement('input');
            input.setAttribute('type', 'hidden');
            input.setAttribute('name', p);
            input.setAttribute('value', params[p]);
            form.appendChild(input);
        }

        // Add form to page and submit it to open the OAuth 2.0 endpoint.
        document.body.appendChild(form);
        await form.submit();
    }
}