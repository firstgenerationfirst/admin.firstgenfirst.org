!function() {
    "use strict";
    gapiLoaded.then(function() {
        let auth = gapi.auth2.getAuthInstance();
        document.getElementById("signin-btn").addEventListener("click", function() {
            auth.signOut().then(auth.signIn);
        });
    });

    let hasLoggedOut = false;
    let attempts = 0;
    let attemptsMsg;

    user.logIn.then(function() {
        document.getElementById("signin-btn").disabled = false;
    });
    user.logOut.then(function() {
        hasLoggedOut = true;
    });

    user.readProfile.then(function() {
        location.replace("/");
    }, function(e) {
        attemptsMsg = attemptsMsg || document.getElementById("attempts");
        if (!hasLoggedOut) {
            return;
        }
        hasLoggedOut = false;
        attempts++;
        attemptsMsg.textContent = `${attempts} Attempt${attempts == 1 ? "" : "s"}`;
        attemptsMsg.style.display = "block";
    });

    firebase.firestore().collection("profiles").doc("account_creation").get().then(function(e) {
        const data = e.data();
        document.documentElement.setAttribute("data-fb-allow-account-creation", data.allow);
    }, function() {
        document.documentElement.setAttribute("data-fb-allow-account-creation", false);
    });
}();