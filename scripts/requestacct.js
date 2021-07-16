!function() {
    "use strict";
    let name;
    let loggedIn = null;
    let signInBtn = document.getElementById("signin-btn");

    document.getElementById("name").addEventListener("input", function() {
        name = this.value.trim();
        signInBtn.disabled = loggedIn !== false || !name.length;
    });

    gapiLoaded.then(function() {
        const auth = gapi.auth2.getAuthInstance();
        signInBtn.addEventListener("click", auth.signIn);
        document.getElementById("signout-btn").addEventListener("click", auth.signOut);
    });

    user.logIn.then(function(user) {
        if (loggedIn === null) {
            document.getElementById("signout").style.display = "block";
            return;
        }
        if (!name) {
            return;
        }
        loggedIn = true;
        firebase.firestore().collection("profiles").doc(user.uid).set({
            name: name
        }).finally(function() {
            location.assign("/");
        });
    });

    user.logOut.then(function() {
        document.getElementById("signout").style.display = "";
        loggedIn = false;
    });

    firebase.firestore().collection("profiles").doc("account_creation").get().then(function(e) {
        const data = e.data();
        document.documentElement.setAttribute("data-fb-allow-account-creation", data.allow);
    }, function() {
        document.documentElement.setAttribute("data-fb-allow-account-creation", false);
    });
}();