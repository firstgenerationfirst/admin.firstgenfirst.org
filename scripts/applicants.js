!function() {
  "use strict";
  const spreadsheetData = window.applicant_spreadsheets;
  const MISSING_FIELD = spreadsheetData.MISSING_FIELD;
  const NA = spreadsheetData.Enum.NA;
  const applicant_statuses = ["applicant", "finalist", "recipient", "ineligible"];

  let cookies = {};
  for (const cookie of document.cookie.split("; ")) {
    let [name, value] = cookie.split("=");
    cookies[decodeURIComponent(name)] = decodeURIComponent(value);
  }

  let roles = [];
  user.readProfile.then(function(profile) {
    roles = profile.roles;
    IS_EDITOR = roles.includes("applicant_editor");
  });
  let IS_EDITOR = false;

  const applicantMetadata = firebase.firestore().collection("applicant_submissions").doc("voting_metadata");

  function prettyNumber(number, prefix) {
    return isNaN(number) ? number : number % 1000 == 0 && number != 0 ?
      (prefix || "") + (number / 1000).toString().replace(/(\d)(?=(?:\d{3})+$)/g, "$1,") + "k" :
      (prefix || "") + number.toString().replace(/(\d)(?=(?:\d{3})+$)/g, "$1,");
  }

  function prettyDollar(number) {
    return prettyNumber(number, "$");
  }

  function titleCase(string) {
    return string.trim().replace(/\s+/g, " ").toLocaleLowerCase(navigator.language).replace(
      /([^0-9A-Za-zÀ-ÖØ-öø-ÿ]+(?!(?:the|a|an|and|but|or|for|nor|as|if|in|on|of)\b)|^|[^0-9A-Za-zÀ-ÖØ-öø-ÿ]](?=[0-9A-Za-zÀ-ÖØ-öø-ÿ]+$))([0-9A-Za-zÀ-ÖØ-öø-ÿ])/g,
      ($0, $1, $2) => $1 + $2.toLocaleUpperCase(navigator.language)
    );
  }

  function convertNA(f) {
    return a => a == NA ? "N/A" : f(a);
  }

  const stateAbbreviations = {"alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR", "california": "CA", "colorado": "CO", "connecticut": "CT", "delaware": "DE", "florida": "FL", "georgia": "GA", "hawaii": "HI", "idaho": "ID", "illinois": "IL", "indiana": "IN", "iowa": "IA", "kansas": "KS", "kentucky": "KY", "louisiana": "LA", "maine": "ME", "maryland": "MD", "massachusetts": "MA", "michigan": "MI", "minnesota": "MN", "mississippi": "MS", "missouri": "MO", "montana": "MT", "nebraska": "NE", "nevada": "NV", "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND", "ohio": "OH", "oklahoma": "OK", "oregon": "OR", "pennsylvania": "PA", "rhode island": "RI", "south carolina": "SC", "south dakota": "SD", "tennessee": "TN", "texas": "TX", "utah": "UT", "vermont": "VT", "virginia": "VA", "washington": "WA", "west virginia": "WV", "wisconsin": "WI", "wyoming": "WY"};
  const stateAbbreviationValues = Object.values(stateAbbreviations);
  const stateRegex = new RegExp(`^(.+?)(?:(?:,\\s*|\\s+)(${Object.keys(stateAbbreviations).join("|")}))?$`);
  const formatters = {
    First: convertNA(titleCase),
    Last: convertNA(titleCase),
    Email: convertNA(a => a.toLocaleLowerCase(navigator.language)),
    Status: convertNA(a => ({[spreadsheetData.Enum.STATUS.APPLICANT]: "Applicant", [spreadsheetData.Enum.STATUS.FINALIST]: "Finalist", [spreadsheetData.Enum.STATUS.RECIPIENT]: "Recipient", [spreadsheetData.Enum.STATUS.INELIGIBLE]: "Ineligible"})[a] || "N/A"),
    Income:convertNA (a => Array.isArray(a) ? a[1] == "Infinity" ? `${prettyDollar(a[0])}+` : `${prettyDollar(a[0])}–${prettyDollar(a[1])}` : prettyDollar(a)),
    Members: convertNA(prettyNumber),
    EFC: convertNA(prettyDollar),
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
        "Iupui": "Indiana University–Purdue University Indianapolis"
      }
  
      a = titleCase(a).replace(/\bU\b/, "University");
      a = (subs[a] || a).replace(/\b(?:uc|ucla|csu|su|cn|cc|usc|iupui|ca|suny)\b/gi, $0 => $0.toLocaleUpperCase(navigator.language));
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

  class App extends React.Component {
    constructor(props) {
      super(props);

      // Get the most recent year available.
      const thisYear = new Date().getFullYear();
      const mostRecentYear = props.years.filter(year => year - thisYear <= 0).reverse()[0]
      
      this.state = {
        // The current year's spreadsheet data
        spreadsheetData: null,
        // A mapping of years we have already loaded data for
        loadedYears: {},
        // The currently selected year to display applicants for
        selectedYear: mostRecentYear,
        // Whether we are loading a spreadsheet's data
        loading: true,
        // Whether compact mode is on
        compactMode: cookies["applicants-compact_mode"] == "true",
        // Whether Voting Mode is on
        votingMode: false,
        // Whether Unbiased Mode is on
        unbiasedMode: cookies["applicants-unbiased_mode"] == "true",
        // What Details to display
        detailOption: cookies["applicants-details"] || "Icons",
        // The search query in the search bar
        searchQuery: "",
        // Whether we are focusing on an applicant
        isFocusing: false,
        // The ID of the current applicant being focused on
        applicantFocus: null,
        // Whether settings are being shown
        showSettings: false,
        // An object defining filters to search applicants by
        searchFilters: {
          status: applicant_statuses,
          statusIsActive: false,
          id: null,
          idIsActive: false,
          words: [],
          wordsIsActive: false
        },
        // An error message to display (i.e., when applicant data has failed to load)
        error: null
      };

      user.readProfile.then(function(profile) {
        if (profile.roles.includes("applicant_voter")) {
          applicantMetadata.onSnapshot(function(doc) {
            const votingMode = doc.data().voting_mode;
            if (votingMode != this.state.votingMode) {
              this.onToggleVoting(votingMode, true);
            }
          }.bind(this));
        }
      }.bind(this));

      document.addEventListener("click", function() {
        this.onToggleSettingVisibility.call(this, false);
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
            searchQuery={this.state.searchQuery}
            selectedYear={this.state.selectedYear}
            years={this.props.years}
            onSearchQueryChange={this.onSearchQueryChange.bind(this)}
            votingMode={this.state.votingMode}
            unbiasedMode={this.state.unbiasedMode}
            detailOption={this.state.detailOption}
            showSettings={this.state.showSettings}
            onYearChange={this.onYearChange.bind(this)}
            onToggleSettingVisibility={this.onToggleSettingVisibility.bind(this)}
            onToggleVoting={this.onToggleVoting.bind(this)}
            onToggleUnbiased={this.onToggleUnbiased.bind(this)}
            onChangeDetail={this.onChangeDetail.bind(this)}
          />
          <ApplicantTable
            year={this.state.selectedYear}
            searchFilters={this.state.searchFilters}
            spreadsheetData={this.state.spreadsheetData}
            loading={this.state.loading}
            error={this.state.error}
            compactMode={this.state.compactMode}
            unbiasedMode={this.state.unbiasedMode}
            detailOption={this.state.detailOption}
            onFocusApplicant={this.onFocusApplicant.bind(this)}
          />
          <ApplicantModal
            spreadsheetData={this.state.spreadsheetData}
            active={this.state.isFocusing}
            applicant={this.state.applicantFocus}
            year={focusedYear}
            id={focusedID}
            applicantRowIndex={rowIndex}
            unbiasedMode={this.state.unbiasedMode}
            onUnfocus={this.onUnfocus.bind(this)}
          />
        </React.Fragment>
      );
    }

    onSearchQueryChange(query) {
      let searchFilters = {};

      this.setState({
        searchQuery: query
      });
      query = query.toLowerCase().trim();

      // Look for a status keyword, optionally followed by an S
      if (query[query.length - 1] == "s" && applicant_statuses.includes(query.substring(0, query.length - 1))) {
        query = "status:" + query.substring(0, query.length - 1);
      } else if (applicant_statuses.includes(query)) {
        query = "status:" + query
      }

      // Look for "status: "
      const statusMatch = query.match(/(?:\s+|^)status\s*[:=]\s*([a-z]+)(?=\s+|$)/);
      if (statusMatch) {
        query = query.substring(0, statusMatch.index) + query.substring(statusMatch.index + statusMatch[0].length);
        searchFilters.status = applicant_statuses.filter(status => status.indexOf(statusMatch[1]) == 0);
        searchFilters.statusIsActive = true;
      } else {
        searchFilters.status = applicant_statuses;
        searchFilters.statusIsActive = false;
      }

      // Look for "#"
      const idMatch = query.match(/(?:\s+|^)(?:#?(\d+)\s*-\s*([a-f\d]*)|#([a-f\d]+)|([a-f\d]*\d[a-f\d]*))(?=\s+|$)/);
      if (idMatch) {
        query = query.substring(0, idMatch.index) + query.substring(idMatch.index + idMatch[0].length);
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
        if (year < 2000) {
          year += 2000;
        }
        if (!isNaN(id)) {
          searchFilters.id = id;
          searchFilters.idIsActive = true;
        } else {
          searchFilters.id = null;
          searchFilters.idIsActive = false;
        }
        // Load the year's applicants if it is different from the current year
        if (this.state.selectedYear != year) {
          this.onYearChange(year);
        }
      } else {
        searchFilters.id = null;
        searchFilters.idIsActive = false;
      }

      query = query.trim();

      if (query.length) {
        const words = query.split(/\s+/).filter(word => word.length > 1);
        searchFilters.words = words;
        searchFilters.wordsIsActive = !!words.length;
      } else {
        searchFilters.words = [];
        searchFilters.wordsIsActive = false;
      }

      this.setState({
        searchFilters: searchFilters
      });
    }

    onYearChange(year, callback_resolved, callback_rejected) {
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
          error: null,
          loading: false
        });
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

    onFocusApplicant(id) {
      let year = +id.split("-")[0] + 2000;
      if (isNaN(year)) {
        return;
      }
      this.onYearChange(year, function() {
        this.setState({
          isFocusing: true,
          applicantFocus: id
        });
      }.bind(this));
    }

    onUnfocus() {
      this.setState({
        isFocusing: false,
        applicantFocus: null
      });
    }

    onToggleSettingVisibility(shown) {
      this.setState({
        showSettings: shown
      });
    }

    onToggleVoting(value, noUpdate) {
      this.setState({
        votingMode: value,
        unbiasedMode: value
      }, function() {
        this.onSearchQueryChange(this.state.searchQuery);
      }.bind(this));
      if (!noUpdate) {
        applicantMetadata.update({
          voting_mode: value
        });
      }
    }

    onToggleUnbiased(value) {
      let now = new Date();
      now.setFullYear(now.getFullYear() + 2);
      document.cookie = `applicants-unbiased_mode=${value};expires=${now.toUTCString()}`;
      this.setState({
        unbiasedMode: value
      }, function() {
        this.onSearchQueryChange(this.state.searchQuery)
      }.bind(this));
    }

    onChangeDetail(value) {
      let now = new Date();
      now.setFullYear(now.getFullYear() + 2);
      document.cookie = `applicants-details=${value};expires=${now.toUTCString()}`;
      this.setState({
        detailOption: value
      });
    }
  }

  class SearchBar extends React.Component {
    constructor(props) {
      // Fill in the <select> with one <option> per year.
      for (let i = props.years.length - 1; i >= 0; i--) {
        props.years[i] = <option key={props.years[i]}>{props.years[i]}</option>
      }
      super(props);
    }

    // Set the current year once the component is mounted.
    componentDidMount() {
      this.onYearChange(this.props.selectedYear);
    }

    render() {
      return <div id="search_bar">
        <input value={this.props.searchQuery} placeholder="Search Applicants" onChange={e => this.onSearchQueryChange(e.currentTarget.value)}/>
        <select value={this.props.selectedYear} onChange={e => this.onYearChange(e.currentTarget.value)}>{this.props.years}</select>
        <Options
          shown={this.props.showSettings}
          votingMode={this.props.votingMode}
          unbiasedMode={this.props.unbiasedMode}
          detailOption={this.props.detailOption}
          onToggleUnbiased={this.onToggleUnbiased.bind(this)}
          onToggleSettingVisibility={this.onToggleSettingVisibility.bind(this)}
          onToggleVoting={this.onToggleVoting.bind(this)}
          onToggleUnbiased={this.onToggleUnbiased.bind(this)}
          onChangeDetail={this.onChangeDetail.bind(this)}
        />
      </div>
    }

    onSearchQueryChange(query) {
      this.props.onSearchQueryChange(query);
    }

    onYearChange(year) {
      this.props.onYearChange(year);
    }

    onToggleSettingVisibility(shown) {
      this.props.onToggleSettingVisibility(shown);
    }

    onToggleVoting(value) {
      this.props.onToggleVoting(value);
    }

    onToggleUnbiased(value) {
      this.props.onToggleUnbiased(value);
    }

    onChangeDetail(value) {
      this.props.onChangeDetail(value);
    }
  }

  class Options extends React.Component {
    constructor(props) {
      super(props);
    }

    render() {
      return (
        <div id="options" onClick={e => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={this.props.shown}
            onChange={e => this.onToggleSettingVisibility(e.currentTarget.checked)}
          />
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor">
            <path d="M496.647,312.107l-47.061-36.8c1.459-12.844,1.459-25.812,0-38.656l47.104-36.821c8.827-7.109,11.186-19.575,5.568-29.419l-48.96-84.629c-5.639-9.906-17.649-14.232-28.309-10.197l-55.467,22.315c-10.423-7.562-21.588-14.045-33.323-19.349l-8.512-58.923c-1.535-11.312-11.24-19.72-22.656-19.627h-98.133c-11.321-0.068-20.948,8.246-22.528,19.456l-8.533,59.093c-11.699,5.355-22.846,11.843-33.28,19.371L86.94,75.563c-10.55-4.159-22.549,0.115-28.096,10.005L9.841,170.347c-5.769,9.86-3.394,22.463,5.568,29.547l47.061,36.8c-1.473,12.843-1.473,25.813,0,38.656l-47.104,36.8c-8.842,7.099-11.212,19.572-5.589,29.419l48.939,84.651c5.632,9.913,17.649,14.242,28.309,10.197l55.467-22.315c10.432,7.566,21.604,14.056,33.344,19.371l8.533,58.88c1.502,11.282,11.147,19.694,22.528,19.648h98.133c11.342,0.091,21-8.226,22.592-19.456l8.533-59.093c11.698-5.357,22.844-11.845,33.28-19.371l55.68,22.379c10.55,4.149,22.543-0.122,28.096-10.005l49.152-85.12C507.866,331.505,505.447,319.139,496.647,312.107z M255.964,362.667c-58.91,0-106.667-47.756-106.667-106.667s47.756-106.667,106.667-106.667s106.667,47.756,106.667,106.667C362.56,314.882,314.845,362.597,255.964,362.667z"/>
          </svg>
          <div id="options_window">
            {
              roles.includes("applicant_voting_master") ?
              <React.Fragment>
                <div className="option_row">
                  <span className="option_name">Voting Mode</span>
                  <span className="spacer"></span>
                  <span className="option_value">
                    <input
                      type="checkbox"
                      className="toggler"
                      disabled
                      checked={this.props.votingMode}
                      onChange={e => !e.currentTarget.disabled && this.onToggleVoting(e.currentTarget.checked)}
                    />
                    <span></span>
                  </span>
                </div>
                <div className="option_desc">
                  Coming soon to a website near you! :D
                </div>
              </React.Fragment>
              : null
            }
            <div className="option_row">
              <span className="option_name">Unbiased Mode</span>
              <span className="spacer"></span>
              <span className="option_value">
                <input
                  type="checkbox"
                  className="toggler"
                  checked={this.props.unbiasedMode || this.props.votingMode}
                  disabled={this.props.votingMode}
                  onChange={e => !e.currentTarget.disabled && this.onToggleUnbiased(e.currentTarget.checked)}
                />
                <span></span>
              </span>
            </div>
            <div className="option_desc">
              Hides personally identifying information to prevent bias.
            </div>
            {
              this.props.votingMode ?
              <div className="option_desc option_alert">
                Unbiased Mode cannot be turned off while voting.
              </div>
              : null
            }
            <div className="option_row">
              <span className="option_name">Details</span>
              <span className="spacer"></span>
              <span className="option_value">
                <select value={this.props.detailOption} onChange={e => this.onChangeDetail(e.currentTarget.value)}>
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

    onToggleSettingVisibility(shown) {
      this.props.onToggleSettingVisibility(shown);
    }

    onToggleVoting(value) {
      this.props.onToggleVoting(value);
    }

    onToggleUnbiased(value) {
      this.props.onToggleUnbiased(value);
    }

    onChangeDetail(value) {
      this.props.onChangeDetail(value);
    }
  }

  class ApplicantTable extends React.Component {
    constructor(props) {
      super(props);
      this.state = {};
    }

    render() {
      const filters = this.props.searchFilters;

      let preMessage = [];

      if (this.props.unbiasedMode) {
        preMessage.push("Unbiased Mode is enabled. Names and other personally identifying information have been hidden.");
      }

      if (this.props.loading) {
        return (
          <React.Fragment>
            <div id="pre_applicant_message" className={preMessage.length ? "" : "hidden"}>{preMessage}</div>
            <div id="applicant_table" className={this.props.compactMode ? "compact" : ""}>
              <div id="applicant_message">
                Loading Applicant Data...
              </div>
            </div>
            <div id="applicant_status_legend">
              <div>
                <div>
                  <div className={"applicant_status applicant_status_applicant" + (filters.statusIsActive && filters.status == "applicant" ? " filtering" : "")}>A</div>
                  <span>Applicant</span>
                </div>
                <div>
                  <div className={"applicant_status applicant_status_finalist" + (filters.statusIsActive && filters.status == "finalist" ? " filtering" : "")}>F</div>
                  <span>Finalist</span>
                </div>
                <div>
                  <div className={"applicant_status applicant_status_recipient" + (filters.statusIsActive && filters.status == "recipient" ? " filtering" : "")}>R</div>
                  <span>Recipient</span>
                </div>
                <div>
                  <div className={"applicant_status applicant_status_ineligible" + (filters.statusIsActive && filters.status == "ineligible" ? " filtering" : "")}>I</div>
                  <span>Ineligible</span>
                </div>
              </div>
            </div>
          </React.Fragment>
        );
      }

      if (this.props.error !== null) {
        return (
          <React.Fragment>
            <div id="pre_applicant_message" className={preMessage.length ? "" : "hidden"}>{preMessage}</div>
            <div id="applicant_table" className={this.props.compactMode ? "compact" : ""}>
              <div id="applicant_error">
                {this.props.error}
              </div>
            </div>
            <div id="applicant_status_legend">
              <div>
                <div>
                  <div className={"applicant_status applicant_status_applicant" + (filters.statusIsActive && filters.status == "applicant" ? " filtering" : "")}>A</div>
                  <span>Applicant</span>
                </div>
                <div>
                  <div className={"applicant_status applicant_status_finalist" + (filters.statusIsActive && filters.status == "finalist" ? " filtering" : "")}>F</div>
                  <span>Finalist</span>
                </div>
                <div>
                  <div className={"applicant_status applicant_status_recipient" + (filters.statusIsActive && filters.status == "recipient" ? " filtering" : "")}>R</div>
                  <span>Recipient</span>
                </div>
                <div>
                  <div className={"applicant_status applicant_status_ineligible" + (filters.statusIsActive && filters.status == "ineligible" ? " filtering" : "")}>I</div>
                  <span>Ineligible</span>
                </div>
              </div>
            </div>
          </React.Fragment>
        );
      }

      const data = this.props.spreadsheetData;
      let filteredRowIndexes = [];
      let filteredByObjects = [];

      for (let i = 0, l = data.rows.length; i < l; i++) {
        const row = data.rows[i];
        let status = ({
          [spreadsheetData.Enum.STATUS.APPLICANT]: "applicant",
          [spreadsheetData.Enum.STATUS.FINALIST]: "finalist",
          [spreadsheetData.Enum.STATUS.RECIPIENT]: "recipient",
          [spreadsheetData.Enum.STATUS.INELIGIBLE]: "ineligible"
        })[row[data.c_Status]];

        let filteredBy = {};

        // ID is handled later
        if (filters.idIsActive) {
          if (parseInt(row[data.c_ID], 16) == filters.id) {
            filteredBy.ID = true;
          } else {
            continue;
          }
        }

        // Status is also handled later
        if (filters.statusIsActive) {
          if (filters.status.includes(status)) {
            filteredBy.Status = true;
          } else {
            continue;
          }
        }

        // Go through all the words and look for matches in a set of fields.
        const searchableFields = ["Email", "College", "Location"];
        if (!this.props.unbiasedMode) {
          searchableFields.unshift("First", "Last");
        }
        if (filters.wordsIsActive) {
          let matchedAllWords = true;
          for (const word of filters.words) {
            let matchedWord = false;
            for (const col of searchableFields) {
              let value;
              try {
                value = row[data.c(col)];
              } catch (err) {
                continue;
              }
              if (value == NA) {
                continue;
              }
              value = formatters[col](value).toLowerCase();
              filteredBy[col] = filteredBy[col] || [];

              let startIndex = 0;
              let index;
              while (~(index = value.indexOf(word, startIndex))) {
                filteredBy[col].push([index, index + word.length]);
                startIndex = index + 1;
                matchedWord = true;
              }
            }

            if (!matchedWord) {
              matchedAllWords = false;
              break;
            }
          }

          if (!matchedAllWords) {
            continue;
          }

          // Collapse the array of ranges
          for (const col in filteredBy) {
            if (Array.isArray(filteredBy[col])) {
              filteredBy[col].sort((r1, r2) => r1[0] - r2[0]);
              let collapsed = [[0,0]];
              for (let i = 0, l = filteredBy[col].length; i < l; i++) {
                if (filteredBy[col][i][0] > collapsed[collapsed.length - 1][1]) {
                  collapsed.push(filteredBy[col][i]);
                } else if (filteredBy[col][i][1] > collapsed[collapsed.length - 1][1]) {
                  collapsed[collapsed.length - 1][1] = filteredBy[col][i][1]
                }
              }
              filteredBy[col] = collapsed;
            }
          }
        }

        filteredRowIndexes.push(i);
        filteredByObjects.push(filteredBy);
      }

      let rowComponents = [];
      for (let i = 0, l = data.rows.length; i < l; i++) {
        const row = data.rows[i];
        const filteredIndex = filteredRowIndexes.indexOf(i);
        const status = ({
          [spreadsheetData.Enum.STATUS.APPLICANT]: "applicant",
          [spreadsheetData.Enum.STATUS.FINALIST]: "finalist",
          [spreadsheetData.Enum.STATUS.RECIPIENT]: "recipient",
          [spreadsheetData.Enum.STATUS.INELIGIBLE]: "ineligible"
        })[row[data.c_Status]];
        let matchedQuery = [];

        let filteredBy = filteredByObjects[filteredIndex] || {};
        if (filteredBy.ID && this.props.detailOption != "#ID") {
          matchedQuery.push(
            <div key="ID" className="whole_match">
               #{this.props.year - 2000}-{row[data.c_ID]}
            </div>
          );
        }
        let effectiveFirstName = titleCase(row[data.c_First]);
        let effectiveLastName = titleCase(row[data.c_Last]);
        for (const col in filteredBy) {
          if (Array.isArray(filteredBy[col])) {
            let value;
            try {
              value = row[data.c(col)];
              if (value == NA) {
                continue;
              }
            } catch (err) {
              continue;
            }
            value = formatters[col](value);

            let isWholeMatch = true;
            let matches = [];
            for (let i = 0, l = filteredBy[col].length; i < l; i++) {
              if (filteredBy[col][i][0] != filteredBy[col][i][1]) {
                matches.push(<span key={i} className="filtering">{value.substring(filteredBy[col][i][0], filteredBy[col][i][1])}</span>);
              }
              let followingString = value.substring(filteredBy[col][i][1], i == l - 1 ? value.length : filteredBy[col][i + 1][0]);
              isWholeMatch = followingString.match(/^[^a-zA-Z\d]*$/) && isWholeMatch;
              matches.push(followingString);
            }
            
            if (col == "First") {
              effectiveFirstName = matches;
            } else if (col == "Last") {
              effectiveLastName = matches;
            } else if (matches.length > 1 || typeof matches[0] != "string") {
              matchedQuery.push(
                <div key={col} className={isWholeMatch ? "whole_match" : "partial_match"}>
                   {matches}
                </div>
              );
            }
          }
        }

        let icons = [];
        try {
          icons = row[data.c("Icons")];
          icons = icons == NA ? [] : icons;
        } catch (err) {}
        if (icons.length && this.props.detailOption == "Icons") {
          icons = icons.map((icon) => spreadsheetData.ICONS[icon] || null);
        }

        rowComponents.push(
          this.props.unbiasedMode ? 
          <button
            key={(this.props.year - 2000) + "-" + row[data.c_ID]}
            className={"applicant_row applicant_status_" + status + (
              ~filteredIndex && (filteredIndex == 0 || data.rows[filteredRowIndexes[filteredIndex - 1]][data.c_Status] != data.rows[i][data.c_Status]) ? " br_top" : ""
            ) + (
              ~filteredIndex && (filteredIndex == filteredRowIndexes.length - 1 || data.rows[filteredRowIndexes[filteredIndex + 1]][data.c_Status] != data.rows[i][data.c_Status]) ? " br_bottom" : ""
            ) + (
              ~filteredIndex ? "" : " hidden"
            )}
            data-applicant-id={(this.props.year - 2000) + "-" + row[data.c_ID]}
            onClick={e => this.onFocusApplicant(e.currentTarget.getAttribute("data-applicant-id"))}
          >
            <div className={"applicant_status" + (filteredBy.Status ? " filtering" : "")}>
              {status[0].toUpperCase()}
            </div>
            <div className={"applicant_id" + (filters.idIsActive ? " filtering" : "")}>
              <span>#{this.props.year - 2000}-{row[data.c_ID]}</span>
            </div>
            <div className="applicant_match spacer">
              {matchedQuery}
            </div>
            {
              this.props.detailOption == "Icons" || this.props.detailOption == "#ID" ?
              <div className="applicant_icons">
                {icons}
              </div> :
              null
            }
          </button>
          :
          <button
            key={(this.props.year - 2000) + "-" + row[data.c_ID]}
            className={"applicant_row applicant_status_" + status + (
              ~filteredIndex && (filteredIndex == 0 || data.rows[filteredRowIndexes[filteredIndex - 1]][data.c_Status] != data.rows[i][data.c_Status]) ? " br_top" : ""
            ) + (
              ~filteredIndex && (filteredIndex == filteredRowIndexes.length - 1 || data.rows[filteredRowIndexes[filteredIndex + 1]][data.c_Status] != data.rows[i][data.c_Status]) ? " br_bottom" : ""
            ) + (
              ~filteredIndex ? "" : " hidden"
            )}
            data-applicant-id={(this.props.year - 2000) + "-" + row[data.c_ID]}
            onClick={e => this.props.onFocusApplicant(e.currentTarget.getAttribute("data-applicant-id"))}
          >
            <div className={"applicant_status" + (filters.statusIsActive ? " filtering" : "")}>
              {status[0].toUpperCase()}
            </div>
            <div className="applicant_name">
              {effectiveFirstName} {effectiveLastName}
            </div>
            <div className="applicant_match spacer">
              {matchedQuery}
            </div>
            {
              this.props.detailOption == "#ID" ?
              <div className="applicant_id">
                <span className={filteredBy.ID ? "filtering" : ""}>#{(this.props.year - 2000) + "-" + row[data.c_ID]}</span>
              </div> :
              this.props.detailOption == "Icons" ?
              <div className="applicant_icons">
                {icons}
              </div> :
              null
            }
          </button>
        );
      }
      return (
        <React.Fragment>
          <div id="pre_applicant_message" className={preMessage.length ? "" : "hidden"}>{preMessage}</div>
          <div id="applicant_table"  className={(
            this.props.compactMode ? " compact" : ""
          ) + (
            this.props.unbiasedMode ? " unbiased" : ""
          )}>
            {
              filteredRowIndexes.length ?
              "" :
              <div id="applicant_message">
                No Results
              </div>
            }
            {rowComponents}
          </div>
          <div id="applicant_status_legend">
            <div>
              <div>
                <div className={"applicant_status applicant_status_applicant" + (filters.statusIsActive && filters.status == "applicant" ? " filtering" : "")}>A</div>
                <span>Applicant</span>
              </div>
              <div>
                <div className={"applicant_status applicant_status_finalist" + (filters.statusIsActive && filters.status == "finalist" ? " filtering" : "")}>F</div>
                <span>Finalist</span>
              </div>
              <div>
                <div className={"applicant_status applicant_status_recipient" + (filters.statusIsActive && filters.status == "recipient" ? " filtering" : "")}>R</div>
                <span>Recipient</span>
              </div>
              <div>
                <div className={"applicant_status applicant_status_ineligible" + (filters.statusIsActive && filters.status == "ineligible" ? " filtering" : "")}>I</div>
                <span>Ineligible</span>
              </div>
            </div>
          </div>
        </React.Fragment>
      );
    }

    onFocusApplicant(id) {
      this.props.onFocusApplicant(id);
    }
  }

  class ApplicantModal extends React.Component {
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
          this.onUnfocus();
        }
      }.bind(this));
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
          if (col in spreadsheetData[year].eliminators && status == "Applicant") {
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
                <ResizableTextarea defaultValue={row[index].trim()} onChange={e => this.onEditPrompt(e, i)}/> :
                <div
                  className="modal_prompt_response"
                  onInput={e => undefined}
                >{row[index].trim()}</div>
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
            <div
              className="modal_prompt_response"
              onInput={e => undefined}
            >{additional_comments}</div>
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
              <button className="destructive" onClick={e => {this.onUnfocus("force")}}>Exit</button>
            </div>
          </React.Fragment>
        );
      }

      return (
        <div
          id="modal_back"
          onClick={this.onUnfocus.bind(this)}
        >
          <div
            id="applicant_modal"
            onClick={this.onClickModal.bind(this)}
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
                  has_elim && IS_EDITOR && !this.state.editing ?
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
                          pattern="\s*(?:\$?\s*\d+(?:[,\s]\d*)*\s*(?:\.\s*\d*(?:\s\d*)*)?(?:\s*[kK])?|[nN]\s*\/?\s*[aA])\s*"
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
                  <button onClick={this.onUnfocus.bind(this)}>Close</button>
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

    onUnfocus(e) {
      if (!this.props.active) {
        return;
      }
      if (this.state.editing && Object.keys(this.state.edits).length != 0 && e != "force") {
        this.setState({
          warnUnsavedEdit: true
        });
      } else {
        this.onAbortEdit(e);
        this.props.onUnfocus();
      }
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
        if (iconName = node.getAttribute("data-icon-name") || node.previousElementSibling.getAttribute("data-icon-name")) {
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
      } else {
        let efc = value.replace(/[,\s\$]/g, "").toLowerCase();
        if (efc[efc.length - 1] == "k") {
          efc = efc.substring(0, efc.length - 1) * 1000;
        }
        this.onMakeEdit("EFC", Math.floor(efc));
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

    onEditPrompt(e, index) {
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

  class ResizableTextarea extends React.Component {
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

  let years = [];
  // Get all the available years, starting from 2020.
  for (const key in spreadsheetData) {
    if (!isNaN(key)) {
      years.push(key);
    }
  }
  years.sort();

  user.logIn.then(function() {
    ReactDOM.render(<App years={years}/>, document.getElementById("content"));
  });

  gapiLoaded.catch(function () {
    document.getElementById("content").style.display = "none";
    document.getElementById("gapi-failed").style.display = "flex";
    document.getElementById("page-reload").addEventListener("click", location.reload.bind(location));
  });
}();