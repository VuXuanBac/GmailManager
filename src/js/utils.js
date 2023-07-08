const Utils = {
    parseHash() {
        let fragmentString = location.hash.substring(1);
        let params = {};
        let regex = /([^&=]+)=([^&]*)/g, m;
        while (m = regex.exec(fragmentString)) {
            params[decodeURIComponent(m[1])] = decodeURIComponent(m[2]);
        }
        return params;
    },
    formatSize(bytes) {
        let sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        let i = 0;
        while (bytes >= 1024) {
            i++;
            if (i == sizes.length - 1) break;
            bytes /= 1024;
        }
        return `${Math.round(bytes)} ${sizes[i]}`;
    }
}

const Base64Codec = {
    unescape(str) { // from encoded Base64Url to encoded Base64
        return (str + '==='.slice((str.length + 3) % 4))
            .replace(/-/g, '+')
            .replace(/_/g, '/');
    },
    escape(str) {
        return str.replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    },
    encode(str) {
        return window.btoa(unescape(encodeURIComponent(str)));
    },
    encodeUrl(str) {
        return this.escape(window.btoa(unescape(encodeURIComponent(str))));
    },
    decode(str) {
        return decodeURIComponent(escape(window.atob(str)));
    },
    decodeUrl(str) {
        return decodeURIComponent(escape(window.atob(this.unescape(str))));
    },
    // encode(str, encoding) {
    //     return Buffer.from(str, encoding || 'utf8').toString('base64');
    // },
    // encodeUrl(str, encoding) {
    //     return this.escape(
    //         Buffer.from(str, encoding || 'utf8').toString('base64')
    //     );
    // },
    // decode(str, encoding) {
    //     return Buffer.from(str, 'base64')
    //         .toString(encoding || 'utf8');
    // },
    // decodeUrl(str, encoding) {
    //     return Buffer.from(this.unescape(str), 'base64')
    //         .toString(encoding || 'utf8');
    // }
}

// base64UrlEncode(str) {
//     return window.btoa(unescape(encodeURIComponent(str.replace(/-/g, '+').replace(/_/g, '/'))));
// },
// base64UrlDecode(str) {
//     return decodeURIComponent(escape(window.atob(str))).replace(/\+/g, '-').replace(/\//g, '_');
// },
// base64Url2Base64(str) {
//     return str.replace(/-/g, '+').replace(/_/g, '/');
// },
// base64Encode(str) {
//     return window.btoa(unescape(encodeURIComponent(str)));
// },
// base64Decode(str) {
//     return decodeURIComponent(escape(window.atob(str)));
// },