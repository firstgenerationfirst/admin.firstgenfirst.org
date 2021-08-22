!function() {
    "use strict";

    class RepeatablePromise {
        constructor(callback) {
            this.status = "pending";
    
            function settler(status, value) {
                this.value = value;
                this.status = status;
                this._settle();
            }
            setTimeout(function() {
                try {
                    callback(settler.bind(this, "resolved"), settler.bind(this, "rejected"));
                } catch (err) {
                    settler.call(this, "rejected", err);
                }
            }.bind(this), 0);
        }
    
        then(callback1, callback2) {
            return this._addHandlers(callback1, callback2, true);
        }
    
        catch(callback) {
            return this._addHandlers(undefined, callback, true);
        }
    
        finally(callback) {
            return this._addHandlers(callback, callback, false);
        }
    
        _addHandlers(callback1, callback2, receiveArg) {
            if (typeof callback1 != "function") {
                callback1 = value => value;
            }
            if (typeof callback2 != "function") {
                callback2 = value => value;
            }
    
            let newPromise = new RepeatablePromise(function() {});
            this._handlers.push([receiveArg, callback1, callback2, newPromise]);
    
            if (this.status != "pending") {
                try {
                    let callback = this.status == "resolved" ? callback1 : callback2;
                    if (receiveArg) {
                        newPromise.value = callback(this.value);
                    } else {
                        newPromise.value = callback();
                    }
                    newPromise.status = "resolved";
                } catch (err) {
                    newPromise.value = err;
                    newPromise.status = "rejected";
                } finally {
                    newPromise._settle();
                }
            }
    
            return newPromise;
        }
    
        _settle() {
            if (this.status == "pending") {
                return;
            }
            for (let i = 0, l = this._handlers.length; i < l; i++) {
                let promise = this._handlers[i][3];
                try {
                    let callback = this._handlers[i][this.status == "resolved" ? 1 : 2];
                    if (this._handlers[i][0]) {
                        promise.value = callback(this.value);
                    } else {
                        promise.value = callback();
                    }
                    promise.status = "resolved";
                } catch (err) {
                    promise.value = err;
                    promise.status = "rejected";
                } finally {
                    promise._settle();
                }
            }
        }
        
        status = null;
        value = null;
        _handlers = [];
    }

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
                    }, function() {
                        clearTimeout(timeout);
                        reject(e)
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

    window.user.logIn = new RepeatablePromise(function(resolve, reject) {
        gapiLoaded.then(function() {
            const auth2 = gapi.auth2.getAuthInstance();
    
            auth2.isSignedIn.listen(function(signedIn) {
                if (signedIn) {
                    firebaseSignIn();
                }
            });
    
            if (auth2.isSignedIn.get()) {
                firebaseSignIn();
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
    
    window.user.logOut = new RepeatablePromise(function(resolve, reject) {
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
        });
    });
    
    window.user.readProfile = new RepeatablePromise(function(resolve, reject) {
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