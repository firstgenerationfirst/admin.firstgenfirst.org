"use strict";function _typeof(e){return(_typeof="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e})(e)}window.user={online:!1,uid:null,email:null,firebaseUser:null,profile:null,readProfile:null},firebase.initializeApp({apiKey:"AIzaSyBLZkeVHg1qYygChbI9dEltdCm3UKF93X8",authDomain:"first-gen-first-admin-site.firebaseapp.com",databaseURL:"https://first-gen-first-admin-site.firebaseio.com",projectId:"first-gen-first-admin-site",storageBucket:"first-gen-first-admin-site.appspot.com",messagingSenderId:"544519717939",appId:"1:544519717939:web:154ab2d776fda1271f8f46"}),window.gapiLoaded=new Promise(function(t,n){var e=document.getElementById("gapi-script"),o=!1;function i(){o||"object"!=("undefined"==typeof gapi?"undefined":_typeof(gapi))||(o=!0,gapi.load("client:auth2",{callback:function(){var e=setTimeout(function(){(gapi.auth2.getAuthInstance()?t:n)()},8e3);gapi.client.init({apiKey:"AIzaSyBLZkeVHg1qYygChbI9dEltdCm3UKF93X8",clientId:"544519717939-mljfuqt4cd6it8on67gmptrnv964171e.apps.googleusercontent.com",discoveryDocs:["https://sheets.googleapis.com/$discovery/rest?version=v4"],scope:"profile https://www.googleapis.com/auth/spreadsheets"}).then(function(){clearTimeout(e),t()},function(){clearTimeout(e),n()})},onerror:n,timeout:5e3,ontimeout:n}))}e.addEventListener("load",i),e.addEventListener("error",n),i()}),window.user.logIn=new Promise(function(o,e){gapiLoaded.then(function(){var t=gapi.auth2.getAuthInstance();function n(){var e=t.currentUser.get().getAuthResponse();firebase.auth().signInWithCredential(firebase.auth.GoogleAuthProvider.credential(e.id_token,e.access_token)).then(function(e){window.user.online=!0,window.user.uid=e.user.uid,window.user.email=e.user.email,window.user.firebaseUser=e.user,o(window.user)})}t.isSignedIn.listen(function(e){e?n():location.replace("/signin?back=".concat(encodeURIComponent(location.pathname)))}),t.isSignedIn.get()?n():location.replace("/signin?back=".concat(encodeURIComponent(location.pathname)))})}),window.user.logOut=new Promise(function(t,e){gapiLoaded.then(function(){var e=gapi.auth2.getAuthInstance();e.isSignedIn.listen(function(e){e||t()}),e.isSignedIn.get()||t()})}),window.user.readProfile=new Promise(function(t,n){window.user.logIn.then(function(){firebase.firestore().collection("profiles").doc(window.user.uid).get().then(function(e){e=e.data();window.user.profile=e,t(e)}).catch(function(e){"/unauthorized"!=location.pathname&&"/requestacct"!=location.pathname&&location.assign("/unauthorized"),n()})}).catch(function(e){location.assign("/errlogin"),n(e)})}),document.documentElement.setAttribute("data-goog-logged-in","pending"),document.documentElement.setAttribute("data-fb-logged-in","pending"),user.logIn.then(function(){document.documentElement.setAttribute("data-goog-logged-in","true")}),user.logOut.then(function(){document.documentElement.setAttribute("data-goog-logged-in","false"),document.documentElement.setAttribute("data-fb-logged-in","false")}),user.readProfile.then(function(e){document.documentElement.setAttribute("data-fb-logged-in","true")},function(){document.documentElement.setAttribute("data-fb-logged-in","false")});