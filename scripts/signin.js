!function() {
    "use strict";
    let params = {};
    if (location.search) {
        let kv = location.search.substring(1).split("&");
        for (let i = kv.length - 1; i >= 0; i--) {
            kv[i] = kv[i].split("=");
            params[decodeURIComponent(kv[i][0])] = decodeURIComponent(kv[i][1]);
        }
    }

    gapiLoaded.then(function() {
        const auth = gapi.auth2.getAuthInstance();
        document.getElementById("signin").addEventListener("click", auth.signIn);

        user.logIn.then(function() {
            location.replace(params.back || "/");
        });
    }, function(e) {
        throw e;
    });
}();