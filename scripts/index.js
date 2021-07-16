!function() {
    "use strict";
    let accountCreationCheckbox;

    gapiLoaded.then(function() {
        let auth = gapi.auth2.getAuthInstance();
        document.getElementById("signin-btn").addEventListener("click", auth.signIn);
        document.getElementById("signout-btn").addEventListener("click", auth.signOut);
    });

    user.logOut.then(function() {
        document.getElementById("userinfo-name").innerText = "";
    });

    user.readProfile.then(function(profile) {
        document.getElementById("userinfo-name").innerText = profile.name;
    });

    function onDocumentLoad() {
        let doc = firebase.firestore().collection("profiles").doc("account_creation");
        accountCreationCheckbox = document.getElementById("account_creation_checkbox");

        doc.get().then(function(e) {
            const data = e.data();
            document.documentElement.setAttribute("data-fb-allow-account-creation", data.allow);
            accountCreationCheckbox.checked = data.allow;
        }, function() {
            document.documentElement.setAttribute("data-fb-allow-account-creation", false);
        });

        accountCreationCheckbox.addEventListener("change", function() {
            let newValue = this.checked;
            doc.update({
                allow: newValue
            }).catch(function(e) {
                console.log(e)
                this.checked = !newValue;
            }.bind(this));
        });
    }

    if (document.readyState != "loading") {
        onDocumentLoad();
    } else {
        document.addEventListener("readystatechange", function() {
            if (this.readyState == "interactive") {
                onDocumentLoad();
            }
        });
    }
}();