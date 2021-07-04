window.github = (function() {
	let github = {
		user: null,
		auth_code: null,
		logIn: new Promise(function(resolve, reject) {
			let cookies = {};
			if (document.cookie) {
				let kv = document.cookie.split(";");
				for (let i = kv.length - 1; i >= 0; i--) {
					kv[i] = kv[i].split("=");
					cookies[decodeURIComponent(kv[i].shift().trim())] = decodeURIComponent(kv[i].join("=").trim());
				}
			}

			let params = {};
			if (location.search) {
				let kv = location.search.substring(1).split("&");
				for (let i = kv.length - 1; i >= 0; i--) {
					kv[i] = kv[i].split("=");
					params[kv[i][0]] = kv[i][1];
				}
			}

			if (params.code || cookies["gh-sid"]) {
				history.pushState("", "", location.pathname);
				document.documentElement.setAttribute("data-gh-loading", "");

				let xhr = new XMLHttpRequest();
				xhr.open("POST", "https://us-west2-first-gen-first-admin-site.cloudfunctions.net/gh-access-token");
				xhr.setRequestHeader("Content-Type", "application/json");

				xhr.addEventListener("readystatechange", function() {
					if (this.readyState == 4) {
						document.documentElement.setAttribute("data-github-log-in-attempted", "");
						if (this.status == 200) {
							let response = JSON.parse(this.response);
							github.auth_code = response.token;

							let now = new Date();
							now.setYear(now.getFullYear() + 10);
							document.cookie = `gh-sid=${response.session_id};expires=${now.toUTCString()}`;

							document.documentElement.setAttribute("data-github-logged-in", "");

							// Make sure the logged in user has write permission for the website.
							github.get("/user").then(function(user) {
								window.github.user = user;
								github.get("/repos/{owner}/{repo}/collaborators/{username}/permission", {
									owner: "firstgenerationfirst",
									repo: "firstgenfirst.org",
									username: user.login
								}).then(function(permissions) {
									document.documentElement.removeAttribute("data-gh-loading");
									if (permissions.permission == "admin" || permissions.permission == "write") {
										resolve();
									} else {
										document.documentElement.setAttribute("data-github-no-write", "");
										reject({response: "No write access.", status: 401});
									}
								}).catch(function(e) {
									document.documentElement.removeAttribute("data-gh-loading");
									document.documentElement.setAttribute("data-github-error", "");
									if (e.constructor == Object) {
										reject(e);
									} else {
										reject({response: e.toString(), status: 500});
									}
								});
							}).catch(function(e) {
								document.documentElement.removeAttribute("data-gh-loading");
								document.documentElement.setAttribute("data-github-error", "");
								if (e.contructor == Object) {
									reject(e);
								} else {
									reject({response: e.toString(), status: 500});
								}
							});
						} else {
							if (this.response == "The provided session ID does not exist.") {
								document.cookie = "gh-sid=;expires=Thu, 01 Jan 1970 00:00:00 GMT";
							}
							document.documentElement.removeAttribute("data-gh-loading");
							document.documentElement.setAttribute("data-github-error", "");
							reject({response: this.response, status: this.status});
						}
					}
				});

				xhr.send(JSON.stringify({
					code: params.code || undefined,
					sid: cookies["gh-sid"] || undefined
				}));
			} else {
				document.documentElement.setAttribute("data-no-github", "");
				reject({response: "No GitHub login information.", status: 400});
			}
		}),
		get: function(pathstring, parameters) {
			return new Promise(function(resolve, reject) {
				if (parameters) {
					for (const name of Object.keys(parameters)) {
						while (true) {
							let newstring = pathstring.replace("{" + name + "}", parameters[name]);
							if (newstring == pathstring) {
								break;
							} else {
								pathstring = newstring;
							}
						}
					}
				}
				let xhr = new XMLHttpRequest();
				xhr.open("GET", "https://api.github.com" + pathstring);
				xhr.setRequestHeader("Accept", "application/vnd.github.v3+json");
				xhr.setRequestHeader("Authorization", "token " + github.auth_code);
				xhr.addEventListener("readystatechange", function() {
					if (this.readyState == this.DONE) {
						if (Math.floor(this.status / 100) == 2) {
							resolve(JSON.parse(this.response));
						} else {
							reject({response: this.response, status: this.status});
						}
					}
				});
				xhr.send();
			});
		},
		put: function(pathstring, parameters) {
			return new Promise(function(resolve, reject) {
				if (parameters) {
					for (const name of Object.keys(parameters)) {
						let del = false;
						while (true) {
							let newstring = pathstring.replace("{" + name + "}", parameters[name]);
							if (newstring == pathstring) {
								if (del) {
									delete parameters[name];
								}
								break;
							} else {
								del = true;
								pathstring = newstring;
							}
						}
					}
				}
				let xhr = new XMLHttpRequest();
				xhr.open("PUT", "https://api.github.com" + pathstring);
				xhr.setRequestHeader("Accept", "application/vnd.github.v3+json");
				xhr.setRequestHeader("Authorization", "token " + github.auth_code);
				xhr.addEventListener("readystatechange", function() {
					if (this.readyState == this.DONE) {
						if (Math.floor(this.status / 100) == 2) {
							resolve(JSON.parse(this.response));
						} else {
							reject({response: this.response, status: this.status});
						}
					}
				});
				xhr.send(JSON.stringify(parameters));
			});
		},
		file: {
			read: function(path) {
				return github.get("/repos/{owner}/{repo}/contents/{path}", {
					owner: "firstgenerationfirst",
					repo: "firstgenfirst.org",
					path: path
				});
			},
			write: function(path, content, message, sha, branch) {
				const params = {
					owner: "firstgenerationfirst",
					repo: "firstgenfirst.org",
					path: path,
					message: message,
					content: btoa(unescape(encodeURIComponent(content)))
				};
				if (sha == github.getSHA) {
					return github.file.read(path).then(function(file) {
						return github.put(path, content, message, file.sha, branch)
					});
				} else if (sha) {
					params.sha = sha;
				}
				if (branch) {
					params.branch = branch;
				}
				return github.put("/repos/{owner}/{repo}/contents/{path}", params);
			}
		},
		getSHA: Symbol()
	};

	return github;
})();