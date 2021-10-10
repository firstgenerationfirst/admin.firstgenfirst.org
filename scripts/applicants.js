!function() {
  "use strict";
  const spreadsheetData = window.applicant_spreadsheets;
  const MISSING_FIELD = spreadsheetData.MISSING_FIELD;
  const NA = spreadsheetData.Enum.NA;
  // The list of all statuses that an applicant can be.
  const APPLICANT_STATUSES = ["applicant", "finalist", "recipient", "ineligible", "2nd read"];
  // Regex that checks if a string is made up entirely of non-alphanumeric characters.
  const ONLY_NON_ALPHANUMERIC_REGEX = /^[^a-zA-Z\d]*$/;
  // Regex that looks for "status:" (for use in parsing search queries).
  const SEARCH_QUERY_STATUS_REGEX = /(?:\s+|^)status\s*[:=]\s*([a-z\d]+)(?=\s+|$)/;
  // Regex that looks for "#\d" or "#\d-\d" (for use in parsing search queries).
  const SEARCH_QUERY_ID_REGEX = /(?:\s+|^)(?:#?(\d+)\s*-\s*([a-f\d]*)|#([a-f\d]+)|([a-f\d]*\d[a-f\d]*))(?=\s+|$)/;
  // How many milliseconds we need to hold down a row with the mouse to recognize it as a drag
  // instead of a click.
  const DRAG_THRESHOLD = 400;

  const BUTTON_CLICK = function(handler) {
    return {
      onKeyPress: function(e) {
        if (e.code == "Space" || e.code == "Enter" || e.key == "Space" || e.key == "Enter") {
          e.stopPropagation();
          e.preventDefault();
          handler(e);
        }
      },
      onClick: function(e) {
        e.stopPropagation();
        e.preventDefault();
        handler(e)
      }
    };
  };

  // Parse document.cookies into an object.
  let cookies = {};
  for (const cookie of document.cookie.split("; ")) {
    let [name, value] = cookie.split("=");
    cookies[decodeURIComponent(name)] = decodeURIComponent(value);
  }

  // Store our roles from Firebase into an array. The roles determine which UI elements to show and
  // hide, but the actual authorization takes place in Firebase.
  let ROLES = [];
  // Lets us know if the person has the capability to edit applicant responses.
  let IS_EDITOR = false;
  let IS_VOTING_MASTER = false;
  user.readProfile.then(function(profile) {
    ROLES = profile.roles;
    IS_EDITOR = ROLES.includes("applicant_editor");
    IS_VOTING_MASTER = ROLES.includes("applicant_voting_master");
  });

  // Get a reference to the Firebase document with voting information. A non-applicant_voter will
  // not end up reading or writing to these document since they don't have access.
  const firestore = firebase.firestore();
  const votingDataDocument = firestore.collection("applicants").doc("voting");
  const votingPollDocument = firestore.collection("applicants").doc("voting_poll");
  // Stores the data from the Firebase document above once we load it.
  let votingData = {
    active: false,
    poll: null,
    poll_receivers: []
  };

  // Function to turn a number into a prettified string of that number. Adds commas as thousands
  // separators, and turns numbers divisible by 1,000 into a shortened form by adding "k".
  // 12345 => 12,345 | 67000 => 67k | 8901000 => 8,901k
  // Prefix is an optional string to add onto the front (i.e., "$" to make it dollars).
  function prettyNumber(number, prefix) {
    return isNaN(number) ? number : number % 1000 == 0 && number != 0 ?
      (prefix || "") + (number / 1000).toString().replace(/(\d)(?=(?:\d{3})+$)/g, "$1,") + "k" :
      (prefix || "") + number.toString().replace(/(\d)(?=(?:\d{3})+$)/g, "$1,");
  }

  // `prettyNumber`, but adds a dollar sign at the beginning to make it dollars.
  function prettyDollar(number) {
    return prettyNumber(number, "$");
  }

  // Converts a string into Title Case. Smaller words like "and" and "the" are kept lowercase.
  function titleCase(string) {
    return string.trim().replace(/\s+/g, " ").toLocaleLowerCase(navigator.language).replace(
      /([^0-9A-Za-zÀ-ÖØ-öø-ÿ]+(?!(?:the|a|an|at|and|but|or|for|nor|as|if|in|on|of)\b)|^|[^0-9A-Za-zÀ-ÖØ-öø-ÿ]](?=[0-9A-Za-zÀ-ÖØ-öø-ÿ]+$))([0-9A-Za-zÀ-ÖØ-öø-ÿ])/g,
      ($0, $1, $2) => $1 + $2.toLocaleUpperCase(navigator.language)
    );
  }

  // Helper function to turn `NA` into "N/A", and pass all non-NA values to another function.
  function convertNA(f) {
    return a => a == NA ? "N/A" : f(a);
  }

  // List of state abbreviations to prettify locations.
  const stateAbbreviations = {"alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR", "california": "CA", "colorado": "CO", "connecticut": "CT", "delaware": "DE", "florida": "FL", "georgia": "GA", "hawaii": "HI", "idaho": "ID", "illinois": "IL", "indiana": "IN", "iowa": "IA", "kansas": "KS", "kentucky": "KY", "louisiana": "LA", "maine": "ME", "maryland": "MD", "massachusetts": "MA", "michigan": "MI", "minnesota": "MN", "mississippi": "MS", "missouri": "MO", "montana": "MT", "nebraska": "NE", "nevada": "NV", "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND", "ohio": "OH", "oklahoma": "OK", "oregon": "OR", "pennsylvania": "PA", "rhode island": "RI", "south carolina": "SC", "south dakota": "SD", "tennessee": "TN", "texas": "TX", "utah": "UT", "vermont": "VT", "virginia": "VA", "washington": "WA", "west virginia": "WV", "wisconsin": "WI", "wyoming": "WY"};
  const stateAbbreviationValues = Object.values(stateAbbreviations);
  // Regex used to parse out states at the end of a location.
  const stateRegex = new RegExp(`^(.+?)(?:(?:,\\s*|\\s+)(${Object.keys(stateAbbreviations).join("|")}))?$`);
  // These formatters determine how a value will be shown in the applicant modal window. They should
  // return a string.
  const formatters = {
    First: convertNA(titleCase),
    Last: convertNA(titleCase),
    Email: convertNA(a => a.toLocaleLowerCase(navigator.language)),
    Status: convertNA(a => ({[spreadsheetData.Enum.STATUS.APPLICANT]: "Applicant", [spreadsheetData.Enum.STATUS.FINALIST]: "Finalist", [spreadsheetData.Enum.STATUS.RECIPIENT]: "Recipient", [spreadsheetData.Enum.STATUS.INELIGIBLE]: "Ineligible", [spreadsheetData.Enum.STATUS.SECOND_READ]: "2nd Read"})[a] || "N/A"),
    Income:convertNA (a => Array.isArray(a) ? a[1] == "Infinity" ? `${prettyDollar(a[0])}+` : `${prettyDollar(a[0])}–${prettyDollar(a[1])}` : prettyDollar(a)),
    Members: convertNA(prettyNumber),
    EFC: convertNA(function(a) {
      if (typeof a == "number") {
        return prettyDollar(a);
      } else if (+a === +spreadsheetData.Enum.EFC.UNDOCUMENTED) {
        return "Undocumented";
      } else if (+a === +spreadsheetData.Enum.WRITE_IN) {
        return a.value;
      } else {
        return "N/A";
      }
    }),
    College: convertNA(function(a) {
      // Common substitutions to make them more standardized
      const subs = {
        "Stanford": "Stanford University",
        "Uc Los Angeles": "UCLA",
        "Ucsd": "UC San Diego",
        "Ucsb": "UC Santa Barbara",
        "Ucsc": "UC Santa Cruz",
        "Ucr": "UC Riverside",
        "Ucm": "UC Merced",
        "Ucd": "UC Davis",
        "Ucb": "UC Berkeley",
        "Berkeley": "UC Berkeley",
        "Uci": "UC Irvine",
        "Csun": "CSU Northridge",
        "Rio Hondo": "Rio Hondo College",
        "Ivc": "Irvine Valley College",
        "Lbcc": "Long Beach City College",
        "Iupui": "Indiana University–Purdue University Indianapolis",
        "Umkc": "University of Missouri–Kansas City"
      }
  
      a = titleCase(a).replace(/\bU\b/, "University");
      a = (subs[a] || a).replace(/\b(?:uc|ucla|csu|su|cn|cc|usc|ca)\b/gi, $0 => $0.toLocaleUpperCase(navigator.language));
      return a;
    }),
    Loans: convertNA(a => ({[spreadsheetData.Enum.LOANS.YES]: "Yes", [spreadsheetData.Enum.LOANS.NO]: "No", [spreadsheetData.Enum.LOANS.UNCERTAIN]: "N/A"})[a] || "N/A"),
    Campus_Living: convertNA(a => ({[spreadsheetData.Enum.CAMPUS_LIVING.ON_CAMPUS]: "On campus", [spreadsheetData.Enum.CAMPUS_LIVING.OFF_CAMPUS_RENT]: "Off campus w/ rent", [spreadsheetData.Enum.CAMPUS_LIVING.OFF_CAMPUS_NO_RENT]: "Off campus w/o rent", [spreadsheetData.Enum.CAMPUS_LIVING.UNCERTAIN]: "Unknown"})[a] || "N/A"),
    Location: convertNA(function(a) {
      a = a.toLowerCase().trim();
      if (a.replace(/[^a-z\d\s]/g, "") == "washington dc") {
        return "Washington, DC";
      }
      if (stateAbbreviationValues.includes(a.substring(a.length - 2).toUpperCase()) && a.substring(0, a.length - 2).trim().length != a.length - 2) {
        const abbr = a.substring(a.length - 2);
        a = a.substring(0, a.length - 2).trim();
        if (a[a.length - 1] != ",") {
          a += ","
        }
        return titleCase(a) + " " + abbr.toUpperCase();
      } else {
        return a.replace(stateRegex, (_, $1, $2) => titleCase($1) + ($2 ? ", " + stateAbbreviations[$2] : ""));
      }
    }),
    Year: convertNA(a => ({[spreadsheetData.Enum.YEAR.HIGH_SCHOOL]: "High school student", [spreadsheetData.Enum.YEAR.FIRST_YEAR]: "First year college student", [spreadsheetData.Enum.YEAR.COLLEGE]: "Returning college student", [spreadsheetData.Enum.YEAR.GRADUATE]: "Graduate student", [spreadsheetData.Enum.YEAR.TRANSFER]: "Transfer student"})[a] || "N/A"),
    Parent1_Education: convertNA(a => ({[spreadsheetData.Enum.PARENT1_EDUCATION.NO_DIPLOMA]: "No diploma", [spreadsheetData.Enum.PARENT1_EDUCATION.DIPLOMA]: "HS diploma or equivalent", [spreadsheetData.Enum.PARENT1_EDUCATION.SOME_COLLEGE]: "Some college", [spreadsheetData.Enum.PARENT1_EDUCATION.DEGREE]: "College degree", [spreadsheetData.Enum.PARENT1_EDUCATION.MULTIPLE_DEGREES]: "Multiple degrees", [spreadsheetData.Enum.PARENT1_EDUCATION.NO_PARENT]: "No parent 1"})[a] || "N/A"),
    Parent2_Education: convertNA(a => ({[spreadsheetData.Enum.PARENT2_EDUCATION.NO_DIPLOMA]: "No diploma", [spreadsheetData.Enum.PARENT2_EDUCATION.DIPLOMA]: "HS diploma or equivalent", [spreadsheetData.Enum.PARENT2_EDUCATION.SOME_COLLEGE]: "Some college", [spreadsheetData.Enum.PARENT2_EDUCATION.DEGREE]: "College degree", [spreadsheetData.Enum.PARENT2_EDUCATION.MULTIPLE_DEGREES]: "Multiple degrees", [spreadsheetData.Enum.PARENT2_EDUCATION.NO_PARENT]: "No parent 2"})[a] || "N/A"),
    Phone: convertNA(function(a) {
      a = a.replace(/[^\d\+]+/g, "");
      if (a.length == 12 && a.substring(0,2) == "+1") {
        a = a.substring(2);
      } else if (a.length == 11 && a.substring[0] == "1") {
        a = a.substring(1);
      }
      return a.length == 10 && !isNaN(a) ? `(${a.substring(0,3)}) ${a.substring(3,6)}-${a.substring(6,10)}` : "N/A";
    }),
    Birthday: convertNA(a => !isNaN(a.valueOf()) && a < new Date() ? `${["Jan.", "Feb.", "Mar.", "Apr.", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."][a.getMonth()]} ${a.getDate()}, ${a.getFullYear()}` :  "N/A"),
    Pronouns: convertNA(a => a.split("/").map(pronoun => titleCase(pronoun.trim())).join("/"))
  }

  let years = [];
  // Get all the available years. Any number in the spreadsheet data is assumed to be a year.
  for (const key in spreadsheetData) {
    if (!isNaN(key)) {
      years.push(key);
    }
  }
  // Descending order so newer years come up first.
  years.sort((a, b) => b - a);

  // Adds a `setNestedState` to components that behaves like setState, except it works for nested
  // objects too.
  class Component extends React.Component {
    setNestedState(state, maxIterations) {
      let newState = {};
      for (const key in state) {
        newState[key] = typeof state[key] == "object" && state[key] !== null && state[key] != this.state[key] ? this.__extendStateObj(state[key], typeof this.state[key] == "object" && this.state[key] !== null ? this.state[key] : {}, maxIterations || 10) : state[key];
      }
      return super.setState(newState);
    }

    __extendStateObj(state, newState, iterationsLeft) {
      for (const key in state) {
        newState[key] = typeof state[key] == "object" && state[key] !== null && iterationsLeft > 0 ? this.__extendStateObj(state[key], typeof newState[key] == "object" && newState[key] !== null ? newState[key] : {}, iterationsLeft - 1) : state[key];
      }
      return newState;
    }
  }

  class PureComponent extends React.PureComponent {
    setNestedState(state, maxIterations) {
      let newState = {};
      for (const key in state) {
        newState[key] = typeof state[key] == "object" && state[key] !== null && state[key] != this.state[key] ? this.__extendStateObj(state[key], typeof this.state[key] == "object" && this.state[key] !== null ? this.state[key] : {}, maxIterations || 10) : state[key];
      }
      return super.setState(newState);
    }

    __extendStateObj(state, newState, iterationsLeft) {
      for (const key in state) {
        newState[key] = typeof state[key] == "object" && state[key] !== null && iterationsLeft > 0 ? this.__extendStateObj(state[key], typeof newState[key] == "object" && newState[key] !== null ? newState[key] : {}, iterationsLeft - 1) : state[key];
      }
      return newState;
    }
  }

  class App extends Component {
    constructor(props) {
      super(props);

      // Get the most recent year available.
      const thisYear = new Date().getFullYear();
      const mostRecentYear = Math.max(...props.years.filter(year => year - thisYear <= 0));
      
      this.state = {
        // The current year's spreadsheet data.
        spreadsheetData: null,
        // A mapping of years we have already loaded data for.
        loadedYears: {},
        // The currently selected year to display applicants for,
        selectedYear: mostRecentYear,
        // Whether we are loading a spreadsheet's data. If we are, applicants are hidden and a load-
        // message shows instead.
        loading: true,
        // Whether compact mode is on. Currently this does nothing.
        compactMode: cookies["applicants-compact_mode"] == "true",
        // Whether Unbiased Mode is on
        unbiasedMode: cookies["applicants-unbiased_mode"] == "true",
        // What Details to display
        detailOption: cookies["applicants-details"] || "Icons",
        autoSharePollResults: cookies["applicants-auto_share_poll_results"] != "false",
        // The search query in the search bar.
        searchQuery: "",
        // Whether we are focusing on an applicant.
        isFocusing: false,
        // The ID of the current applicant being focused on.
        applicantFocus: null,
        // Whether settings are being shown.
        showSettings: false,
        // An error message to display (e.g., when applicant data has failed to load).
        error: null,
        // An unsubscribe function to stop listening for poll updates, or null.
        pollUnsubscribe: null,
        // Whether we are currently selecting applicants from a poll.
        selectingApplicants: false,
        // The list of applicants we have selected.
        selectedApplicants: [],
        // Whether we are selecting applicants but can't select anymore.
        selectionDisabled: false,
        // The list of applicants a poll is showing (applicants not in the list are hidden).
        pollApplicants: [],
        // What step we are in in the poll-creation process (only for applicant_voting_master).
        pollCreationStep: 0,
        pollSubmitted: false,
        rankingApplicants: false,
        rankedApplicants: [],
        pollType: null,
        previousPollData: null,
        eliminatingApplicants: false,
        floatingRow: {
          active: false,
          props: null,
          ref: React.createRef(),
          ID: null,
          coords: null,
          initCoords: null,
          touchID: null
        },
        filteredRowIndices: [],
        filteredRowMatchData: [],
        sharingPollResults: false
      };

      document.addEventListener("click", function() {
        this.toggleSettingVisibility(false);
      }.bind(this));

      this.handler_rankingPointerup = this.handler_rankingPointerup.bind(this);
      this.handler_rankingMousemove = this.handler_rankingMousemove.bind(this);
      this.handler_rankingTouchend = this.handler_rankingTouchend.bind(this);
      this.handler_rankingTouchmove = this.handler_rankingTouchmove.bind(this);
      
      this.setAppState = this.setState.bind(this);
      this.changeSearchQuery = this.changeSearchQuery.bind(this);
      this.changeYearTo = this.changeYearTo.bind(this);
      this.toggleSettingVisibility = this.toggleSettingVisibility.bind(this);
      this.toggleVotingMode = this.toggleVotingMode.bind(this);
      this.toggleUnbiasedMode = this.toggleUnbiasedMode.bind(this);
      this.changeDetailOption = this.changeDetailOption.bind(this);
      this.toggleApplicantSelection = this.toggleApplicantSelection.bind(this);
      this.selectApplicant = this.selectApplicant.bind(this);
      this.focusOnApplicant = this.focusOnApplicant.bind(this);
      this.subscribeToPollResponses = this.subscribeToPollResponses.bind(this);
      this.unsubscribeFromPollResponses = this.unsubscribeFromPollResponses.bind(this);
      this.submitPollResponses = this.submitPollResponses.bind(this);
      this.toggleRankingDrag = this.toggleRankingDrag.bind(this);
      this.moveRankingRow = this.moveRankingRow.bind(this);
      this.unfocusApplicant = this.unfocusApplicant.bind(this);
      this.reloadSearchResults = this.reloadSearchResults.bind(this);
      this.toggleAutoSharePollResults = this.toggleAutoSharePollResults.bind(this);
      this.beginEliminatingApplicants = this.beginEliminatingApplicants.bind(this);
      this.finishEliminatingApplicants = this.finishEliminatingApplicants.bind(this);
      this.cancelEliminatingApplicants = this.cancelEliminatingApplicants.bind(this);
    }

    componentDidMount() {
      this.changeYearTo(this.state.selectedYear, function() {
        if (ROLES.includes("applicant_voter")) {
          votingDataDocument.onSnapshot(function(doc) {
            const data = doc.data();
            if (data.active && !votingData.active) {
              // Voting Mode was just turned on. Start listening for polls.
              const unsubscribe = votingPollDocument.onSnapshot(function(doc) {
                const data = doc.data();

                if (user.uid in data && votingData.poll) {
                  return;
                }

                // Check if we are receiving poll results that we did not previously have.
                if (!this.state.previousPollResults && data.poll_results) {
                  this.setState({
                    previousPollResults: JSON.parse(data.poll_results)
                  });
                } else if (!data.poll_results) {
                  this.setState({
                    previousPollResults: null
                  });
                }
                
                if (data.poll_data && !(user.uid in data)) {
                  // Send our UID back to indicate that we have seen this poll.
                  votingPollDocument.update({
                    [user.uid]: [
                      user.profile.name,
                      false,
                      null
                    ]
                  });
                }

                // Update our own data to match this new poll.
                votingData.poll = data.poll_data;
  
                // If we are the current voting master and we are at step 0, it means we are either
                // at the beginning of the process (i.e., we have not sent out any polls yet), or we
                // reloaded the page.
                if (votingData.master[0] == user.uid && this.state.pollCreationStep == 0) {
                  // If there is poll data being presented, we need to re-subscribe to listen for
                  // poll responses.
                  if (data.poll_data) {
                    this.subscribeToPollResponses();
                  }
                  // If there are previous poll results, we want to show those results. We have to
                  // jump ahead to step 6 to do so.
                  if (data.poll_results) {
                    this.setState({
                      pollCreationStep: 6,
                      sharingPollResults: true // always true since the results are already being shared
                    });
                  }
                }
  
                this.onReceivePoll();
  
                // If we have already submitted, show our previous response.
                if (user.uid in data && data[user.uid][1]) {
                  if (this.state.selectingApplicants) {
                    this.setState({
                      pollSubmitted: true,
                      selectedApplicants: data[user.uid][2].split("|")
                    });
                  } else if (this.state.rankingApplicants) {
                    let originalOrdering = votingData.poll[1].split("|");
                    let ranking = data[user.uid][2].split("|");
                    let rankedApplicants = new Array(originalOrdering.length).fill().map((_, i) => i);

                    for (let i = 0, l = ranking.length; i < l; i++) {
                      let index = originalOrdering.indexOf(ranking[i]);
                      for (let j = rankedApplicants.indexOf(index, index); j > i; j--) {
                        rankedApplicants[j] = rankedApplicants[j - 1];
                      }
                      rankedApplicants[i] = index;
                    }
                    
                    this.setState({
                      pollSubmitted: true,
                      rankedApplicants: rankedApplicants
                    });
                  }
                }
              }.bind(this));
              this.setState({
                pollUnsubscribe: unsubscribe
              });
            } else if (!data.active && votingData.active && typeof this.state.pollUnsubscribe == "function") {
              // Voting Mode was just turned off. Unsubscribe from the snapshot listener from before.
              this.state.pollUnsubscribe();
            }
            votingData = {
              ...data,
              poll_receivers: []
            };
            this.onReceiveVotingData();
          }.bind(this));
        }
      }.bind(this));
    }

    render() {
      // We have the applicant's full ID. We want to separate that into year and ID number to make
      // it easier to used in ApplicantModal.
      let focusedYear, focusedID;
      if (this.state.applicantFocus) {
        let [year, id] = this.state.applicantFocus.split("-");
        focusedYear = +year + 2000;
        focusedID = parseInt(id, 16);
      }

      // Now we get the row index of that particular applicant so we can fetch its row later on.
      let rowIndex;
      if (this.state.applicantFocus) {
        const data = this.state.spreadsheetData;
        for (let i = data.rows.length - 1; i >= 0; i--) {
          if (parseInt(data.rows[i][data.c_ID], 16) == focusedID) {
            rowIndex = i;
          }
        }
      }

      return (
        <React.Fragment>
          <SearchBar
            // Data
            searchQuery={this.state.searchQuery}
            selectedYear={this.state.selectedYear}
            years={this.props.years}
            unbiasedMode={this.state.unbiasedMode}
            detailOption={this.state.detailOption}
            autoSharePollResults={this.state.autoSharePollResults}
            showSettings={this.state.showSettings}
            // Callbacks
            setAppState={this.setAppState}
            changeSearchQuery={this.changeSearchQuery}
            changeYearTo={this.changeYearTo}
            toggleSettingVisibility={this.toggleSettingVisibility}
            toggleVotingMode={this.toggleVotingMode}
            toggleUnbiasedMode={this.toggleUnbiasedMode}
            toggleAutoSharePollResults={this.toggleAutoSharePollResults}
            changeDetailOption={this.changeDetailOption}
          />
          <VotingModeControls
            // Data
            selectedApplicants={this.state.selectedApplicants}
            pollCreationStep={this.state.pollCreationStep}
            pollSubmitted={this.state.pollSubmitted}
            pollType={this.state.pollType}
            pollApplicants={this.state.pollApplicants}
            previousPollData={this.state.previousPollData}
            previousPollResults={this.state.previousPollResults}
            sharingPollResults={this.state.sharingPollResults}
            autoSharePollResults={this.state.autoSharePollResults}
            eliminatingApplicants={this.state.eliminatingApplicants}
            // Callbacks
            setAppState={this.setAppState}
            subscribeToPollResponses={this.subscribeToPollResponses}
            unsubscribeFromPollResponses={this.unsubscribeFromPollResponses}
            toggleApplicantSelection={this.toggleApplicantSelection}
            reloadSearchResults={this.reloadSearchResults}
            beginEliminatingApplicants={this.beginEliminatingApplicants}
            cancelEliminatingApplicants={this.cancelEliminatingApplicants}
            finishEliminatingApplicants={this.finishEliminatingApplicants}
          />
          <ApplicantTable
            // Data
            year={this.state.selectedYear}
            spreadsheetData={this.state.spreadsheetData}
            loading={this.state.loading}
            error={this.state.error}
            compactMode={this.state.compactMode}
            unbiasedMode={this.state.unbiasedMode}
            detailOption={this.state.detailOption}
            selectingApplicants={this.state.selectingApplicants}
            selectedApplicants={this.state.selectedApplicants}
            selectionDisabled={this.state.selectionDisabled}
            rankingApplicants={this.state.rankingApplicants}
            rankedApplicants={this.state.rankedApplicants}
            pollApplicants={this.state.pollApplicants}
            pollSubmitted={this.state.pollSubmitted}
            floatingRow={this.state.floatingRow}
            filteredRowIndices={this.state.filteredRowIndices}
            filteredRowMatchData={this.state.filteredRowMatchData}
            previousPollResults={this.state.previousPollResults}
            // Callbacks
            setAppState={this.setAppState}
            toggleApplicantSelection={this.toggleApplicantSelection}
            selectApplicant={this.selectApplicant}
            focusOnApplicant={this.focusOnApplicant}
            submitPollResponses={this.submitPollResponses}
            toggleRankingDrag={this.toggleRankingDrag}
            moveRankingRow={this.moveRankingRow}
          />
          <ApplicantModal
            // Data
            spreadsheetData={this.state.spreadsheetData}
            active={this.state.isFocusing}
            applicant={this.state.applicantFocus}
            year={focusedYear}
            id={focusedID}
            applicantRowIndex={rowIndex}
            unbiasedMode={this.state.unbiasedMode}
            // Callbacks
            unfocusApplicant={this.unfocusApplicant}
            setAppState={this.setAppState}
          />
        </React.Fragment>
      );
    }

    reloadSearchResults() {
      this.changeSearchQuery(this.state.searchQuery);
    }

    changeSearchQuery(e) {
      const originalQuery = typeof e == "string" ? e : e.currentTarget.value;
      let searchFilters = this.parseSearchQuery(originalQuery);
      let [filteredRowIndices, filteredRowMatchData] = this.filterApplicantRows(searchFilters);

      this.setState({
        searchQuery: originalQuery,
        filteredRowIndices: filteredRowIndices,
        filteredRowMatchData: filteredRowMatchData
      });
    }

    parseSearchQuery(query) {
      let filters = {
        id: null,
        status: null,
        words: null
      };

      query = query.toLowerCase().trim();

      // Check if the search query is just a status like "recipient" or "applicants". The "s" at the
      // end of the string is ignored so that "finalist" and "finalists" will both return finalists.
      let singular_query = query;
      if (query[query.length - 1] == "s") {
        singular_query = query.substring(0, query.length - 1);
      }
      if (~APPLICANT_STATUSES.indexOf(singular_query)) {
        query = "status:" + singular_query;
      }

      // Look for "status: "
      const statusMatch = query.match(SEARCH_QUERY_STATUS_REGEX);
      if (statusMatch) {
        // Remove the " status: " from the query and leave the rest alone.
        query = query.substring(0, statusMatch.index) + query.substring(statusMatch.index + statusMatch[0].length);
        // Match any status that begins with the specified string. This allows "status:f" for
        // example to filter only for "f"inalists. So does "status:fi" and "status:fin" and all the
        // way to "status:finalist" so that it gets filtered automatically while the person is still
        // typing it out.
        filters.status = APPLICANT_STATUSES.filter(status => status.indexOf(statusMatch[1]) == 0);
      }

      // Look for "#" to indicate an ID.
      const idMatch = query.match(SEARCH_QUERY_ID_REGEX);
      if (idMatch) {
        // Remove the matched part from the search query.
        query = query.substring(0, idMatch.index) + query.substring(idMatch.index + idMatch[0].length);
        // Get the year and corresponding ID number.
        // #2020-A -> year: 2020, ID: A
        // #21-B -> year: 2021, ID: B
        // #C -> year: [currentYear], ID: C
        let year, id;
        if (typeof idMatch[4] == "string") {
          year = this.state.selectedYear;
          id = parseInt(idMatch[4], 16);
        } else if (typeof idMatch[3] == "string") {
          year = this.state.selectedYear;
          id = parseInt(idMatch[3], 16);
        } else if (typeof idMatch[1] == "string" && typeof idMatch[2] == "string") {
          year = +idMatch[1]
          id = parseInt(idMatch[2], 16);
        }
        // Add 2000 to years any number below 2000 so that "#20" becomes "#2020".
        if (year < 2000) {
          year += 2000;
        }

        // Set the ID to the specified number (as long as it is an actual number).
        if (!isNaN(id)) {
          filters.id = id;
        }

        // If the specified year is different from the currently loaded year, we have to change it
        // to the specified year so that we're viewing the correct applicant.
        if (this.state.selectedYear != year) {
          this.changeYearTo(year);
        }
      }

      // Remove all outer whitespace so that we can cut up the rest of the query into words.
      query = query.trim();

      if (query.length) {
        const words = query
          // Break at every instance of whitespace.
          .split(/\s+/)
          // Only look at words with 2+ characters since 1 character does almost no filtering at all
          // unless it's something like "Z" or "Q" or "X".
          .filter(word => word.length > 1)
          // Sort longer words first. This makes searching slightly faster later on because longer
          // words are less likely to have a match, so false positives get filtered out earlier
          .sort((a, b) => b.length - a.length);
        filters.words = words;
      }

      return filters;
    }

    filterApplicantRows(filters) {
      let filteredIndices = [];
      let filterMatchData = [];

      const showNonMatches = this.state.rankingApplicants || this.state.selectingApplicants;

      const data = this.state.spreadsheetData;

      // If Voting Mode is enabled, we create the array of applicants to look through beforehand so
      // that we can remove any applicants not in that list.
      let filteredVotingApplicants = null;
      if (votingData.active) {
        filteredVotingApplicants = votingData.applicants.slice();
        if (votingData.poll) {
          let pollApplicants = votingData.poll[1].split("|");
          filteredVotingApplicants = filteredVotingApplicants.filter(
            applicant => ~pollApplicants.indexOf(applicant)
          );
        }
        // Sort in descending order according to ID so we only ever have to look at the last item.
        filteredVotingApplicants.sort((a, b) => parseInt(b, 16) - parseInt(a, 16));
      }

      // Go through all the words and look for matches in a set of fields.
      const searchableFields = this.state.unbiasedMode ?
        // Unbiased mode should only look through fields corresponding to non-personally identifying
        // information.
        ["College", "Location"] :
        // If unbiased mode is off, we can look through more fields.
        ["First", "Last", "Email", "College", "Location"];

      // Go through each row and find out if it needs to be filtered out.
      for (let i = 0, l = data.rows.length; i < l; i++) {
        const row = data.rows[i];
        let filterMatches = {};

        // If Voting Mode is enabled, we can remove applicants not included in the list of
        // finalists/recipients.
        if (filteredVotingApplicants) {
          if (filteredVotingApplicants[filteredVotingApplicants.length - 1] == row[data.c_ID]) {
            filteredVotingApplicants.pop();
          } else continue;
        }

        // Take out any applicants who are not the correct ID.
        if (filters.id !== null) {
          if (parseInt(row[data.c_ID], 16) == filters.id) {
            filterMatches.ID = true;
          } else if (showNonMatches) {
            filterMatches.ID = false;
          } else continue;
        }

        // Remove any applicants with the wrong status.
        if (filters.status !== null) {
          const rowStatus = ({
            [spreadsheetData.Enum.STATUS.APPLICANT]: "applicant",
            [spreadsheetData.Enum.STATUS.SECOND_READ]: "2nd read",
            [spreadsheetData.Enum.STATUS.FINALIST]: "finalist",
            [spreadsheetData.Enum.STATUS.RECIPIENT]: "recipient",
            [spreadsheetData.Enum.STATUS.INELIGIBLE]: "ineligible"
          })[row[data.c_Status]];
          if (~filters.status.indexOf(rowStatus)) {
            filterMatches.Status = true;
          } else if (showNonMatches) {
            filterMatches.Status = false;
          } else continue;
        }

        if (filters.words !== null) {
          // Get the column values beforehand so we don't have to do it for each word.
          let colValues = {};
          for (const col of searchableFields) {
            let value;
            try {
              value = row[data.c(col)];
              if (value == NA) continue;
            } catch (err) {
              continue;
            }

            value = formatters[col](value).toLowerCase();
            colValues[col] = value;
            filterMatches[col] = [];
          }

          let matchedAllWords = true;
          for (const word of filters.words) {
            let matchedWord = false;
            for (const col in colValues) {
              let value = colValues[col];

              let startIndex = 0;
              let index;

              // While we are able to find the search query word in this string.
              while (~(index = value.indexOf(word, startIndex))) {
                // Search through the ranges we have so far to identify if we can extend one, or we
                // need to add a new one.
                let inserted = false;
                for (let i = 0, l = filterMatches[col].length; i < l; i++) {
                  // If our match starts somewhere before this range ends, it means we can insert it
                  // into the list somewhere or extend a previous range we have.
                  if (index <= filterMatches[col][i][1]) {
                    inserted = true;
                    // Our match does not intersect with a current range; we have to insert it into
                    // the list as a new range.
                    if (index + word.length < filterMatches[col][i][0]) {
                      filterMatches[col].splice(i, 0, [index, index + word.length]);
                    } else {
                      // Modify this existing range to incorporate our new match.
                      filterMatches[col][i][0] = Math.min(index, filterMatches[col][i][0]);
                      filterMatches[col][i][1] = Math.max(index + word.length, filterMatches[col][i][1]);

                      // Now we have to check if the ranges after this ALSO intersect.
                      let spliceAmt = 0;
                      while (i + 1 + spliceAmt < filterMatches[col].length && filterMatches[col][i + 1 + spliceAmt][0] <= index + word.length) {
                        filterMatches[col][i][1] = Math.max(index + word.length, filterMatches[col][i + 1 + spliceAmt][1]);
                        spliceAmt++;
                      }
                      // Splice out elements manually instead of using splice (performs slightly
                      // faster in some browsers since no new array is created/returned).
                      for (let j = i + 1, m = filterMatches[col].length - spliceAmt; j < m; j++) {
                        filterMatches[col][j] = filterMatches[col][j + spliceAmt];
                      }
                      filterMatches[col].length -= spliceAmt;
                    }
                    break;
                  }
                }
                if (!inserted) {
                  // We could not insert the range earlier; we have to add a new one to the end.
                  filterMatches[col].push([index, index + word.length]);
                }

                // Modify start index so we can look everywhere after in the string.
                startIndex = index + 1;
                // Set the matchedWord flag to true to indicate that this word has been matched.
                matchedWord = true;
              }
            }

            // If the word was not matched, this row should be filtered out; no need to keep looking
            // at the next words.
            if (!matchedWord) {
              matchedAllWords = false;
              if (!showNonMatches) break;
            }
          }

          // If at least one word form the search query was not matched, we filter this row out.
          if (!matchedAllWords && !showNonMatches) {
            continue;
          }
        }

        filteredIndices.push(i);
        filterMatchData.push(filterMatches);
      }

      return [filteredIndices, filterMatchData];
    }

    changeYearTo(year, callback_resolved, callback_rejected) {
      if (!(year in spreadsheetData)) {
        return;
      }

      callback_resolved = typeof callback_resolved == "function" ? callback_resolved : function() {};
      callback_rejected = typeof callback_rejected == "function" ? callback_rejected : function() {};

      this.setState({
        selectedYear: +year,
        loading: true
      });

      function resolved(spreadsheet) {
        this.setState({
          spreadsheetData: spreadsheet,
          filteredRowIndices: [],
          filteredRowMatchData: [],
          error: null,
          loading: false
        }, this.reloadSearchResults);
        callback_resolved(spreadsheet);
      }
      function rejected(err) {
        if (err.result.error.status == "PERMISSION_DENIED") {
          this.setState({
            error: (
              <React.Fragment>
                Your account does not have viewing permission for this year's Google Sheet.
                Try viewing the spreadsheet using the button below, and request permission.
                <a
                  href={`https://docs.google.com/spreadsheets/d/${spreadsheetData[year].id}/view`}
                  id="open_spreadsheet"
                  className="button"
                  target="_blank"
                >
                  View Spreadsheet
                </a>
              </React.Fragment>
            ),
            loading: false
          });
        } else {
          this.setState({
            error: "There was an unknown problem getting this year's applicant data.",
            loading: false
          });
          callback_rejected(err);
        }
      }

      if (year in this.state.loadedYears) {
        if (this.state.loadedYears[year].loaded) {
          resolved.call(this, this.state.loadedYears[year].data);
        } else {
          rejected.call(this, this.state.loadedYears[year].error);
        }
      } else {
        // Get the spreadsheet data
        new Promise(function(resolve, reject) {
          // Fetch the spreadsheet data from Google Sheets and save it to memory.
          gapiLoaded.then(function() {
            return gapi.client.sheets.spreadsheets.values.get({
              spreadsheetId: spreadsheetData[year].id,
              range: spreadsheetData[year].sheet
            }).then(function(e) {
              let rows = e.result.values;
              const headers = rows.shift();

              // Function that returns the index in the row that has the given colName.
              function colIndex(colName) {
                // Convert a column name into whatever that colum nis named in the header.
                const mapping = colName in spreadsheetData[year].mapping ? spreadsheetData[year].mapping[colName] : colName;
                const index = headers.indexOf(mapping);
                // If this column is missing or the column wasn't found at all, throw an error to
                // indicate that.
                if (mapping == MISSING_FIELD || !~index) {
                  throw new RangeError(`No column with name "${colName}".`);
                } else {
                  return index;
                }
              };

              // Make sure each row has the same number of columns as the header
              for (let i = rows.length - 1; i >= 0; i--) {
                const addCells = headers.length - rows[i].length;
                if (addCells) {
                  rows[i] = rows[i].concat(new Array(addCells).fill(""));
                }
              }

              // Google Sheets stores the data as strings. Use the translators to convert those
              // strings into the JavaScript values we expect.
              const translators = spreadsheetData[year].translate.from;
              for (const key in translators) {
                const index = colIndex(key);
                for (const row of rows) {
                  row[index] = translators[key](row[index].trim());
                }
              }

              const data = {
                c: colIndex,
                c_ID: colIndex("ID"), // Pre-get the column with IDs since we use it so often
                c_First: colIndex("First"), // Same for first name
                c_Last: colIndex("Last"), // And last name
                c_Status: colIndex("Status"), // And status
                headers: headers,
                rows: rows
              };

              // Save the data to memory so we can get it later without querying Google Sheets.
              this.state.loadedYears[year] = {
                loaded: true,
                data: data
              };

              resolve(data);
            }.bind(this), function(err) {
              // There was an error, we should reject and save the error to reference again later.
              this.state.loadedYears[year] = {
                loaded: false,
                error: err
              };
              reject(err);
            }.bind(this));
          }.bind(this));
        }.bind(this)).then(resolved.bind(this), rejected.bind(this));
      }
    }

    focusOnApplicant(id) {
      let year = +id.split("-")[0] + 2000;
      if (isNaN(year)) {
        return;
      }
      this.changeYearTo(year, function() {
        this.setState({
          isFocusing: true,
          applicantFocus: id
        });
      }.bind(this));
    }

    unfocusApplicant() {
      this.setState({
        isFocusing: false,
        applicantFocus: null
      });
    }

    toggleSettingVisibility(shown) {
      if (this.state.showSettings != shown) {
        this.setState({
          showSettings: shown
        });
      }
    }

    toggleVotingMode(value) {
      let applicants = null;
      if (value) {
        const data = this.state.spreadsheetData;
        applicants = [];
        for (const row of data.rows) {
          if (row[data.c_Status] == spreadsheetData.Enum.STATUS.FINALIST || row[data.c_Status] == spreadsheetData.Enum.STATUS.RECIPIENT) {
            applicants.push(row[data.c_ID]);
          }
        }
        this.setState({
          pollCreationStep: 0
        });
      }
      votingPollDocument.set({
        poll_data: null
      });
      votingDataDocument.update({
        active: value,
        year: value ? this.state.selectedYear : null,
        master: value ? [user.uid, user.profile.name] : null,
        applicants: applicants,
        eliminated: []
      });
    }

    toggleAutoSharePollResults(value) {
      let now = new Date();
      now.setFullYear(now.getFullYear() + 10);
      document.cookie = `applicants-auto_share_poll_results=${value};expires=${now.toUTCString()}`;
      cookies["applicants-auto)share_poll_results"] = `${value}`;
      this.setState({
        autoSharePollResults: value
      });
    }

    onReceiveVotingData() {
      if (votingData.active && this.state.selectedYear != votingData.year) {
        this.changeYearTo(votingData.year);
      }

      this.setState({
        unbiasedMode: votingData.active || cookies["applicants-unbiased_mode"] == "true"
      }, this.reloadSearchResults);
    }

    onReceivePoll() {
      if (votingData.poll) {
        if (votingData.poll[0] == "selection") {
          if (!this.state.selectingApplicants) this.toggleApplicantSelection(true);
        } else {
          if (!this.state.rankingApplicants) this.toggleApplicantRanking(true);
        }

        this.setState({
          pollApplicants: votingData.poll[1].split("|"),
          pollType: votingData.poll[0],
          pollSubmitted: false,
          previousPollData: [votingData.poll[0], votingData.poll[1].split("|"), votingData.poll[2]]
        });
        this.reloadSearchResults();
      } else {
        if (this.state.selectingApplicants) this.toggleApplicantSelection(false);
        if (this.state.rankingApplicants) this.toggleApplicantRanking(false);
        this.setState({
          pollApplicants: [],
          pollType: null,
          pollSubmitted: false
        }, this.reloadSearchResults);
      }
    }

    toggleUnbiasedMode(value) {
      let now = new Date();
      now.setFullYear(now.getFullYear() + 10);
      document.cookie = `applicants-unbiased_mode=${value};expires=${now.toUTCString()}`;
      cookies["applicants-unbiased_mode"] = `${value}`;
      this.setState({
        unbiasedMode: value
      }, function() {
        this.changeSearchQuery(this.state.searchQuery)
      }.bind(this));
    }

    changeDetailOption(value) {
      let now = new Date();
      now.setFullYear(now.getFullYear() + 10);
      document.cookie = `applicants-details=${value};expires=${now.toUTCString()}`;
      cookies["applicants-details"] = `${value}`;
      this.setState({
        detailOption: value
      });
    }

    toggleApplicantSelection(value) {
      this.setState({
        selectingApplicants: value,
        selectedApplicants: value ? this.state.selectedApplicants : [],
        selectionDisabled: value ? this.state.selectionDisabled : false,
        rankingApplicants: value ? false : this.state.rankingApplicants
      });
    }

    toggleApplicantRanking(value) {
      this.setState({
        rankingApplicants: value,
        rankedApplicants: value ?
          this.state.rankedApplicants.length ?
            this.state.rankedApplicants :
            new Array(votingData.poll[1].split("|").length).fill(0).map((_, i) => i) :
          [],
        selectingApplicants: value ? false : this.state.selectingApplicants
      });
    }

    selectApplicant(e) {
      e.stopPropagation();
      const ID = e.currentTarget.parentNode.getAttribute("data-applicant-id").split("-")[1];
      const index = this.state.selectedApplicants.indexOf(ID);
      if (~index) {
        this.state.selectedApplicants.splice(index, 1);
        this.setState({
          selectionDisabled: false
        });
      } else {
        // We don't want to select this applicant if there is already the maximum number selected.
        if (votingData.poll && this.state.selectedApplicants.length >= votingData.poll[2]) {
          return;
        }
        this.state.selectedApplicants.push(ID);
        this.setState({
          selectionDisabled: votingData.poll && this.state.selectedApplicants.length >= votingData.poll[2]
        });
      }
      this.forceUpdate();
    }

    subscribeToPollResponses() {
      // Unsubscribe first if there is an option to.
      this.unsubscribeFromPollResponses();
      // Wait for updates to the poll document.
      const unsubscribe = votingPollDocument.onSnapshot(function(doc) {
        const data = doc.data();
        votingData.poll_responses = data;

        // Get the list of people who have received the poll.
        let receivers = [];
        for (const key in data) {
          // Ignore the "poll_data" key, plus our own UID
          if (key == "poll_data" || key == user.uid) {
            continue;
          }
          receivers.push([key, ...data[key]]);
        }
        votingData.poll_receivers = receivers;

        this.forceUpdate();
      }.bind(this));

      // Go to the step where we can see who has received the poll.
      this.setState({
        pollCreationStep: 5,
        receiverUnsubscribe: unsubscribe
      });
    }

    unsubscribeFromPollResponses() {
      if (typeof this.state.receiverUnsubscribe == "function") {
        this.state.receiverUnsubscribe();
        this.setState({
          receiverUnsubscribe: null
        });
      }
    }

    submitPollResponses() {
      if (votingData.poll[0] == "selection") {
        votingPollDocument.update({
          [user.uid]: [
            user.profile.name,
            true,
            this.state.selectedApplicants.join("|")
          ]
        });
        this.setState({
          pollSubmitted: true
        });
      } else {
        votingPollDocument.update({
          [user.uid]: [
            user.profile.name,
            true,
            this.state.rankedApplicants.slice(0, votingData.poll[2]).map(index => this.state.pollApplicants[index]).join("|")
          ]
        });
        this.setState({
          pollSubmitted: true
        });
      }
    }

    toggleRankingDrag(active, props, rowID, coords, initCoords, rowIndex, rowElement, touchID) {
      if (active) {
        document.addEventListener("mouseup", this.handler_rankingPointerup);
        document.addEventListener("mousemove", this.handler_rankingMousemove);
        document.addEventListener("touchend", this.handler_rankingTouchend);
        document.addEventListener("touchcancel", this.handler_rankingTouchend);
        document.addEventListener("touchmove", this.handler_rankingTouchmove, {passive: false});
        document.documentElement.setAttribute("data-is-dragging", "true");

        this.setNestedState({
          floatingRow: {
            ID: rowID,
            props: props,
            active: true,
            coords: coords,
            initCoords: initCoords,
            rowIndex: rowIndex,
            origElement: rowElement,
            rankingIndex: this.state.rankedApplicants.indexOf(rowIndex),
            touchID: touchID
          }
        }, 2);
      } else {
        document.removeEventListener("mouseup", this.handler_rankingPointerup);
        document.removeEventListener("mousemove", this.handler_rankingMousemove);
        document.removeEventListener("touchend", this.handler_rankingTouchend);
        document.removeEventListener("touchcancel", this.handler_rankingTouchend);
        document.removeEventListener("touchmove", this.handler_rankingTouchmove, {passive: false});
        document.documentElement.setAttribute("data-is-dragging", "false");

        this.setNestedState({
          floatingRow: {
            ID: null,
            props: null,
            active: false,
            coords: null,
            initCoords: null,
            rowIndex: null,
            origElement: null,
            rankingIndex: null,
            mouseMoveTimeout: null,
            mouseMoveYPos: null,
            touchID: touchID
          }
        });
      }
    }

    handler_rankingPointerup() {
      if (this.state.floatingRow.mouseMoveTimeout) {
        clearTimeout(this.state.floatingRow.mouseMoveTimeout);
        this.handleFloatingRowMoveTimeout();
      }
      this.toggleRankingDrag(false);
    }

    handler_rankingTouchend(e) {
      let touch = false;
      for (const changedTouch of e.changedTouches) {
        if (changedTouch.identifier == this.state.floatingRow.touchID) {
          touch = changedTouch;
          break;
        }
      }
      if (!touch) {
        return;
      }
      this.handler_rankingPointerup();
    }

    handler_rankingMousemove(e) {
      this.handleFloatingRowMove(e.pageX, e.pageY);
    }

    handler_rankingTouchmove(e) {
      let touch = false;
      for (const changedTouch of e.changedTouches) {
        if (changedTouch.identifier == this.state.floatingRow.touchID) {
          touch = changedTouch;
          break;
        }
      }
      if (!touch) {
        return;
      }
      e.preventDefault();
      this.handleFloatingRowMove(touch.pageX, touch.pageY);
    }

    handleFloatingRowMove(x, y) {
      this.state.floatingRow.ref.current.style.left = `${x - this.state.floatingRow.coords[0]}px`;
      this.state.floatingRow.ref.current.style.top = `${y - this.state.floatingRow.coords[1]}px`;

      this.state.floatingRow.mouseMoveYPos = y;

      // Instead of figuring out where the row is supposed to go right now, we create a 100-ms time-
      // out. This will run the code asynchronously so that it will only run once other important
      // stuff has finished happening. It also allows multiple move events to be clumped together if
      // they happen quickly one after the other. Since this waits a few milliseconds before making
      // React re-render the UI, it can make it look a little slow, but it also saves some computa-
      // tion power by lumping multiple together, which would make the UI look somewhat laggy any-
      // way, so not much can be done there.
      if (!this.state.floatingRow.mouseMoveTimeout) {
        this.state.floatingRow.mouseMoveTimeout = setTimeout(this.handleFloatingRowMoveTimeout.bind(this), 0);
      }
    }

    handleFloatingRowMoveTimeout() {
      if (this.state.floatingRow.mouseMoveYPos === null) {
        return;
      }
      this.state.floatingRow.mouseMoveTimeout = null;
      let y = this.state.floatingRow.mouseMoveYPos;
      this.state.floatingRow.mouseMoveYPos = null;

      let elemHeight = this.state.floatingRow.origElement.offsetHeight;

      let pxOffset = y - this.state.floatingRow.coords[1] - this.state.floatingRow.initCoords[1];
      let rowOffset = Math.round(pxOffset / elemHeight);

      let startIndex = this.state.floatingRow.rankingIndex;
      // Calculate where this row's new index should be.
      let newIndex = startIndex + rowOffset;

      // The minimum index is 0, so we have to adjust if our calculated index is less than that.
      if (newIndex < 0) {
        rowOffset = -startIndex;
        newIndex = 0;
      }
      // The maximum index is length - 1, so we have to adjust if our calculated index is greater
      // than that.
      if (newIndex >= this.state.filteredRowIndices.length) {
        rowOffset = this.state.filteredRowIndices.length - 1 - startIndex;
        newIndex = this.state.filteredRowIndices.length - 1;
      }

      // If rowOffset is 0, we don't need to move any rows around.
      if (rowOffset == 0) {
        return;
      }

      // If the row is already at the top or bottom, do nothing.
      if (newIndex < 0 || newIndex >= this.state.filteredRowIndices.length) {
        return;
      }

      this.state.floatingRow.rankingIndex = newIndex;

      // Check if we need to move this row forwards or backwards.
      if (rowOffset > 0) {
        // We need to move this row forwards, which means we need to move any rows between its orig-
        // inal position and its new position backwards to fill that gap.
        for (let i = 0; i < rowOffset; i++) {
          this.state.rankedApplicants[startIndex + i] = this.state.rankedApplicants[startIndex + i + 1];
        }
      } else {
        // We need to move this row backwards, so we repeat the process for above, but in the oppo-
        // site direction.
        for (let i = 0; i < -rowOffset; i++) {
          this.state.rankedApplicants[startIndex - i] = this.state.rankedApplicants[startIndex - i - 1];
        }
      }

      this.state.floatingRow.props.rank = newIndex < votingData.poll[2] ? newIndex + 1 : "—";

      this.state.rankedApplicants[newIndex] = this.state.floatingRow.rowIndex;
      this.state.floatingRow.initCoords[1] += elemHeight * rowOffset;
      this.forceUpdate();
    }

    moveRankingRow(direction, rowIndex) {
      let startIndex = this.state.rankedApplicants.indexOf(rowIndex);
      if (direction == "UP" && startIndex > 0) {
        [this.state.rankedApplicants[startIndex], this.state.rankedApplicants[startIndex - 1]] =
          [this.state.rankedApplicants[startIndex - 1], this.state.rankedApplicants[startIndex]];
      } else if (direction == "DOWN" && startIndex < this.state.rankedApplicants.length - 1) {
        [this.state.rankedApplicants[startIndex], this.state.rankedApplicants[startIndex + 1]] =
          [this.state.rankedApplicants[startIndex + 1], this.state.rankedApplicants[startIndex]];
      }
      this.forceUpdate();
    }

    beginEliminatingApplicants() {
      this.setState({
        eliminatingApplicants: true
      });
      this.toggleApplicantSelection(true);
    }

    finishEliminatingApplicants() {
      let applicants = votingData.applicants;
      let eliminated = votingData.eliminated;
      for (const applicant of this.state.selectedApplicants) {
        let index = applicants.indexOf(applicant);
        if (~index) {
          eliminated.push(...applicants.splice(index, 1));
        }
      }
      votingDataDocument.update({
        applicants: applicants,
        eliminated: eliminated
      });
      this.cancelEliminatingApplicants();
    }

    cancelEliminatingApplicants() {
      this.setState({
        eliminatingApplicants: false
      });
      this.toggleApplicantSelection(false);
    }
  }

  class SearchBar extends PureComponent {
    constructor(props) {
      // Fill in the <select> with one <option> per year.
      for (let i = props.years.length - 1; i >= 0; i--) {
        props.years[i] = <option key={props.years[i]}>{props.years[i]}</option>
      }
      super(props);
      this.changeYear = this.changeYear.bind(this);
    }

    render() {
      return <div id="search_bar">
        <input value={this.props.searchQuery} placeholder="Search Applicants" onChange={this.props.changeSearchQuery}/>
        <select value={this.props.selectedYear} onChange={this.changeYear} disabled={votingData.active}>{this.props.years}</select>
        <Options
          shown={this.props.showSettings}
          unbiasedMode={this.props.unbiasedMode}
          detailOption={this.props.detailOption}
          autoSharePollResults={this.props.autoSharePollResults}
          toggleSettingVisibility={this.props.toggleSettingVisibility}
          toggleVotingMode={this.props.toggleVotingMode}
          toggleUnbiasedMode={this.props.toggleUnbiasedMode}
          toggleAutoSharePollResults={this.props.toggleAutoSharePollResults}
          changeDetailOption={this.props.changeDetailOption}
        />
      </div>
    }

    changeYear(e) {
      this.props.changeYearTo(e.currentTarget.value);
    }
  }

  class Options extends PureComponent {
    constructor(props) {
      super(props);

      this.toggleSettingVisibility = this.toggleSettingVisibility.bind(this);
      this.toggleVotingMode = this.toggleVotingMode.bind(this);
      this.toggleUnbiasedMode = this.toggleUnbiasedMode.bind(this);
      this.changeDetailOption = this.changeDetailOption.bind(this);
      this.toggleAutoSharePollResults = this.toggleAutoSharePollResults.bind(this);
    }

    render() {
      return (
        <div id="options" onClick={e => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={this.props.shown}
            onChange={this.toggleSettingVisibility}
          />
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor">
            <path d="M496.647,312.107l-47.061-36.8c1.459-12.844,1.459-25.812,0-38.656l47.104-36.821c8.827-7.109,11.186-19.575,5.568-29.419l-48.96-84.629c-5.639-9.906-17.649-14.232-28.309-10.197l-55.467,22.315c-10.423-7.562-21.588-14.045-33.323-19.349l-8.512-58.923c-1.535-11.312-11.24-19.72-22.656-19.627h-98.133c-11.321-0.068-20.948,8.246-22.528,19.456l-8.533,59.093c-11.699,5.355-22.846,11.843-33.28,19.371L86.94,75.563c-10.55-4.159-22.549,0.115-28.096,10.005L9.841,170.347c-5.769,9.86-3.394,22.463,5.568,29.547l47.061,36.8c-1.473,12.843-1.473,25.813,0,38.656l-47.104,36.8c-8.842,7.099-11.212,19.572-5.589,29.419l48.939,84.651c5.632,9.913,17.649,14.242,28.309,10.197l55.467-22.315c10.432,7.566,21.604,14.056,33.344,19.371l8.533,58.88c1.502,11.282,11.147,19.694,22.528,19.648h98.133c11.342,0.091,21-8.226,22.592-19.456l8.533-59.093c11.698-5.357,22.844-11.845,33.28-19.371l55.68,22.379c10.55,4.149,22.543-0.122,28.096-10.005l49.152-85.12C507.866,331.505,505.447,319.139,496.647,312.107z M255.964,362.667c-58.91,0-106.667-47.756-106.667-106.667s47.756-106.667,106.667-106.667s106.667,47.756,106.667,106.667C362.56,314.882,314.845,362.597,255.964,362.667z"/>
          </svg>
          <div id="options_window">
            {
              IS_VOTING_MASTER ?
                <React.Fragment>
                  <div className="option_row">
                    <span className="option_name">Voting Mode</span>
                    <span className="spacer"></span>
                    <span className="option_value">
                    <input
                      type="checkbox"
                      className="toggler"
                      checked={votingData.active}
                      disabled={votingData.active && votingData.master[0] !== user.uid}
                      onChange={this.toggleVotingMode}
                    />
                    <span></span>
                    </span>
                  </div>
                  <div className="option_desc">Lets you send out voting polls to other voters.</div>
                  {
                    votingData.active && votingData.master[0] != user.uid ? 
                      <div className="option_desc option_alert">Voting Mode must be disabled by {votingData.master[1]}.</div> :
                      null
                  }
                </React.Fragment> : null
            }
            {
              votingData.active && votingData.master[0] == user.uid ?
              <React.Fragment>
                  <div className="option_row">
                    <span className="option_name">Auto-Share Poll Results</span>
                    <span className="spacer"></span>
                    <span className="option_value">
                    <input
                      type="checkbox"
                      className="toggler"
                      checked={this.props.autoSharePollResults}
                      onChange={this.toggleAutoSharePollResults}
                    />
                    <span></span>
                    </span>
                  </div>
                  <div className="option_desc">Automatically shares poll results with other voters.</div>
                </React.Fragment> : null
            }
            <div className="option_row">
              <span className="option_name">Unbiased Mode</span>
              <span className="spacer"></span>
              <span className="option_value">
                <input
                  type="checkbox"
                  className="toggler"
                  checked={this.props.unbiasedMode}
                  disabled={votingData.active}
                  onChange={this.toggleUnbiasedMode}
                />
                <span></span>
              </span>
            </div>
            <div className="option_desc">
              Hides personally identifying information to prevent bias.
            </div>
            {
              votingData.active ?
              <div className="option_desc option_alert">
                Unbiased Mode cannot be turned off while voting.
              </div>
              : null
            }
            <div className="option_row">
              <span className="option_name">Details</span>
              <span className="spacer"></span>
              <span className="option_value">
                <select
                  value={this.props.detailOption}
                  onChange={this.changeDetailOption}
                >
                  <option>Icons</option>
                  <option>#ID</option>
                  <option>None</option>
                </select>
              </span>
            </div>
            <div className="option_desc">
              Which details to show on the right-hand side of each applicant.
            </div>
          </div>
        </div>
      );
    }

    toggleSettingVisibility(e) {
      this.props.toggleSettingVisibility(e.currentTarget.checked);
    }

    toggleVotingMode(e) {
      this.props.toggleVotingMode(e.currentTarget.checked);
    }

    toggleAutoSharePollResults(e) {
      this.props.toggleAutoSharePollResults(e.currentTarget.checked);
    }

    toggleUnbiasedMode(e) {
      this.props.toggleUnbiasedMode(e.currentTarget.checked);
    }

    changeDetailOption(e) {
      this.props.changeDetailOption(e.currentTarget.value);
    }
  }

  class ApplicantTable extends Component {
    constructor(props) {
      super(props);
    }

    render() {
      const legend = (
        <div id="applicant_status_legend">
          <div>
            <div>
              <div className="applicant_status applicant_status_applicant">A</div>
              <span>Applicant</span>
            </div>
            <div>
              <div className="applicant_status applicant_status_2nd_read">2</div>
              <span>2nd Read</span>
            </div>
            <div>
              <div className="applicant_status applicant_status_finalist">F</div>
              <span>Finalist</span>
            </div>
            <div>
              <div className="applicant_status applicant_status_recipient">R</div>
              <span>Recipient</span>
            </div>
            <div>
              <div className="applicant_status applicant_status_ineligible">I</div>
              <span>Ineligible</span>
            </div>
          </div>
        </div>
      );

      let preMessage = [];
      if (votingData.active && user.uid != votingData.master[0]) {
        preMessage.push(<p key="voting mode">Voting Mode was turned on by {votingData.master[1]}. Personally identifying information is hidden and only finalists from this year are being shown.</p>);
      } else if  (this.props.unbiasedMode) {
        preMessage.push(<p key="unbiased mode">Unbiased Mode is enabled. Names and other personally identifying information have been hidden.</p>);
      }

      if (votingData.poll) {
        preMessage.push(
          <React.Fragment key="poll submit">
            <p>
              {
                this.props.pollSubmitted ? 
                  "Thank you for submitting your response. You can change your answers (and Resubmit when you're done) until the poll is closed." :
                  votingData.poll[0] == "selection" ?
                    `Please select the top ${votingData.poll[2] == 1 ? "applicant" : `${votingData.poll[2]} applicants`} from the list below and click Submit when you're done. Click the squares on the left of each applicant to select and unselect them.` :
                    `Please rank the top ${votingData.poll[2] == 1 ? "applicant" : `${votingData.poll[2]} applicants`} from the list below and click Submit when you're done. Drag the applicants in the order you want (or use the arrows when you hover over them).`
              }
            </p>
            <button
              disabled={!this.props.rankingApplicants && this.props.selectedApplicants.length != votingData.poll[2]}
              className="poll_ready"
              onClick={this.props.submitPollResponses}
            >{
              this.props.pollSubmitted ?
              "Resubmit" :
              "Submit"
            }</button>
          </React.Fragment>
        );
      }

      if (this.props.previousPollResults && votingData.master[0] != user.uid) {
        preMessage.push(
          <React.Fragment key="poll results">
            <p>{votingData.master[1]} is sharing the results of the previous poll:</p>
            <div className="poll_res">
              <div className="poll_res_container">
                {
                  this.props.previousPollResults.map(result => (
                    <div key={result[0]} className="poll_res_col">
                      <div className="poll_res_bar">
                        <div style={{flexGrow: 1 - result[1]}}>
                          <span className={result[1] >= .5 ? "hidden" : ""}>
                            {result[2]}  
                          </span>
                        </div>
                        <div style={{flexGrow: result[1]}}>
                          <span className={result[1] >= .5 ? "" : "hidden"}>
                            {result[2]}  
                          </span>
                        </div>
                      </div>
                      <div className="poll_res_name">#{result[0]}</div>
                    </div>
                  ))
                }
              </div>
            </div>
          </React.Fragment>
        );
      }

      // If we are loading applicants, show a loading message without doing anything else.
      if (this.props.loading) {
        return (
          <React.Fragment>
            <div id="pre_applicant_message" className={preMessage.length ? "" : "hidden"}>{preMessage}</div>
            <div id="applicant_table" className={this.props.compactMode ? "compact" : ""}>
              <div id="applicant_message">
                Loading Applicant Data...
              </div>
            </div>
            {legend}
          </React.Fragment>
        );
      }

      // If there was an error, show that error without doing anything else.
      if (this.props.error !== null) {
        return (
          <React.Fragment>
            <div id="pre_applicant_message" className={preMessage.length ? "" : "hidden"}>{preMessage}</div>
            <div id="applicant_table" className={this.props.compactMode ? "compact" : ""}>
              <div id="applicant_error">
                {this.props.error}
              </div>
            </div>
            {legend}
          </React.Fragment>
        );
      }

      const data = this.props.spreadsheetData;

      const pollApplicants = this.props.rankingApplicants ? votingData.poll[1].split("|") : null;
      
      let rowComponentProps = new Array(data.rows.length);
      let rowsToSwap = [];
      for (let i = 0, l = data.rows.length; i < l; i++) {
        const row = data.rows[i];
        const filteredIndex = this.props.filteredRowIndices.indexOf(i);
        const filteredBy = this.props.filteredRowMatchData[filteredIndex] || {};

        let rank = "";
        if (this.props.rankingApplicants) {
          let pollAppIndex;
          if (~(pollAppIndex = pollApplicants.indexOf(data.rows[i][data.c_ID]))) {
            rank = (this.props.rankedApplicants.indexOf(rowsToSwap.length) + 1);
            if (rank > votingData.poll[2]) {
              rank = "—";
            } else {
              rank = rank.toString();
            }
            pollApplicants[pollAppIndex] = pollApplicants[pollApplicants.length - 1];
            pollApplicants.pop();
            rowsToSwap.push(i);
          }
        }

        // Instead of making the component, we just make the props so that we can still modify the
        // props after this loop and then make the component later.
        rowComponentProps[i] = {
          key: row[data.c_ID],
          year: this.props.year,
          row: row,
          data: data,
          filteredIndex: filteredIndex,
          hidden: !~filteredIndex,
          isFirstFiltered: false,
          isLastFiltered: false,
          unbiasedMode: this.props.unbiasedMode,
          detailOption: this.props.detailOption,
          selectable: this.props.selectingApplicants,
          selected: this.props.selectedApplicants.includes(row[data.c_ID]),
          selectionDisabled: this.props.selectionDisabled,
          rankable: this.props.rankingApplicants,
          rank: rank,
          filteringByStatus: filteredBy.Status,
          filteringByID: filteredBy.ID,
          filteredBy: filteredBy,
          floatingRow: this.props.floatingRow
        };
      }

      if (rowsToSwap.length) {
        // If we are ranking applicants, we need to swap some rows to show the correct ordering. When
        // we swap around rows, we also need to swap their border-radius values a row might appear
        // in a different spot and have different neighbors that require it to have a different
        // border-radius.
        let rowsToSwapComponents = rowsToSwap.map(rowIndex => rowComponentProps[rowIndex]);
        for (let i = 0, l = rowsToSwap.length; i < l; i++) {
          let otherIndex = this.props.rankedApplicants.indexOf(i);
          // Swap the row.
          rowComponentProps[rowsToSwap[otherIndex]] = rowsToSwapComponents[i];
        }

        rowComponentProps[rowsToSwap[0]].isFirstFiltered = true;
        rowComponentProps[rowsToSwap[rowsToSwap.length - 1]].isLastFiltered = true;
      }

      // Keeps track of which rows need to have a border-radius set on their top and bottom. Rows
      // with a different status as its neighbor has a different color, and gets a border-radius
      // applied to it.
      for (let i = 0, l = this.props.filteredRowIndices.length; i < l; i++) {
        let currIndex = this.props.filteredRowIndices[i];
        let currStatus = rowComponentProps[currIndex].row[data.c_Status];
        rowComponentProps[currIndex].borderRadiusTop = i == 0 || currStatus != rowComponentProps[this.props.filteredRowIndices[i - 1]].row[data.c_Status];
        rowComponentProps[currIndex].borderRadiusBottom = i + 1 >= l || currStatus != rowComponentProps[this.props.filteredRowIndices[i + 1]].row[data.c_Status];
      }

      let rowComponents = rowComponentProps.map(props =>
        <ApplicantRow
          {...props}
          selectApplicant={this.props.selectApplicant}
          focusOnApplicant={this.props.focusOnApplicant}
          toggleRankingDrag={this.props.toggleRankingDrag}
          moveRankingRow={this.props.moveRankingRow}
        />);

      let floatingRow = <FloatingRow
        floatingRow={this.props.floatingRow}
      />;

      return (
        <React.Fragment>
          <div id="pre_applicant_message" className={preMessage.length ? "" : "hidden"}>{preMessage}</div>
          <div id="applicant_table"  className={(
            this.props.compactMode ? " compact" : ""
          ) + (
            this.props.unbiasedMode ? " unbiased" : ""
          )}>
            {
              votingData.active ? 
                votingData.applicants.length ?
                  null :
                  <div className="num_results">
                    <span>All applicants have been eliminated.</span>
                  </div> :
                <div className="num_results">
                  <span>
                    Showing <span className="applicant_num">
                      {
                        this.props.filteredRowIndices.length
                      } {
                        this.props.filteredRowIndices.length == this.props.spreadsheetData.rows.length ?
                        "applicant" :
                        "result"
                      }{
                        this.props.filteredRowIndices.length == 1 ? "" : "s"
                      }
                    </span>
                  </span>
                </div>
            }
            {rowComponents}
            {floatingRow}
          </div>
          {legend}
        </React.Fragment>
      );
    }
  }

  class ApplicantRow extends Component {
    constructor(props) {
      super(props);

      this.state = {
        touchID: null,
        pointerDown: false,
        pointerStartPos: null,
        pointerStartElement: null,
        pointerDownTimeout: null,
        isBeingDragged: false
      };

      this.initRankingDrag = this.initRankingDrag.bind(this);
      this.attemptFocusOnApplicant = this.attemptFocusOnApplicant.bind(this);
      this.handler_rankingMousedown = this.handler_rankingMousedown.bind(this);
      this.handler_rankingTouchstart = this.handler_rankingTouchstart.bind(this);
    }

    render() {
      const row = this.props.row;
      const data = this.props.data;
      const fullID = `${this.props.year - 2000}-${row[data.c_ID]}`;
      const status = ({
        [spreadsheetData.Enum.STATUS.APPLICANT]: "applicant",
        [spreadsheetData.Enum.STATUS.SECOND_READ]: "2nd read",
        [spreadsheetData.Enum.STATUS.FINALIST]: "finalist",
        [spreadsheetData.Enum.STATUS.RECIPIENT]: 'recipient',
        [spreadsheetData.Enum.STATUS.INELIGIBLE]: "ineligible"
      })[row[data.c_Status]] || "applicant";

      // Depending on the state, we want to display one of three things as the icon:
      // If we this row is selectable, we want to show an indicator as to whether this row is
      // currently selected or not. If this row is rankable, show a ranking number. Otherwise, show
      // the applicant's status as a single letter.
      let icon;
      if (this.props.selectable) {
        icon = <div
          className={"applicant_selection" + (this.props.selectionDisabled ? " disabled" : "")}
          onClick={this.props.selectApplicant}
        ></div>;
      } else if (this.props.rankable) {
        icon = <div
          className="applicant_ranking"
        >
          <div
            tabIndex={this.props.isFirstFiltered ? null : "0"}
            {...BUTTON_CLICK(this.moveRowUp.bind(this))}
            className={this.props.isFirstFiltered ? "hidden" : ""}
          ></div>
          <span>{this.props.rank}</span>
          <div
            tabIndex={this.props.isLastFiltered ? null : "0"}
            {...BUTTON_CLICK(this.moveRowDown.bind(this))}
            className={this.props.isLastFiltered ? "hidden" : ""}
          ></div>
        </div>;
      } else {
        icon = <div className={"applicant_status" + (this.props.filteringByStatus ? " filtering" : "")}>
          {status[0].toUpperCase()}
        </div>;
      }

      // `filterMatches` are extra items that appear in the row to indicate a match with the search
      // query.
      let filterMatches = [];
      filterMatches.push(
        <div
          key="ID"
          className={
            "whole_match" + (
              // Only add the ID match if the ID isn't already being shown somewhere else in the
              // row.
              this.props.filteringByID && this.props.detailOption != "#ID" && !this.props.unbiasedMode ?
              "" :
              " hidden"
            )
          }
        >#{fullID}</div>
      );

      
      // Start first and last name as just the plain name. This may change if we are filtering
      // by First and Last name.
      let firstName = formatters.First(row[data.c_First]);
      let lastName = formatters.Last(row[data.c_Last]);
      // Show the matched queries.
      for (const col in this.props.filteredBy) {
        const ranges = this.props.filteredBy[col];
        // Only look through columns that are arrays of ranges.
        if (Array.isArray(ranges) && ranges.length) {
          // Get column value that we are filtering by.
          let value;
          try {
            value = row[data.c(col)];
            if (value == NA) {
              continue;
            }
          } catch (err) {
            continue;
          }
          // Turn it into a stringified version.
          value = formatters[col](value);

          let matches = [
            value.substring(0, ranges.length ? ranges[0][0] : value.length)
          ];
          let isWholeMatch = ONLY_NON_ALPHANUMERIC_REGEX.test(matches[0]);

          for (let i = 0, l = ranges.length; i < l; i++) {
            // Skip over ranges that span 0 characters.
            if (ranges[i][0] != ranges[i][1]) {
              matches.push(
                <span
                  key={i}
                  className="filtering"
                >{
                  value.substring(ranges[i][0], ranges[i][1])
                }</span>
              );
            }
            // Add the non-matched string that follows the matched part.
            let followingString = value.substring(
              ranges[i][1],
              i == l - 1 ? value.length : ranges[i + 1][0]
            );
            // We ignore non-letter and non-number characters to determine if it is a whole match.
            isWholeMatch = isWholeMatch && ONLY_NON_ALPHANUMERIC_REGEX.test(followingString);
            matches.push(followingString);
          }
          
          // First and Last columns aren't added to `filterMatches` because they show up regardless
          // of whether they match a filter or not.
          if (col == "First") {
            firstName = matches;
          } else if (col == "Last") {
            lastName = matches;
          } else if (matches.length > 1 || typeof matches[0] != "string") {
            filterMatches.push(
              <div
                key={col}
                className={
                  isWholeMatch ? "whole_match" : "partial_match"
                }
              >{
                matches
              }</div>
            );
          }
        }
      }

      let handlers = this.makeHandlers();

      // `identifier` is the text that's shown on each row that identifies it from other applicants.
      // In unbiased mode, this is the applicant's literal ID since we can't show names or emails.
      // In regular mode, it's the applicant's first and last name.
      let identifier;
      if (this.props.unbiasedMode) {
        identifier = <div className={"applicant_id" + (this.props.filteringByID ? " filtering" : "")}>
          <span>#{fullID}</span>
        </div>;
      } else {
        identifier = <div className="applicant_name">
          {firstName} {lastName}
        </div>
      }

      let details = null;
      if (this.props.detailOption == "Icons" || (this.props.detailOption == "#ID" && this.props.unbiasedMode)) {
        let icons = [];
        try {
          icons = row[data.c("Icons")];
          icons = icons == NA ? [] : icons;
        } catch (err) {}
        details = <div className="applicant_icons">
          {icons.map((icon) => spreadsheetData.ICONS[icon] || null)}
        </div>;
      } else if (this.props.detailOption == "#ID") {
        details = <div className="applicant_id">
          <span className={this.props.filteringByID ? "filtering" : ""}>#{fullID}</span>
        </div>;
      }

      return (
        <button
          className={`applicant_row applicant_status_${status.replace(/\s+/g, "_")}` + (
            this.props.hidden ? " hidden" : ""
          ) + (
            !this.props.isFloating && row[data.c_ID] == this.props.floatingRow.ID ? " dragging" : ""
          ) + (
            this.props.isFloating ? " floating" : ""
          ) + (
            this.props.borderRadiusTop ? " br_top" : ""
          ) + (
            this.props.borderRadiusBottom ? " br_bottom" : ""
          )}
          data-applicant-id={fullID}
          data-selected={this.props.selected}
          onClick={this.attemptFocusOnApplicant}
          {...(this.props.isFloating ? {style: {left: `${this.props.floatingRow.initCoords[0]}px`, top: `${this.props.floatingRow.initCoords[1]}px`}} : {})}
          {...(this.props.floatingRow.ref ? {ref: this.props.floatingRow.ref} : {})}
          {...handlers}
        >
          {icon}
          {identifier}
          <div className="applicant_match spacer">
            {filterMatches}
          </div>
          {details}
        </button>
      );
    }

    attemptFocusOnApplicant(e) {
      if (!this.state.isBeingDragged) {
        this.props.focusOnApplicant(e.currentTarget.getAttribute("data-applicant-id"));
      }
    }

    initRankingDrag() {
      // This function is called when we are in ranking mode and a row has been dragged or held down
      // and we need to update it so that we can show it as being dragged.

      // Cancel a pointer down timeout if there is one.
      if (this.state.pointerDownTimeout) {
        clearTimeout(this.state.pointerDownTimeout);
      }

      // Clear any selections that may have been created.
      if (window.getSelection) {
        if (typeof getSelection().empty == "function") {
          getSelection().empty();
        } else if (typeof getSelection().removeAllRanges == "function") {
          window.getSelection().removeAllRanges();
        }
      } else if (document.selection && typeof document.selection.empty == "function") {
        document.selection.empty();
      }

      // Call a callback for starting a ranking drag.
      this.props.toggleRankingDrag(
        true,
        this.props,
        this.props.row[this.props.data.c_ID],
        [
          this.state.pointerStartPos[0] - this.state.pointerStartElement.offsetLeft,
          this.state.pointerStartPos[1] - this.state.pointerStartElement.offsetTop
        ],
        [
          this.state.pointerStartElement.offsetLeft,
          this.state.pointerStartElement.offsetTop
        ],
        this.props.filteredIndex,
        this.state.pointerStartElement,
        this.state.touchID
      );

      // Clean up this component's state.
      this.setState({
        pointerDownTimeout: null
      });
    }

    handler_rankingMousedown(e) {
      this.setState({
        pointerDown: true,
        pointerStartPos: [e.pageX, e.pageY],
        pointerStartElement: e.currentTarget,
        pointerDownTimeout: setTimeout(function() {
          unsubscribeListeners();
          this.initRankingDrag();
        }.bind(this), DRAG_THRESHOLD)
      });

      function unsubscribeListeners() {
        document.removeEventListener("mouseup", mouseup);
        document.removeEventListener("mousemove", mousemove);
        document.removeEventListener("webkitmouseforcechanged", forcechange);
      }

      // Mouseup is called if the mouse is released before the drag threshold has been met. It
      // sets the states back to normal so that the applicant is clicked on as it normally would
      // be.
      let mouseup = (function(e) {
        unsubscribeListeners();

        if (this.state.pointerDownTimeout) {
          clearTimeout(this.state.pointerDownTimeout);
        }

        this.setState({
          pointerDown: false,
          pointerStartPos: null,
          pointerStartElement: null,
          pointerDownTimeout: null
        });
      }).bind(this);

      // If the mouse is moved more than five pixels, we assume they are starting a drag.
      let mousemove = (function(e) {
        const distance = Math.hypot(e.pageX - this.state.pointerStartPos[0], e.pageY - this.state.pointerStartPos[1]);
        if (distance > 5) {
          unsubscribeListeners();
          this.initRankingDrag();
        }
      }).bind(this);

      // If the mouse's force changes to a sufficient amount, we initiate a click right away.
      let forcechange = (function(e) {
        if (e.webkitForce && e.WEBKIT_FORCE_AT_MOUSE_DOWN && e.WEBKIT_FORCE_AT_FORCE_MOUSE_DOWN && e.webkitForce >= 0.9 * e.WEBKIT_FORCE_AT_FORCE_MOUSE_DOWN - 0.1 * e.WEBKIT_FORCE_AT_MOUSE_DOWN) {
          unsubscribeListeners();
          this.initRankingDrag();
        }
      }).bind(this);
      
      document.addEventListener("mouseup", mouseup);
      document.addEventListener("mousemove", mousemove);
      document.addEventListener("webkitmouseforcechanged", forcechange);
    }

    handler_rankingTouchstart(e) {
      let touch = e.changedTouches[0];

      this.setState({
        touchID: touch.identifier,
        pointerDown: true,
        pointerStartPos: [touch.pageX, touch.pageY],
        pointerStartElement: e.currentTarget,
        pointerDownTimeout: setTimeout(function() {
          unsubscribeListeners();
          this.initRankingDrag();
        }.bind(this), DRAG_THRESHOLD)
      });

      function unsubscribeListeners() {
        document.removeEventListener("touchend", touchend);
        document.removeEventListener("touchcancel", touchend);
        document.removeEventListener("touchforcechange", forcechange);
      }

      // Mouseup is called if the mouse is released before the drag threshold has been met. It
      // sets the states back to normal so that the applicant is clicked on as it normally would
      // be.
      let touchend = (function(e) {
        let touch = false;
        for (const changedTouch of e.changedTouches) {
          if (changedTouch.identifier == this.state.touchID) {
            touch = changedTouch;
            break;
          }
        }
        if (!touch) {
          return;
        }

        unsubscribeListeners();

        if (this.state.pointerDownTimeout) {
          clearTimeout(this.state.pointerDownTimeout);
        }

        let rowElem = this.state.pointerStartElement;

        this.setState({
          touchID: null,
          pointerDown: false,
          pointerStartPos: null,
          pointerStartElement: null,
          pointerDownTimeout: null
        });

        for (let node = document.elementFromPoint(touch.clientX, touch.clientY); node; node = node.parentElement) {
          if (node == rowElem) {
            this.props.focusOnApplicant(node.getAttribute("data-applicant-id"));
            break;
          }
        }
      }).bind(this);

      // If the user forcefully pushes down, we count that as trying to drag down.
      let forcechange = function(e) {
        let touch = false;
        for (const changedTouch of e.changedTouches) {
          if (changedTouch.identifier == this.state.touchID) {
            touch = changedTouch;
            break;
          }
        }
        if (!touch) {
          return;
        }
        if (touch.force >= 0.85) {
          unsubscribeListeners();
          this.initRankingDrag();
        }
      }.bind(this);

      // We can't check if the touch has moved more than five pixels like with mouse events because
      // we can't differentiate between when they want to scroll and when they want to move.
      
      document.addEventListener("touchend", touchend);
      document.addEventListener("touchcancel", touchend);
      document.addEventListener("touchforcechange", forcechange);
    }

    makeHandlers() {
      if (this.props.hidden) {
        return {};
      }
      // Returns a set of handlers to apply to the row. If the row is rankable, we have to handle
      // certain things like mousedown to determine when to initiate a ranking drag.
      let handlers = {};

      if (this.props.rankable) {
        handlers.onMouseDown = this.handler_rankingMousedown;
        handlers.onTouchStart = this.handler_rankingTouchstart;
      }

      return handlers;
    }

    moveRowUp() {
      this.props.moveRankingRow("UP", this.props.filteredIndex);
    }

    moveRowDown() {
      this.props.moveRankingRow("DOWN", this.props.filteredIndex);
    }
  }

  class VotingModeControls extends Component {
    constructor(props) {
      super(props);
      this.state = {
        pollNumber: null
      };

      this.makeNewPoll = this.makeNewPoll.bind(this);
      this.cancelPoll = this.cancelPoll.bind(this);
      this.choosePollType = this.choosePollType.bind(this);
      this.closePoll = this.closePoll.bind(this);
      this.startSharingResults = this.startSharingResults.bind(this);
      this.stopSharingResults = this.stopSharingResults.bind(this);
    }

    render() {
      if (!votingData.active || votingData.master[0] != user.uid) {
        return null;
      }

      // We have closed the poll and need to calculate the results.
      let results = null;
      if (this.props.pollCreationStep == 6) {
        if (votingData.previousPollResults || this.props.previousPollResults) {
          results = votingData.previousPollResults || this.props.previousPollResults;
        } else {
          results = [];

          if (this.props.previousPollData[0] == "selection") {
            // A selection poll just shows the number of votes each person got since each vote is
            // worth the same.
            let responses = votingData.poll_responses;
            let votes = Object.fromEntries(this.props.previousPollData[1].map(id => [id, 0]));
            for (const uid in responses) {
              // Skip over the poll_data key and people who did not respond.
              if (uid == "poll_data" || !responses[uid][1]) {
                continue;
              }

              let votedApplicants = responses[uid][2].split("|");
              for (let i = votedApplicants.length - 1; i >= 0; i--) {
                votes[votedApplicants[i]]++;
              }
            }

            let max = Math.max(...Object.values(votes));

            for (const applicantID in votes) {
              results.push([applicantID, votes[applicantID] / max, votes[applicantID]]);
            }
          } else if (this.props.previousPollData[0] == "ranking") {
            // A ranking poll is different. It uses the algorithm described here:
            // https://www.fairvote.org/multi_winner_rcv_example
            let responses = {};
            let numVoters = 0;
            for (const uid in votingData.poll_responses) {
              if (uid == "poll_data" || !votingData.poll_responses[uid][1]) {
                continue;
              }
              responses[uid] = votingData.poll_responses[uid][2].split("|");
              numVoters++;
            }

            const leftoverApplicants = this.props.previousPollData[1].slice();
            let rankings = [];

            while (true) {
              let doneRanking = true;
              // Count how many 1st-place votes each applicant got by making an array of the voters that
              // voted for them (we can count the .length of the array to determine the number of votes
              // they got).
              let votes = {};
              for (const uid in responses) {
                if (responses[uid].length == 0) {
                  continue;
                }
                doneRanking = false;
                votes[responses[uid][0]] = votes[responses[uid][0]] || [];
                votes[responses[uid][0]].push(uid);
              }

              if (doneRanking) {
                let rank = rankings.length + 1;
                for (const applicant of leftoverApplicants) {
                  rankings.push([applicant, rank]);
                }
                break;
              }

              while (true) {
                // Get the applicant with the most votes. They should have at least 50% of the vote. If
                // they don't, we have to do more rounds of voting until there is one. If there are two
                // people with 50% of the vote, they share a ranking. If there is only one person with 50%
                // or more, they are next in the ranking.
                let maxVotes = -Infinity;
                let maxApplicants = [];
                for (const applicant in votes) {
                  if (votes[applicant].length > maxVotes) {
                    maxApplicants = [applicant];
                    maxVotes = votes[applicant].length;
                  } else if (votes[applicant].length == maxVotes) {
                    maxApplicants.push(applicant);
                  }
                }

                // Here, we do the same as above, except we look for the applicants with the minimum
                // number of votes in case we have to eliminate them later.
                let minVotes = Infinity;
                let minApplicants = [];
                for (const applicant in votes) {
                  if (votes[applicant].length < minVotes) {
                    minApplicants = [applicant];
                    minVotes = votes[applicant].length;
                  } else if (votes[applicant].length == minVotes) {
                    minApplicants.push(applicant);
                  }
                }

                // If the people with minimum number of votes is also the people with the maximum
                // number of votes, it means there are no more applicants we can eliminate. If we did,
                // we'd have eliminated all the applicants. Instead, it means there is a tie between
                // more than two applicants and none of them will ever reach the 50% threshold.
                if (maxVotes >= numVoters / 2 || minVotes == maxVotes) {
                  // We found one (or two) people with at least 50% of the vote. Add them to the
                  // ranking. We also have to remove them from any other ranking lists so that they
                  // don't get re-counted.
                  let rank = rankings.length + 1;
                  for (const applicant of maxApplicants) {
                    rankings.push([applicant, rank]);
                    leftoverApplicants[leftoverApplicants.indexOf(applicant)] = leftoverApplicants[leftoverApplicants.length - 1];
                    leftoverApplicants.pop();
                    for (const uid in responses) {
                      let index = responses[uid].indexOf(applicant);
                      if (~index) {
                        responses[uid].splice(index, 1);
                      }
                    }
                  }
                  break;
                } else {
                  // No one has 50% of the vote. We eliminate the applicant with the least votes and
                  // count again.
                  for (const applicant of minApplicants) {
                    for (const voter_uid of votes[applicant]) {
                      let i;
                      for (i = responses[voter_uid].indexOf(applicant); i < responses[voter_uid].length; i++) {
                        if (!~minApplicants.indexOf(responses[voter_uid][i])) {
                          break;
                        }
                      }
                      votes[responses[voter_uid][i]] = votes[responses[voter_uid][i]] || [];
                      votes[responses[voter_uid][i]].push(voter_uid);
                    }
                    delete votes[applicant];
                  }
                }
              }
            }

            // Convert the results into data that can be used to display the results.
            let lastRank = rankings[rankings.length - 1][1] - 1 || 1;
            results = rankings.map(ranking => [ranking[0], (lastRank - ranking[1] + 1) / lastRank, ranking[1]]);
          }

          // Sort the results in order of their ID.
          results.sort((a, b) => parseInt(a[0], 16) - parseInt(b[0], 16));

          // If we are auto-sharing results, we can share the poll results with other voters. Since
          // Firestore does not accept nested arrays, we just stringify the 2D array of results to
          // make it easier to parse later on.
          if (this.props.sharingPollResults) {
            votingPollDocument.update({
              poll_results: JSON.stringify(results)
            });
          }
        }

        votingData.previousPollResults = results;

        results = (
          <div className="poll_res">
            <div className="poll_res_container">
              {
                results.map(result => (
                  <div key={result[0]} className="poll_res_col">
                    <div className="poll_res_bar">
                      <div style={{flexGrow: 1 - result[1]}}>
                        <span className={result[1] >= .5 ? "hidden" : ""}>
                          {result[2]}  
                        </span>
                      </div>
                      <div style={{flexGrow: result[1]}}>
                        <span className={result[1] >= .5 ? "" : "hidden"}>
                          {result[2]}  
                        </span>
                      </div>
                    </div>
                    <div className="poll_res_name">#{result[0]}</div>
                  </div>
                ))
              }
            </div>
          </div>
        );
      }

      return <div id="voting_controls">
        <div>There {
            votingData.applicants.length == 1 ? "is" : "are"
          } {
            votingData.applicants.length == 1 ?
            <span className="applicant_num">1 applicant</span> :
            <span className="applicant_num">{votingData.applicants.length} applicants</span>
          } left.
        </div>
        {
          this.props.eliminatingApplicants ? null :
          this.props.pollCreationStep == 0 ?
          <div className="button_flex">
            <button onClick={this.makeNewPoll}>Create Poll</button>
          </div> :
          this.props.pollCreationStep == 1 ?
          <React.Fragment>
            <div className="button_flex">
              <button className="poll_type" onClick={this.choosePollType} data-type="ranking">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 91.6 70">
                  <path className="fill_finalist" d="M86.6,45H5c-2.8,0-5-2.2-5-5V30c0-2.8,2.2-5,5-5h81.6c2.8,0,5,2.2,5,5v10C91.6,42.8,89.3,45,86.6,45z"/>
                  <path className="fill_finalist" d="M86.6,20H5c-2.8,0-5-2.2-5-5V5c0-2.8,2.2-5,5-5h81.6c2.8,0,5,2.2,5,5v10C91.6,17.8,89.3,20,86.6,20z"/>
                  <path className="fill_finalist" d="M86.6,70H5c-2.8,0-5-2.2-5-5V55c0-2.8,2.2-5,5-5h81.6c2.8,0,5,2.2,5,5v10C91.6,67.8,89.3,70,86.6,70z"/>
                  <path className="fill_text_color" d="M9.5,15.6c-0.1,0-0.2,0-0.3-0.1s-0.1-0.2-0.1-0.3V6.9L6.7,8.8C6.6,8.9,6.5,8.9,6.4,8.9c-0.1,0-0.2-0.1-0.3-0.2L5.5,7.8C5.4,7.7,5.4,7.6,5.4,7.5c0-0.1,0.1-0.2,0.2-0.3l3.6-2.8c0.1-0.1,0.1-0.1,0.2-0.1c0.1,0,0.1,0,0.2,0H11c0.1,0,0.2,0,0.3,0.1c0.1,0.1,0.1,0.2,0.1,0.3v10.4c0,0.1,0,0.2-0.1,0.3c-0.1,0.1-0.2,0.1-0.3,0.1H9.5z"/>
                  <path className="fill_text_color" d="M4.9,40.7c-0.1,0-0.2,0-0.3-0.1c-0.1-0.1-0.1-0.2-0.1-0.3v-0.8c0-0.1,0-0.2,0.1-0.3c0-0.1,0.2-0.3,0.3-0.4l2.5-2.5c0.7-0.6,1.3-1,1.7-1.4c0.4-0.4,0.7-0.7,0.9-1.1c0.2-0.3,0.3-0.6,0.3-1c0-0.5-0.1-0.9-0.4-1.2s-0.7-0.4-1.2-0.4c-0.4,0-0.7,0.1-0.9,0.2c-0.3,0.2-0.5,0.4-0.6,0.6S7,32.5,7,32.9c0,0.1-0.1,0.2-0.2,0.3c-0.1,0.1-0.2,0.1-0.3,0.1H5.1c-0.1,0-0.2,0-0.2-0.1S4.7,33,4.7,32.9c0-0.5,0.1-0.9,0.3-1.3c0.2-0.4,0.4-0.8,0.8-1.2c0.3-0.3,0.8-0.6,1.3-0.8c0.5-0.2,1.1-0.3,1.7-0.3c0.9,0,1.6,0.1,2.2,0.4c0.6,0.3,1,0.7,1.3,1.2s0.4,1.1,0.4,1.7c0,0.5-0.1,1-0.3,1.4c-0.2,0.4-0.5,0.8-0.8,1.2c-0.4,0.4-0.8,0.8-1.3,1.2L8,38.8h4.6c0.1,0,0.2,0,0.3,0.1s0.1,0.2,0.1,0.3v1.1c0,0.1,0,0.2-0.1,0.3c-0.1,0.1-0.2,0.1-0.3,0.1H4.9z"/>
                  <path className="fill_text_color" d="M8.7,65.7c-0.7,0-1.4-0.1-1.9-0.3c-0.5-0.2-1-0.4-1.4-0.7c-0.4-0.3-0.6-0.6-0.8-1c-0.2-0.3-0.3-0.7-0.3-1c0-0.1,0-0.2,0.1-0.2s0.2-0.1,0.2-0.1h1.4c0.1,0,0.2,0,0.3,0.1c0.1,0,0.1,0.1,0.2,0.3c0.1,0.3,0.3,0.5,0.5,0.7c0.2,0.2,0.5,0.3,0.8,0.4s0.6,0.1,0.9,0.1c0.6,0,1.1-0.2,1.5-0.5c0.4-0.3,0.6-0.7,0.6-1.3s-0.2-1-0.5-1.2c-0.4-0.3-0.8-0.4-1.5-0.4H7.2c-0.1,0-0.2,0-0.3-0.1s-0.1-0.2-0.1-0.3v-0.7c0-0.1,0-0.2,0.1-0.3C6.9,59.1,7,59,7,59l2.9-2.8H5.3c-0.1,0-0.2,0-0.3-0.1s-0.1-0.2-0.1-0.3v-1.1c0-0.1,0-0.2,0.1-0.3c0.1-0.1,0.2-0.1,0.3-0.1h6.9c0.1,0,0.2,0,0.3,0.1c0.1,0.1,0.1,0.2,0.1,0.3v1c0,0.1,0,0.2-0.1,0.3c0,0.1-0.1,0.1-0.1,0.2L9.6,59l0.2,0c0.7,0.1,1.2,0.2,1.7,0.4s0.9,0.6,1.2,1c0.3,0.5,0.4,1,0.4,1.7c0,0.7-0.2,1.3-0.6,1.9c-0.4,0.5-0.9,0.9-1.6,1.2C10.3,65.5,9.6,65.7,8.7,65.7z"/>
                </svg>
                Ranking
              </button>
              <button className="poll_type" onClick={this.choosePollType} data-type="selection">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 91.6 70">
                  <path className="fill_finalist" d="M86.6,45H5c-2.8,0-5-2.2-5-5V30c0-2.8,2.2-5,5-5h81.6c2.8,0,5,2.2,5,5v10C91.6,42.8,89.3,45,86.6,45z"/>
                  <path className="fill_finalist" d="M86.6,20H5c-2.8,0-5-2.2-5-5V5c0-2.8,2.2-5,5-5h81.6c2.8,0,5,2.2,5,5v10C91.6,17.8,89.3,20,86.6,20z"/>
                  <path className="fill_finalist" d="M86.6,70H5c-2.8,0-5-2.2-5-5V55c0-2.8,2.2-5,5-5h81.6c2.8,0,5,2.2,5,5v10C91.6,67.8,89.3,70,86.6,70z"/>
                  <path fill="white" d="M15.5,16.5h-11c-0.6,0-1-0.4-1-1v-11c0-0.6,0.4-1,1-1h11c0.6,0,1,0.4,1,1v11C16.5,16.1,16.1,16.5,15.5,16.5z"/>
                  <path className="fill_theme_color" d="M14,15H6c-0.6,0-1-0.4-1-1V6c0-0.6,0.4-1,1-1h8c0.6,0,1,0.4,1,1v8C15,14.6,14.6,15,14,15z"/>
                  <path fill="white" d="M15.5,41.5h-11c-0.6,0-1-0.4-1-1v-11c0-0.6,0.4-1,1-1h11c0.6,0,1,0.4,1,1v11C16.5,41.1,16.1,41.5,15.5,41.5z"/>
                  <path className="fill_gray" opacity=".5" d="M14,40H6c-0.6,0-1-0.4-1-1v-8c0-0.6,0.4-1,1-1h8c0.6,0,1,0.4,1,1v8C15,39.6,14.6,40,14,40z"/>
                  <path fill="white" d="M15.5,66.5h-11c-0.6,0-1-0.4-1-1v-11c0-0.6,0.4-1,1-1h11c0.6,0,1,0.4,1,1v11C16.5,66.1,16.1,66.5,15.5,66.5z"/>
                  <path className="fill_gray" opacity=".5" d="M14,65H6c-0.6,0-1-0.4-1-1v-8c0-0.6,0.4-1,1-1h8c0.6,0,1,0.4,1,1v8C15,64.6,14.6,65,14,65z"/>
                </svg>
                Selection
              </button>
            </div>
            <button className="destructive" onClick={this.cancelPoll}>Cancel</button>
          </React.Fragment> :
          this.props.pollCreationStep == 2 ?
          <React.Fragment>
            <div className="direction_text">Choose at least two applicants for the poll.</div>
            <div className="button_flex">
              <button className="destructive" onClick={this.cancelPoll}>Cancel</button>
              <button disabled={this.props.selectedApplicants.length < 2} onClick={this.onFinishSelectApplicants.bind(this)}>Next</button>
            </div>
          </React.Fragment> :
          this.props.pollCreationStep == 3 ?
          <React.Fragment>
            <div className="direction_text">How many should each person {this.props.pollType == "ranking" ? "rank" : "select"}?</div>
            <div className="button_flex">
              <input
                type="number"
                autoFocus
                defaultValue={this.state.pollNumber}
                max={this.props.pollApplicants.length}
                min={1}
                step={1}
                onChange={this.onChangePollNumber.bind(this)}
              />
              <button disabled={!this.state.pollNumber} onClick={this.sendOutPoll.bind(this)}>Finish</button>
            </div>
            <button className="destructive" onClick={this.cancelPoll}>Cancel</button>
          </React.Fragment> :
          this.props.pollCreationStep == 4 ?
          <div className="direction_text">Sending out poll...</div> :
          this.props.pollCreationStep == 5 ?
          <React.Fragment>
            <div className="direction_text">Your poll has been received by:</div>
            <div className="poll_receivers_list">
              {
                votingData.poll_receivers.map(receiver => (
                  <div key={receiver[0]} className={"poll_receiver" + (receiver[2] ? " ready" : " not_ready")}>
                    <span className="poll_receiver_name">{receiver[1]}</span>
                    <span className="poll_receiver_status">{receiver[2] ? "Ready" : "Not Ready"}</span>
                  </div>
                ))
              }
            </div>
            <div className="button_flex">
              <button
                onClick={this.closePoll}
                disabled={!this.props.pollSubmitted}
              >Close Poll</button>
            </div>
            {
              this.props.pollSubmitted ? null :
              <div className="direction_text" style={{marginTop: ".5rem"}}>Please submit your responses before closing the poll.</div>
            }
          </React.Fragment> :
          this.props.pollCreationStep == 6 ?
          <React.Fragment>
            {results}
            <div className="button_flex">
              {
                this.props.sharingPollResults ?
                  <button onClick={this.stopSharingResults}>Stop Sharing</button> :
                  votingData.previousPollResults ? 
                    <button onClick={this.startSharingResults}>Share Results</button> :
                    null
              }
              <button onClick={this.makeNewPoll}>Create New Poll</button>
            </div>
          </React.Fragment> :
          null
        }{
          this.props.pollCreationStep == 0 || this.props.pollCreationStep == 6 ?
            this.props.eliminatingApplicants ?
              <React.Fragment>
                <div className="direction_text">Select the applicants you want to eliminate from consideration.</div>
                <div className="button_flex">
                  <button className="destructive" onClick={this.props.cancelEliminatingApplicants}>Cancel</button>
                  <button onClick={this.props.finishEliminatingApplicants}>Done</button>
                </div>
              </React.Fragment> :
              <button onClick={this.props.beginEliminatingApplicants}>Eliminate Applicants</button> :
            null
        }
      </div>
    }

    makeNewPoll() {
      this.props.cancelEliminatingApplicants();
      this.props.setAppState({
        pollCreationStep: 1,
        pollType: null,
        pollApplicants: []
      });
      this.setState({
        pollNumber: null
      });
    }

    choosePollType(e) {
      this.props.setAppState({
        pollCreationStep: 2,
        pollType: e.currentTarget.getAttribute("data-type")
      });
      // Turn on selecting mode to let the voting master select which applicants to include in the
      // poll.
      this.props.toggleApplicantSelection(true);
    }

    onFinishSelectApplicants() {
      this.props.setAppState({
        pollCreationStep: 3,
        pollApplicants: this.props.selectedApplicants
      });
      this.setState({
        pollNumber: this.props.pollType == "ranking" ?
          Math.min(3, this.props.selectedApplicants.length) :
          Math.ceil(this.props.selectedApplicants.length / 4),
      });
      // Turn off selecting mode from the previous step.
      this.props.toggleApplicantSelection(false);
    }

    onChangePollNumber(e) {
      this.setState({
        pollNumber: e.currentTarget.checkValidity() ? +e.currentTarget.value : null
      });
    }

    cancelPoll(e) {
      this.props.setAppState({
        pollCreationStep: 0,
        pollType: null
      });
      this.setState({
        pollNumber: null
      });
      // Turn off selecting mode if it's currently turned on (i.e., in the middle of step 2).
      this.props.toggleApplicantSelection(false);
    }

    sendOutPoll(e) {
      // We use set instead of update here to get rid of any other fields that are present in the
      // document.
      votingPollDocument.set({
        poll_data: [
          this.props.pollType,
          this.props.pollApplicants.join("|"), // Nested array are not supported
          this.state.pollNumber
        ]
      }).then(this.props.subscribeToPollResponses);
      this.props.setAppState({
        pollCreationStep: 4
      });
      votingData.previousPollResults = null;
    }

    closePoll(e) {
      this.props.unsubscribeFromPollResponses();
      votingPollDocument.set({
        poll_data: null
      }).then(this.props.reloadSearchResults);
      this.props.setAppState({
        pollCreationStep: 6,
        sharingPollResults: this.props.autoSharePollResults
      });
    }

    startSharingResults(e) {
      votingPollDocument.update({
        poll_results: JSON.stringify(votingData.previousPollResults)
      });
      this.props.setAppState({
        sharingPollResults: true
      });
    }

    stopSharingResults(e) {
      votingPollDocument.update({
        poll_results: null
      });
      this.props.setAppState({
        sharingPollResults: false
      });
    }
  }

  class ApplicantModal extends Component {
    constructor(props) {
      super(props);
      
      this.state = {
        edits: {},
        editing: false,
        uploading: false,
        pendingRow: null,
        pendingSheetsRow: null,
        pendingRowIndex: null,
        failedUpload: false,
        warnUnsavedEdit: false,
        activeUnusedIcons: false
      };

      window.addEventListener("keydown", function(e) {
        if (e.key == "Escape" || e.code == "Escape") {
          this.attemptUnfocusApplicant();
        }
      }.bind(this));

      this.unfocusApplicant = this.unfocusApplicant.bind(this);
      this.attemptUnfocusApplicant = this.attemptUnfocusApplicant.bind(this);
      this.onClickModal = this.onClickModal.bind(this);
      this.onEditPrompt = this.onEditPrompt.bind(this);
    }

    render() {
      const data = this.props.spreadsheetData;
      const year = this.props.year;
      const id = this.props.id;
      let name,
        email,
        ID,
        status,
        income, income_elim,
        household_members, household_members_elim,
        efc, efc_elim,
        par1_education, par1_education_elim,
        par2_education, par2_education_elim,
        college, college_elim,
        loans, loans_elim,
        campus_living, campus_living_elim,
        location, location_elim,
        state,
        class_year, class_year_elim,
        phone_number, phone_number_elim,
        pronouns,
        birthday, birthday_elim,
        prompts = [],
        additional_comments,
        icons = [],
        unusedIcons = [],
        modal_message;

      if (data && !isNaN(year)) {
        document.documentElement.setAttribute("data-is-focusing", "true");
        function column(col, alt) {
          try {
            const value = row[data.c(col)];
            return value == NA ? alt : value;
          } catch (e) {
            return alt;
          }
        }
        function check_elim(col) {
          if (col in spreadsheetData[year].eliminators) {
            const val = column(col, NA);
            return spreadsheetData[year].eliminators[col](val);
          } else {
            return false;
          }
        }

        let rows = [];
        for (const row of data.rows) {
          if (parseInt(row[data.c_ID], 16) == id) {
            rows.push(row);
          }
        }
        if (rows.length != 1) {
          return null;
        }
        const row = rows[0];

        name = formatters.First(row[data.c_First]) + " " + formatters.Last(row[data.c_Last]);
        email = formatters.Email(column("Email", NA));
        ID = "#" + (year - 2000) + "-" + row[data.c_ID];
        status = formatters.Status(row[data.c_Status]);
        income = formatters.Income(column("Income", NA));
        income_elim = check_elim("Income");
        household_members = formatters.Members(column("Members", NA));
        household_members_elim = check_elim("Members");
        efc = formatters.EFC(column("EFC", NA));
        efc_elim = check_elim("EFC");
        college = formatters.College(column("College", NA));
        college_elim = check_elim("College");
        loans = formatters.Loans(column("Loans", NA));
        loans_elim = check_elim("Loans");
        campus_living = formatters.Campus_Living(column("Campus_Living", NA));
        campus_living_elim = check_elim("Campus_Living");
        par1_education = formatters.Parent1_Education(column("Parent1_Education", NA));
        par1_education_elim = check_elim("Parent1_Education");
        par2_education = formatters.Parent2_Education(column("Parent2_Education", NA));
        par2_education_elim = check_elim("Parent2_Education");
        location = formatters.Location(column("Location", NA));
        location_elim = check_elim("Location");
        class_year = formatters.Year(column("Year", NA));
        class_year_elim = check_elim("Year");

        // Unbiased mode hides the applicant's phone number.
        if (this.props.unbiasedMode) {
          phone_number = "(***) ***-****";
        } else {
          phone_number = formatters.Phone(column("Phone", NA));
          phone_number_elim = check_elim("Phone");
        }

        // Unbiased mode hides pronouns.
        if (this.props.unbiasedMode) {
          pronouns = "— / — / —";
        } else {
          pronouns = formatters.Pronouns(column("Pronouns", NA));
        }

        // If unbiased mode is enabled, the birthday is hidden and we only know how old they are in-
        // stead.
        if (this.props.unbiasedMode) {
          let date = column("Birthday", NA);
          // Only continue if the date is valid.
          if (date != NA && !isNaN(date.valueOf())) {
            let now = new Date();
            // Clone to prevent altering the actual date.
            date = new Date(date);
            // Get the number of years that have passed.
            let years = now.getFullYear() - date.getFullYear();
            date.setFullYear(now.getFullYear());
            // If their birthday is later this year, subtract one since they haven't aged that year
            // yet.
            years = years - (date - now > 0 ? 1 : 0);
            birthday = `${years} year${years == 1 ? "" : "s"} old`;
          } else {
            birthday = "N/A";
          }
        } else {
          birthday = formatters.Birthday(column("Birthday", NA));
          birthday_elim = check_elim("Birthday");
        }
        
        let ssData = spreadsheetData[this.props.year];
        for (let i = 0, l = ssData.prompts.length; i < l; i++) {
          // Get the prompt's header name and its corresponding column index.
          const header = ssData.mapping.Prompts[i];
          const index = data.headers.indexOf(header);

          if (!~index) {
            continue;
          }

          // Add the React elements that will display this prompt.
          prompts.push(
            <div key={i} data-prompt-index={i} className={"modal_prompt" + (this.state.editing ? " editing" : "")}>
              <h4 className="modal_header">
                <span>{ssData.prompts[i]}</span>
              </h4>
              {
                this.state.editing ?
                <ResizableTextarea defaultValue={row[index].trim()} data-index={i} onChange={this.onEditPrompt}/> :
                <div className="modal_prompt_response">{row[index].trim()}</div>
              }
            </div>
          );
        }

        // Get additional comments.
        additional_comments = column("Comments", "").trim();
        // If the applicant wrote "N/A" themselves, we can just exclude it.
        if (additional_comments.match(/^[nN]\s*\/?\s*[aA]$/)) {
          additional_comments = "";
        }

        // Get the applicant's icons. If we are currently in the process of editing Icons, we want
        // to display our current edit's set instead of the actual set of icons from the spread-
        // sheet.
        let iconNames = "Icons" in this.state.edits ? this.state.edits.Icons : column("Icons", []);
        // Turn the icon names into React SVG elements.
        icons = iconNames.map((icon) => spreadsheetData.ICONS[icon] || null);

        // Only get the list of `unusedIcons` if we are in editing mode since that's the only place
        // we would see them.
        if (this.state.editing) {
          // Start with the full list of icons.
          unusedIcons = Object.keys(spreadsheetData.ICONS);
          // Remove any icons that are found in the `icons` list.
          for (let i = iconNames.length - 1; i >= 0; i--) {
            let index = unusedIcons.indexOf(iconNames[i]);
            if (~index) {
              unusedIcons.splice(index, 1);
            }
          }
          // Turn these icon names into SVG elements too.
          unusedIcons = unusedIcons.map((icon) => spreadsheetData.ICONS[icon] || null);

          // Generate the elements that will be red Xs that delete icons.
          for (let i = iconNames.length - 1; i >= 0; i--) {
            if (icons[i] !== null) {
              icons[i] = <div className="modal_icon_container">{icons[i]}</div>;
              icons.splice(i + 1, 0, <button key={iconNames[i] + "-deleter"} className="modal_icon_deleter nostyle"><div></div></button>);
            }
          }
        }
      } else {
        document.documentElement.setAttribute("data-is-focusing", "false");
      }

      // If any eliminators are active, we need to show the Make Ineligible button.
      const has_elim = (
        income_elim ||
        household_members_elim ||
        efc_elim ||
        par1_education_elim ||
        par2_education_elim ||
        college_elim ||
        loans_elim ||
        campus_living_elim ||
        location_elim ||
        class_year_elim ||
        phone_number_elim ||
        birthday_elim
      );

      let comments_prompt = this.state.editing || additional_comments != "" ?
        <div className={"modal_prompt" + (this.state.editing ? " editing" : "")}>
          <h4 className="modal_header">
            <span>Additional Comments</span>
          </h4>
          {
            this.state.editing ?
            <ResizableTextarea defaultValue={additional_comments} onChange={this.onEditComments.bind(this)}/> :
            <div className="modal_prompt_response">{additional_comments}</div>
          }
        </div>
        : null;
      
      if (this.state.uploading) {
        modal_message = "Saving Changes...";
      } else if (this.state.failedUpload) {
        modal_message = (
          <React.Fragment>
            The changes you made failed to save. Make sure you have a stable internet connection and "Edit" access on the Google Sheet.
            <div style={{textAlign: "center", marginTop: ".5rem"}}>
              <button onClick={this.onRetryUpload.bind(this)}>Try Again</button>
              <button className="destructive" onClick={this.onAbortEdit.bind(this)}>Delete Changes</button>
            </div>
          </React.Fragment>
        );
      } else if (this.state.warnUnsavedEdit) {
        modal_message = (
          <React.Fragment>
            You have unsaved changes. Do you want to go back and save them or exit anyway?
            <div style={{textAlign: "center", marginTop: ".5em"}}>
              <button onClick={e => this.setState({warnUnsavedEdit: false})}>Go Back</button>
              <button className="destructive" onClick={this.unfocusApplicant}>Exit</button>
            </div>
          </React.Fragment>
        );
      }

      return (
        <div
          id="modal_back"
          onClick={this.attemptUnfocusApplicant}
        >
          <div
            id="applicant_modal"
            onClick={this.onClickModal}
          >
            {
              modal_message ?
              <div id="modal_message">
                {modal_message}
              </div>
              : null
            }
            <div id="modal_content">
              <div id="modal_scroller" onScroll={this.onScroll.bind(this)}>
                {
                  this.props.unbiasedMode ?
                  <h1>{ID}</h1> :
                  <h1>{
                    this.state.editing ?
                    <input
                      type="text"
                      defaultValue={name}
                      data-original-value={name}
                      onChange={this.onEditName.bind(this)}
                      onBlur={this.onBlurName.bind(this)}
                      pattern="\s*[0-9A-Za-zÀ-ÖØ-öø-ÿ]+\s+[0-9A-Za-zÀ-ÖØ-öø-ÿ]+(?:\s+[0-9A-Za-zÀ-ÖØ-öø-ÿ]+)*\s*"
                    /> :
                    name
                  }</h1>
                }{
                  this.props.unbiasedMode ?
                  null :
                  <h2>{
                    this.state.editing ?
                    <input
                      type="email"
                      defaultValue={email}
                      data-original-value={email}
                      onChange={this.onEditEmail.bind(this)}
                      onBlur={this.onBlurField.bind(this, "Email")}
                    /> :
                    email
                  } <span>{ID}</span></h2>
                }
                <h3>{
                  this.state.editing ?
                  <select defaultValue={status} onChange={this.onEditStatus.bind(this)}>
                    <option>Applicant</option>
                    <option>2nd Read</option>
                    <option>Finalist</option>
                    <option>Recipient</option>
                    <option>Ineligible</option>
                  </select> :
                  status
                }</h3>
                <div className={"modal_icons" + (this.state.editing ? " editing" : icons.length ? "" : " hidden")} onClick={this.onDeleteIcon.bind(this)}>
                  {icons}
                  {
                    this.state.editing && unusedIcons.length ?
                    <svg
                      className="modal_icon add_icon"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 100 100"
                      onClick={e => this.state.activeUnusedIcons ? null : (e.stopPropagation(),this.setState({activeUnusedIcons: true}))}
                    >
                      <title>Add another</title>
                      <path d="M10,40,40,40,40,10,60,10,60,40,90,40,90,60,60,60,60,90,40,90,40,60,10,60Z"/>
                    </svg>
                    : null
                  }
                </div>
                {
                  this.state.editing ?
                  <div
                    className={"modal_unused_icons" + (this.state.activeUnusedIcons ? "" : " hidden")}
                    onClick={this.onAddIcon.bind(this)}
                  >
                    <div>
                      {unusedIcons}
                    </div>
                  </div> :
                  null
                }
                {
                  has_elim && status == "Applicant" && IS_EDITOR && !this.state.editing ?
                  <button
                    className="destructive"
                    onClick={e => this.setState({edits: {Status: spreadsheetData.Enum.STATUS.INELIGIBLE}}, this.onEndEdit.bind(this))}
                  >Make Ineligible</button>
                  : null
                }
                <section className="modal_section">
                  <h4 className="modal_header">
                    <span>Financial Info</span>
                  </h4>
                  <div className="modal_row">
                    <div className="field" style={{width: "15rem"}}>
                      {
                        this.state.editing ?
                        <input
                          type="text"
                          defaultValue={income}
                          data-original-value={income}
                          onChange={this.onEditIncome.bind(this)}
                          onBlur={this.onBlurField.bind(this, "Income")}
                          pattern="\s*(?:\$?\s*\d+(?:[,\s]\d*)*\s*(?:\.\s*\d*(?:\s\d*)*)?(?:\s*[kK])?(?:\s*\+|\s*[-–]\s*\$?\s*\d+(?:[,\s]\d*)*\s*(?:\.\s*\d*(?:\s\d*)*)?(?:\s*[kK])?)?|[nN]\s*\/?\s*[aA])\s*"
                        /> :
                        <span className={income_elim ? "eliminable" : ""}>{income}</span>
                      }
                      <span>Household Income</span>
                    </div>
                    <div className="field" style={{width: "15rem"}}>
                      {
                        this.state.editing ?
                        <input
                          type="text"
                          defaultValue={household_members}
                          data-original-value={household_members}
                          onChange={this.onEditHouseholdMembers.bind(this)}
                          onBlur={this.onBlurField.bind(this, "Members")}
                          pattern="\s*(?:\d+(?:[,\s]\d*)*\s*(?:\.\s*\d*(?:\s\d*)*)?(?:\s*[kK])?|[nN]\s*\/?\s*[aA])\s*"
                        /> :
                        <span  className={household_members_elim ? "eliminable" : ""}>{household_members}</span>
                      }
                      <span>Household Members</span>
                    </div>
                    <div className="field" style={{width: "15rem"}}>
                      {
                        this.state.editing ?
                        <input
                          type="text"
                          defaultValue={efc}
                          data-original-value={efc}
                          onChange={this.onEditEFC.bind(this)}
                          onBlur={this.onBlurField.bind(this, "EFC")}
                        /> :
                        <span className={efc_elim ? "eliminable" : ""}>{efc}</span>
                      }
                      <span>EFC</span>
                    </div>
                  </div>
                </section>
                <section className="modal_section">
                  <h4 className="modal_header">
                    <span>College Info</span>
                  </h4>
                  <div className="modal_row">
                    <div className="field" style={{width: "18rem"}}>
                      {
                        this.state.editing ?
                        <input
                          type="text"
                          defaultValue={college}
                          data-original-value={college}
                          onChange={this.onEditCollege.bind(this)}
                          onBlur={this.onBlurField.bind(this, "College")}
                        /> :
                        <span className={college_elim ? "eliminable" : ""}>{college}</span>
                      }
                      <span>College</span>
                    </div>
                    <div className="field" style={{width: "5rem"}}>
                      {
                        this.state.editing ?
                        <select defaultValue={loans} onChange={this.onEditLoans.bind(this)}>
                          <option>Yes</option>
                          <option>No</option>
                          <option>N/A</option>
                        </select> :
                        <span className={loans_elim ? "eliminable" : ""}>{loans}</span>
                      }
                      <span>Loans</span>
                    </div>
                    <div className="field" style={{width: "18rem"}}>
                      {
                        this.state.editing ?
                        <select defaultValue={campus_living} onChange={this.onEditCampusLiving.bind(this)}>
                          <option>On campus</option>
                          <option>Off campus w/ rent</option>
                          <option>Off campus w/o rent</option>
                          <option>Unknown</option>
                          <option>N/A</option>
                        </select> :
                        <span className={campus_living_elim ? "eliminable" : ""}>{campus_living}</span>
                      }
                      <span>Campus Living</span>
                    </div>
                  </div>
                </section>
                <section className="modal_section">
                  <h4 className="modal_header">
                    <span>Background</span>
                  </h4>
                  <div className="modal_row">
                    <div className="field" style={{width: "18rem"}}>
                      {
                        this.state.editing ?
                        <input
                          type="text"
                          defaultValue={location}
                          data-original-value={location}
                          onChange={this.onEditLocation.bind(this)}
                          onBlur={this.onBlurField.bind(this, "Location")}
                        /> :
                        <span className={location_elim ? "eliminable" : ""}>{location}</span>
                      }
                      <span>Location</span>
                    </div>
                    <div className="field" style={{width: "18rem"}}>
                      {
                        this.state.editing ?
                        <select defaultValue={class_year} onChange={this.onEditYear.bind(this)}>
                          <option>High school student</option>
                          <option>First year college student</option>
                          <option>Returning college student</option>
                          <option>Graduate student</option>
                          <option>Transfer student</option>
                          <option>N/A</option>
                        </select> :
                        <span className={class_year_elim ? "eliminable" : ""}>{class_year}</span>
                      }
                      <span>Year</span>
                    </div>
                  </div>
                  <div className="modal_row">
                    <div className="field" style={{width: "18rem"}}>
                      {
                        this.state.editing ?
                        <select defaultValue={par1_education} onChange={this.onEditPar1Education.bind(this)}>
                          <option>No diploma</option>
                          <option>HS diploma or equivalent</option>
                          <option>Some college</option>
                          <option>College degree</option>
                          <option>Multiple degrees</option>
                          <option>No parent 1</option>
                        </select> :
                        <span className={par1_education_elim ? "eliminable" : ""}>{par1_education}</span>
                      }
                      <span>Parent 1 Education</span>
                    </div>
                    <div className="field" style={{width: "18rem"}}>
                      {
                        this.state.editing ?
                        <select defaultValue={par2_education} onChange={this.onEditPar2Education.bind(this)}>
                          <option>No diploma</option>
                          <option>HS diploma or equivalent</option>
                          <option>Some college</option>
                          <option>College degree</option>
                          <option>Multiple degrees</option>
                          <option>No parent 2</option>
                        </select> :
                        <span className={par2_education_elim ? "eliminable" : ""}>{par2_education}</span>
                      }
                      <span>Parent 2 Education</span>
                    </div>
                  </div>
                </section>
                <section className="modal_section">
                  <h4 className="modal_header">
                    <span>Personal Info</span>
                  </h4>
                  <div className="modal_row">
                    <div className="field" style={{width: "15rem"}}>
                      {
                        this.state.editing && !this.props.unbiasedMode ?
                        <input
                          type="text"
                          defaultValue={birthday}
                          data-original-value={birthday}
                          onChange={this.onEditBirthday.bind(this)}
                          onBlur={this.onBlurField.bind(this, "Birthday")}
                        /> :
                        <span className={birthday_elim ? "eliminable" : ""}>{birthday}</span>
                      }
                      <span>Birthday</span>
                    </div>
                    <div className="field" style={{width: "15rem"}}>
                      {
                        this.state.editing && !this.props.unbiasedMode ?
                        <input
                          type="tel"
                          defaultValue={phone_number}
                          data-original-value={phone_number}
                          onChange={this.onEditPhoneNumber.bind(this)}
                          onBlur={this.onBlurField.bind(this, "Phone")}
                          pattern="\s*(?:(?:\+\s*1\s*)?(?:\(\s*\d\s*\d\s*\d\s*\)|\d\s*\d\s*\d)\s*(?:-\s*)?\d\s*\d\s*\d\s*(?:-\s*)?\d\s*\d\s*\d\s*\d|[nN]\s*\/?\s*[aA])\s*"
                        /> :
                        <span className={phone_number_elim ? "eliminable" : ""}>{phone_number}</span>
                      }
                      <span>Phone Number</span>
                    </div>
                    <div className="field" style={{width: "15rem"}}>
                      {
                        this.state.editing && !this.props.unbiasedMode ?
                        <input
                          type="text"
                          defaultValue={pronouns}
                          data-original-value={pronouns}
                          onChange={this.onEditPronouns.bind(this)}
                          onBlur={this.onBlurField.bind(this, "Pronouns")}
                        /> :
                        <span>{pronouns}</span>
                      }
                      <span>Pronouns</span>
                    </div>
                  </div>
                </section>
                {prompts}
                {comments_prompt}
              </div>
              <div id="modal_btn_container">
                {
                  this.state.editing ?
                  <button onClick={this.onEndEdit.bind(this)}>Save</button>
                  : null
                }{
                  this.state.editing ? 
                  <button className="destructive" onClick={this.onAbortEdit.bind(this)}>Cancel</button>
                  : null
                }{
                  IS_EDITOR && !this.state.editing ?
                  <button onClick={this.onStartEdit.bind(this)}>Edit</button>
                  : null
                }{
                  this.state.editing ?
                  null :
                  <button onClick={this.attemptUnfocusApplicant.bind(this)}>Close</button>
                }
              </div>
            </div>
          </div>
        </div>
      );
    }

    onScroll(e) {
      const elem = e.currentTarget; 
      const scrollTop = elem.scrollTop;
      const scrollBottom = elem.scrollHeight - elem.scrollTop - elem.clientHeight;
      elem.style.boxShadow = `0 1.2em 0.25em -1em rgba(0,0,0,${Math.min(scrollTop / 16 * .4, .4)}) inset, 0 -1.2em 0.25em -1em rgba(0,0,0,${Math.min(scrollBottom / 16 * .4, .4)}) inset`;
    }

    onClickModal(e) {
      e.stopPropagation();
      if (this.state.activeUnusedIcons) {
        this.setState({
          activeUnusedIcons: false
        });
      }
    }

    attemptUnfocusApplicant() {
      if (!this.props.active) {
        return;
      }
      if (this.state.editing && Object.keys(this.state.edits).length != 0) {
        this.setState({
          warnUnsavedEdit: true
        });
      } else {
        this.unfocusApplicant();
      }
    }

    unfocusApplicant(e) {
      this.onAbortEdit(e);
      this.props.unfocusApplicant();
    }

    onStartEdit(e) {
      if (e && e.currentTarget.disabled) {
        return;
      }
      this.setState({
        editing: true
      });
    }

    onAbortEdit(e) {
      this.setState({
        editing: false,
        edits: {},
        uploading: false,
        pendingRow: null,
        pendingSheetsRow: null,
        pendingRowIndex: null,
        failedUpload: false,
        warnUnsavedEdit: false
      });
    }

    onRetryUpload(e) {
      if (typeof this.state.pendingRowIndex != "number" || !this.state.pendingSheetsRow) {
        return;
      }
      gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: spreadsheetData[this.props.year].id,
        range: `'${spreadsheetData[this.props.year].sheet}'!${this.state.pendingRowIndex + 2}:${this.state.pendingRowIndex + 2}`,
        valueInputOption: "RAW"
      }, {
        values: [this.state.pendingSheetsRow]
      }).then(function() {
        this.props.spreadsheetData.rows[this.state.pendingRowIndex] = this.state.pendingRow;
        this.setState({
          uploading: false,
          pendingRow: null,
          pendingSheetsRow: null,
          pendingRowIndex: null
        });
      }.bind(this), function(e) {
        this.setState({
          uploading: false,
          failedUpload: true
        });
      }.bind(this));

      this.setState({
        uploading: true,
        failedUpload: false
      });
    }

    onEndEdit() {
      if (!this.props.spreadsheetData || !this.props.year || !this.props.id || Object.keys(this.state.edits).length == 0) {
        this.setState({
          editing: false,
          edits: {},
          uploading: false,
          pendingRow: null,
          pendingSheetsRow: null,
          pendingRowIndex: null,
          failedUpload: false
        });
        return;
      }
      const data = this.props.spreadsheetData;
      let row = data.rows[this.props.applicantRowIndex].slice();
      for (const col in this.state.edits) {
        if (col == "Prompts") {
          for (const promptIndex in this.state.edits.Prompts) {
            let index = data.headers.indexOf(spreadsheetData[this.props.year].mapping.Prompts[promptIndex]);
            if (!~index) {
              continue;
            }
            row[index] = this.state.edits.Prompts[promptIndex];
          }
        } else {
          let index;
          try {
            index = data.c(col);
          } catch (err) {
            continue;
          }
          row[index] = this.state.edits[col];
        }
      }

      const translators = spreadsheetData[this.props.year].translate.to;
      let sheetsRow = row.slice();
      for (const col in translators) {
        let index;
        try {
          index = data.c(col);
        } catch (err) {
          continue;
        }
        const translatedValue = translators[col](row[index]);
        sheetsRow[index] = translatedValue;
      }

      gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: spreadsheetData[this.props.year].id,
        range: `'${spreadsheetData[this.props.year].sheet}'!${this.props.applicantRowIndex + 2}:${this.props.applicantRowIndex + 2}`,
        valueInputOption: "RAW"
      }, {
        values: [sheetsRow]
      }).then(function() {
        this.props.spreadsheetData.rows[this.state.pendingRowIndex] = this.state.pendingRow;
        this.setState({
          uploading: false,
          pendingRow: null,
          pendingSheetsRow: null,
          pendingRowIndex: null
        });
      }.bind(this), function(e) {
        this.setState({
          uploading: false,
          failedUpload: true
        });
      }.bind(this));

      this.setState({
        editing: false,
        edits: {},
        uploading: true,
        failedUpload: false,
        pendingRow: row,
        pendingSheetsRow: sheetsRow,
        pendingRowIndex: this.props.applicantRowIndex
      });
    }

    onMakeEdit(col, value) {
      // Updates the state's edit object, and doesn't cause an unnecessary re-render.
      if (col.substring(0,6) == "Prompt") {
        this.state.edits.Prompts = this.state.edits.Prompts || {};
        this.state.edits.Prompts[+col.substring(6)] = value;
      } else {
        this.state.edits[col] = value;
      }
    }

    onRemoveEdit(col) {
      if (col.substring(0,6) == "Prompt") {
        this.state.edits.Prompts = this.state.edits.Prompts || {};
        delete this.state.edits.Prompts[+col.substring(6)];
        if (Object.keys(this.state.edits.Prompts).length == 0) {
          delete this.state.edits.Prompts;
        }
      } else {
        delete this.state.edits[col];
      }
    }

    onBlurField(col, e) {
      const value = this.state.edits[col];
      if (value) {
        e.currentTarget.value = formatters[col](value);
      } else {
        e.currentTarget.value = e.currentTarget.getAttribute("data-original-value");
      }
    }

    onAddIcon(e) {
      e.stopPropagation();
      let node = e.target;
      let iconName;
      while (node != e.currentTarget) {
        if (iconName = node.getAttribute("data-icon-name")) {
          break;
        }
        node = node.parentNode;
      }
      if (!iconName) {
        return;
      }
      
      let icons;
      if ("Icons" in this.state.edits) {
        icons = this.state.edits.Icons;
      } else {
        const data = this.props.spreadsheetData;
        let iconIndex;
        try {
          iconIndex = data.c("Icons");
        } catch (err) {
          return;
        }
        icons = data.rows[this.props.applicantRowIndex][iconIndex].slice();
      }
      // If the icon is already in the list, we don't want to duplicate it.
      if (~icons.indexOf(iconName)) {
        return;
      }
      icons.push(iconName);
      // If there are no more icons to show in the menu, get rid of it.
      if (icons.length == Object.keys(spreadsheetData.ICONS).length) {
        this.setState({
          activeUnusedIcons: false
        });
      }
      this.onMakeEdit("Icons", icons);
      // We update the state without causing a re-render in onMakeEdit, but in this case, we do want
      // to cause a re-render.
      this.forceUpdate();
    }

    onDeleteIcon(e) {
      let node = e.target;
      let iconName;
      while (node != e.currentTarget) {
        if (iconName = node.getAttribute("data-icon-name") || (node.previousElementSibling && node.previousElementSibling.getAttribute("data-icon-name"))) {
          break;
        }
        node = node.parentNode;
      }
      if (!iconName) {
        return;
      }
      e.stopPropagation();

      // If we have already made edits to the Icons, use that updated list instead of getting the
      // old list of Icons from before we started editing.
      let icons;
      if ("Icons" in this.state.edits) {
        icons = this.state.edits.Icons;
      } else {
        const data = this.props.spreadsheetData;
        let iconIndex;
        try {
          iconIndex = data.c("Icons");
        } catch (err) {
          return;
        }
        icons = data.rows[this.props.applicantRowIndex][iconIndex].slice();
      }
      let index = icons.indexOf(iconName);
      if (!~index) {
        return;
      }
      icons.splice(index, 1);
      this.onMakeEdit("Icons", icons);
      // We update the state without causing a re-render in onMakeEdit, but in this case, we do want
      // to cause a re-render.
      this.forceUpdate();
    }

    onEditStatus(e) {
      this.onMakeEdit("Status", ({
        "Ineligible": spreadsheetData.Enum.STATUS.INELIGIBLE,
        "Applicant": spreadsheetData.Enum.STATUS.APPLICANT,
        "2nd Read": spreadsheetData.Enum.STATUS.SECOND_READ,
        "Finalist": spreadsheetData.Enum.STATUS.FINALIST,
        "Recipient": spreadsheetData.Enum.STATUS.RECIPIENT
      })[e.currentTarget.value] || NA);
    }

    onEditName(e) {
      const value = titleCase(e.currentTarget.value.trim());
      let split = value.split(/\s+/);
      if (split.length == 1 || !e.currentTarget.checkValidity()) {
        this.onRemoveEdit("First");
        this.onRemoveEdit("Last");
      } else {
        this.onMakeEdit("First", formatters.First(split[0]));
        this.onMakeEdit("Last", formatters.Last(split.slice(1).join(" ")));
      }
    }

    onBlurName(e) {
      const first = this.state.edits.First;
      const last = this.state.edits.Last;
      if (first && last) {
        e.currentTarget.value = formatters.First(first) + " " + formatters.Last(last);
      } else {
        e.currentTarget.value = e.currentTarget.getAttribute("data-original-value");
      }
    }

    onEditEmail(e) {
      const value = e.currentTarget.value.trim();
      if (!e.currentTarget.checkValidity() || !value) {
        this.onRemoveEdit("Email");
      } else {
        this.onMakeEdit("Email", formatters.Email(value));
      }
    }

    onEditEFC(e) {
      const value = e.currentTarget.value.trim();
      if (!e.currentTarget.checkValidity()) {
        this.onRemoveEdit("EFC");
      } else if (value.match(/^[nN]\s*\/?\s*[aA]$/) || !value) {
        this.onMakeEdit("EFC", NA);
      } else if (value.toLowerCase() == "undocumented") {
        this.onMakeEdit("EFC", spreadsheetData.Enum.EFC.UNDOCUMENTED);
      } else {
        let efc = value.replace(/[,\s\$]/g, "").toLowerCase();
        if (efc[efc.length - 1] == "k") {
          efc = efc.substring(0, efc.length - 1) * 1000;
        }
        if (isNaN(efc) || !isFinite(efc)) {
            this.onMakeEdit("EFC", spreadsheetData.makeWriteIn(value));
        } else {
          this.onMakeEdit("EFC", Math.floor(efc));
        }
      }
    }

    onEditHouseholdMembers(e) {
      const value = e.currentTarget.value.trim();
      if (!e.currentTarget.checkValidity()) {
        this.onRemoveEdit("Members");
      } else if (value.match(/^[nN]\/?[aA]$/) || !value) {
        this.onMakeEdit("Members", NA);
      } else {
        let members = value.replace(/[,\s]/g, "").toLowerCase();
        if (members[members.length - 1] == "k") {
          members = members.substring(0, members.length - 1) * 1000;
        }
        this.onMakeEdit("Members", Math.floor(members));
      }
    }

    onEditIncome(e) {
      const value = e.currentTarget.value.trim();
      if (!e.currentTarget.checkValidity()) {
        this.onRemoveEdit("Income");
      } else if (value.match(/^[nN]\s*\/?\s*[aA]$/) || !value) {
        this.onMakeEdit("Income", NA);
      } else {
        let income = value.replace(/[,\s\$]/g, "").toLowerCase();
        income = income.split(/[-–]/);
        if (income.length == 1) {
          income = income[0];
          if (income[income.length - 1] == "+") {
            income = income.substring(0, income.length - 1);
            if (income[income.length - 1] == "k") {
              income = income.substring(0, income.length - 1) * 1000;
            }
            this.onMakeEdit("Income", [Math.floor(income), Infinity]);
          } else {
            if (income[income.length - 1] == "k") {
              income = income.substring(0, income.length - 1) * 1000;
            }
            this.onMakeEdit("Income", Math.floor(income));
          }
        } else {
          if (income[0][income[0].length - 1] == "k") {
            income[0] = income[0].substring(0, income[0].length - 1) * 1000;
          }
          if (income[1][income[1].length - 1] == "k") {
            income[1] = income[1].substring(0, income[1].length - 1) * 1000;
          }
          this.onMakeEdit("Income", [Math.floor(income[0]), Math.floor(income[1])]);
        }
      }
    }

    onEditCollege(e) {
      const value = e.currentTarget.value.trim();
      if (!e.currentTarget.checkValidity()) {
        this.onRemoveEdit("College");
      } else if (value.match(/^[nN]\s*\/?\s*[aA]$/) || !value) {
        this.onMakeEdit("College", NA);
      } else {
        this.onMakeEdit("College", formatters.College(value));
      }
    }

    onEditLoans(e) {
      this.onMakeEdit("Loans", ({
        "Yes": spreadsheetData.Enum.LOANS.YES,
        "No": spreadsheetData.Enum.LOANS.NO,
        "N/A": NA
      })[e.currentTarget.value] || NA);
    }

    onEditCampusLiving(e) {
      this.onMakeEdit("Campus_Living", ({
        "On campus": spreadsheetData.Enum.CAMPUS_LIVING.ON_CAMPUS,
        "Off campus w/ rent": spreadsheetData.Enum.CAMPUS_LIVING.OFF_CAMPUS_RENT,
        "Off campus w/o rent": spreadsheetData.Enum.CAMPUS_LIVING.OFF_CAMPUS_NO_RENT,
        "Unknown": spreadsheetData.Enum.CAMPUS_LIVING.UNKNOWN,
        "N/A": NA
      })[e.currentTarget.value] || NA);
    }

    onEditLocation(e) {
      const value = e.currentTarget.value.trim();
      if (!e.currentTarget.checkValidity()) {
        this.onRemoveEdit("Location");
      } else if (value.match(/^[nN]\s*\/?\s*[aA]$/) || !value) {
        this.onMakeEdit("Location", NA);
      } else {
        this.onMakeEdit("Location", formatters.Location(value));
      }
    }

    onEditYear(e) {
      this.onMakeEdit("Year", ({
        "High school student": spreadsheetData.Enum.YEAR.HIGH_SCHOOL,
        "First year college student": spreadsheetData.Enum.YEAR.FIRST_YEAR,
        "Returning college student": spreadsheetData.Enum.YEAR.COLLEGE,
        "Graduate Student": spreadsheetData.Enum.YEAR.GRADUATE,
        "Transfer Student": spreadsheetData.Enum.YEAR.TRANSFER,
        "N/A": NA
      })[e.currentTarget.value] || NA);
    }

    onEditPar1Education(e) {
      this.onMakeEdit("Parent1_Education", ({
        "No HS diploma": spreadsheetData.Enum.PARENT1_EDUCATION.NO_DIPLOMA,
        "HS diploma or equivalent": spreadsheetData.Enum.PARENT1_EDUCATION.DIPLOMA,
        "Some college": spreadsheetData.Enum.PARENT1_EDUCATION.SOME_COLLEGE,
        "College degree": spreadsheetData.Enum.PARENT1_EDUCATION.DEGREE,
        "Multiple degrees": spreadsheetData.Enum.PARENT1_EDUCATION.MULTIPLE_DEGREES,
        "No parent 1": spreadsheetData.Enum.PARENT2_EDUCATION.NO_PARENT,
        "N/A": NA
      })[e.currentTarget.value] || NA);
    }

    onEditPar2Education(e) {
      this.onMakeEdit("Parent2_Education", ({
        "No HS diploma": spreadsheetData.Enum.PARENT2_EDUCATION.NO_DIPLOMA,
        "HS diploma or equivalent": spreadsheetData.Enum.PARENT2_EDUCATION.DIPLOMA,
        "Some college": spreadsheetData.Enum.PARENT2_EDUCATION.SOME_COLLEGE,
        "College degree": spreadsheetData.Enum.PARENT2_EDUCATION.DEGREE,
        "Multiple degrees": spreadsheetData.Enum.PARENT2_EDUCATION.MULTIPLE_DEGREES,
        "No parent 2": spreadsheetData.Enum.PARENT2_EDUCATION.NO_PARENT,
        "N/A": NA
      })[e.currentTarget.value] || NA);
    }

    onEditBirthday(e) {
      const value = e.currentTarget.value.trim().toLowerCase();
      if (!e.currentTarget.checkValidity()) {
        this.onRemoveEdit("Birthday");
      } else if (value.match(/^[nN]\s*\/?\s*[aA]$/) || !value) {
        this.onMakeEdit("Birthday", NA);
      } else {
        let birthdayMatch;
        let now = new Date();
        let month, day, year;
        if (birthdayMatch = value.match(/(\d+)\s*[\/\.-]\s*(\d+)\s*[\/\.-]\s*(\d+)/)) {
          month = +birthdayMatch[1];
          day = +birthdayMatch[2];
          year = +birthdayMatch[3];
          let thisYear = now.getFullYear();
          let century = Math.floor(thisYear / 100) * 100;
          if (year < 100) {
            if (year < (thisYear % 100)) {
              year += century;
            } else if (year > (thisYear % 100)) {
              year += century - 100;
            } else {
              if (month < (now.getMonth() + 1)) {
                year += century;
              } else if (month > (now.getMonth() + 1)) {
                year += century - 100;
              } else {
                if (day < now.getDate()) {
                  year += century;
                } else {
                  year += century - 100;
                }
              }
            }
          }
          if (month > 12 && day <= 12) {
            [month, day] = [day, month];
          }
        } else if (birthdayMatch = value.match(/^([a-z]+)\s*(?:\.\s*)?(\d{1,2})\s*(?:,\s*)?(\d{4})$/)) {
          let monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
          let filtered = monthNames.filter(name => name.indexOf(birthdayMatch[1]) == 0);
          if (filtered.length == 1) {
            month = monthNames.indexOf(filtered[0]) + 1;
          } else {
            month = 0;
          }
          day = +birthdayMatch[2];
          year = +birthdayMatch[3];
        }

        let leapYear = year % 400 == 0 || (year % 4 == 0 && year % 100 != 0);
        switch (month) {
          case 0: // Jan
          case 2: // March
          case 4: // May
          case 6: // July
          case 7: // Aug
          case 9: // Oct
          case 11: // Dec
            day = day <= 31 ? day : 0;
            break;
          case 3: // Apr
          case 5: // June
          case 8: // Sept
          case 10: // Nov
            break;
          case 1: // Feb
            day = day <= (leapYear ? 29 : 28) ? day : 0;
        }

        if (0 < month && month <= 12 && day != 0) {
          let newDate = new Date(year, month - 1, day);
          if (newDate.valueOf()) {
            this.onMakeEdit("Birthday", newDate);
            e.currentTarget.removeAttribute("aria-invalid");
            return;
          }
        }
        this.onRemoveEdit("Birthday", NA);
        e.currentTarget.setAttribute("aria-invalid", "");
      }
    }

    onEditPhoneNumber(e) {
      const value = e.currentTarget.value.trim();
      if (!e.currentTarget.checkValidity()) {
        this.onRemoveEdit("Phone");
      } else if (value.match(/^[nN]\s*\/?\s*[aA]$/) || !value) {
        this.onMakeEdit("Phone", NA);
      } else {
        this.onMakeEdit("Phone", formatters.Phone(value));
      }
    }

    onEditPronouns(e) {
      const value = e.currentTarget.value.trim();
      if (!e.currentTarget.checkValidity()) {
        this.onRemoveEdit("Pronouns");
      } else if (value.match(/^[nN]\s*\/?\s*[aA]$/) || !value) {
        this.onMakeEdit("Pronouns", NA);
      } else {
        this.onMakeEdit("Pronouns", formatters.Pronouns(value));
      }
    }

    onEditPrompt(e) {
      let index = e.currentTarget.getAttribute("data-index");
      if (!e.currentTarget.checkValidity()) {
        this.onRemoveEdit("Prompt" + index);
      } else {
        this.onMakeEdit("Prompt" + index, e.currentTarget.value.trim());
      }
    }

    onEditComments(e) {
      if (!e.currentTarget.checkValidity()) {
        this.onRemoveEdit("Comments");
      } else {
        this.onMakeEdit("Comments", e.currentTarget.value.trim());
      }
    }
  }

  class FloatingRow extends Component {
    constructor(props) {
      super(props);
    }

    render() {
      return this.props.floatingRow.active ? (
        <ApplicantRow
          {...this.props.floatingRow.props}
          floatingRow={this.props.floatingRow}
          isFloating={true}
        />
      ) : null;
    }
  }

  class ResizableTextarea extends Component {
    constructor(props) {
      super(props);
      this.state = {
        value: props.defaultValue || "",
        ref: React.createRef()
      };
      this.onChange = this.props.onChange ? this.props.onChange.bind(this) : function() {};
      this.oldValue = props.defaultValue || "";
    }

    render() {
      return <textarea
        ref={this.state.ref}
        value={this.state.value}
        onInput={this.onNewValue.bind(this)}
        rows="1"
      />
    }

    componentDidMount() {
      this.onNewValue(false);
    }

    onNewValue(e) {
      const elem = this.state.ref.current;
      this.setState({
        value: elem.value
      });
      let styles = getComputedStyle(elem);
      elem.style.height = "";
      elem.style.height = elem.scrollHeight + parseFloat(styles.borderBottomWidth) + "px";
      if (e && this.oldValue != elem.value) {
        this.onChange(e);
        this.oldValue = elem.value;
      }
    }
  }

  // Wait for us to be logged into Firebase so we know our roles, and then render the React app.
  user.readProfile.then(function(profile) {
    ReactDOM.render(<App years={years}/>, document.getElementById("content"));
  });

  // If gapi fails to load, show an error message.
  gapiLoaded.catch(function (e) {
    document.getElementById("content").style.display = "none";
    document.getElementById("gapi-failed").style.display = "flex";
    document.getElementById("page-reload").addEventListener("click", location.reload.bind(location));
  });
}();