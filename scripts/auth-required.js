!function() {
    "use strict";

    window.user = {
        online: false,
        uid: null,
        email: null,
        firebaseUser: null,
        profile: null,
        readProfile: null
    };
    
    firebase.initializeApp({
        apiKey: "AIzaSyBLZkeVHg1qYygChbI9dEltdCm3UKF93X8",
        authDomain: "first-gen-first-admin-site.firebaseapp.com",
        databaseURL: "https://first-gen-first-admin-site.firebaseio.com",
        projectId: "first-gen-first-admin-site",
        storageBucket: "first-gen-first-admin-site.appspot.com",
        messagingSenderId: "544519717939",
        appId: "1:544519717939:web:154ab2d776fda1271f8f46"
    });
    
    window.gapiLoaded = new Promise(function(resolve, reject) {
        const script = document.getElementById("gapi-script");
        let isDoneLoading = false;
    
        function gapiLoaded2() {
            if (isDoneLoading || typeof gapi != "object") {
                return;
            }
            isDoneLoading = true;
            gapi.load("client:auth2", {
                callback: function() {
                    // If the network connection is particularly slow, gapi may just stall out without ever logging in.
                    // This 8-second timer makes sure the promise gets rejected instead of waiting forever.
                    let timeout = setTimeout(function() {
                        if (gapi.auth2.getAuthInstance()) {
                            resolve();
                        } else {
                            reject("Timeout");
                        }
                    }, 8000);
                    gapi.client.init({
                        apiKey: "AIzaSyBLZkeVHg1qYygChbI9dEltdCm3UKF93X8",
                        clientId: "544519717939-mljfuqt4cd6it8on67gmptrnv964171e.apps.googleusercontent.com",
                        discoveryDocs: ["https://sheets.googleapis.com/$discovery/rest?version=v4"],
                        scope: "profile https://www.googleapis.com/auth/spreadsheets"
                    }).then(function() {
                        clearTimeout(timeout);
                        resolve();
                    }, function(e) {
                        clearTimeout(timeout);
                        reject(e);
                    });
                },
                onerror: reject,
                timeout: 5000,
                ontimeout: _ => reject("Timeout")
            });
        }
    
        script.addEventListener("load", gapiLoaded2);
        script.addEventListener("error", reject);
        gapiLoaded2();
    });
    
    window.user.logIn = new Promise(function(resolve, reject) {
        gapiLoaded.then(function() {
            const auth2 = gapi.auth2.getAuthInstance();
    
            auth2.isSignedIn.listen(function(signedIn) {
                if (signedIn) {
                    firebaseSignIn();
                } else {
                    location.replace(`/signin?back=${encodeURIComponent(location.pathname)}`);
                }
            });
    
            if (auth2.isSignedIn.get()) {
                firebaseSignIn();
            } else {
                location.replace(`/signin?back=${encodeURIComponent(location.pathname)}`);
            }
    
            function firebaseSignIn() {
                const response = auth2.currentUser.get().getAuthResponse();
                firebase.auth().signInWithCredential(firebase.auth.GoogleAuthProvider.credential(
                    response.id_token,
                    response.access_token
                )).then(function(result) { 
                    window.user.online = true;
                    window.user.uid = result.user.uid;
                    window.user.email = result.user.email;
                    window.user.firebaseUser = result.user;
                    resolve(window.user);
                });
            }
        });
    });
    
    // A log out event will make the page redirect, making a logOut Promise pretty much obsolete. It's
    // included though to match the logOut Promise in auth-optional.js.
    window.user.logOut = new Promise(function(resolve, reject) {
        gapiLoaded.then(function() {
            const auth2 = gapi.auth2.getAuthInstance();
    
            auth2.isSignedIn.listen(function(signedIn) {
                if (!signedIn) {
                    resolve();
                }
            });
    
            if (!auth2.isSignedIn.get()) {
                resolve();
            }
        })
    });
    
    window.user.readProfile = new Promise(function(resolve, reject) {
        window.user.logIn.then(function() {
            firebase.firestore().collection("profiles").doc(window.user.uid).get().then(function(e) {
                let data = e.data();
                window.user.profile = data;
                resolve(data);
            }).catch(function(e) {
                if (location.pathname != "/unauthorized" && location.pathname != "/requestacct") {
                    location.assign("/unauthorized");
                }
                reject();
            });
        }).catch(function(e) {
            location.assign("/errlogin");
            reject(e);
        })
    });
    
    document.documentElement.setAttribute("data-goog-logged-in", "pending");
    document.documentElement.setAttribute("data-fb-logged-in", "pending");
    user.logIn.then(function() {
        document.documentElement.setAttribute("data-goog-logged-in", "true");
    });
    user.logOut.then(function() {
        document.documentElement.setAttribute("data-goog-logged-in", "false");
        document.documentElement.setAttribute("data-fb-logged-in", "false");
    });
    
    user.readProfile.then(function(profile) {
        document.documentElement.setAttribute("data-fb-logged-in", "true");
    }, function() {
        document.documentElement.setAttribute("data-fb-logged-in", "false");
    });
}();