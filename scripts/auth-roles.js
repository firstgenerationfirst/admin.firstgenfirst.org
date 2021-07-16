user.readProfile.then(function(profile) {
    // site_editor:
    //   Has the ability to make GitHub commits that can edit the firstgenfirst.org site.
    // applicant_voting_master:
    //   Has the ability to toggle voting mode.
    // applicant_editor:
    //   Has the ability to edit applicant responses.
    // applicant_voter:
    //   Has the ability to vote for applicants when applicant_voting_master has Voting Mode enabled
    // applicant_viewer:
    //   Has the ability to view applicant responses at /applicants.
    // account_creation_toggler
    //   Has the ability to toggle whether new accounts are allowed to be created or not.
    document.documentElement.setAttribute("data-fb-roles", profile.roles.join(" "));
});
user.logOut.then(function() {
    document.documentElement.removeAttribute("data-fb-roles");
});