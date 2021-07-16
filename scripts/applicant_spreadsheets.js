!function() {
	"use strict";
	const MISSING_FIELD = Symbol("MISSING_FIELD");
	const Enum = {
		NA: Symbol("N/A"),
		STATUS: {
			APPLICANT: Symbol("STATUS.APPLICANT"),
			FINALIST: Symbol("STATUS.FINALIST"),
			RECIPIENT: Symbol("STATUS.RECIPIENT"),
			INELIGIBLE: Symbol("STATUS.INELIGIBLE"),
		},
		YEAR: {
			HIGH_SCHOOL: Symbol("YEAR.HIGH_SCHOOL"),
			FIRST_YEAR: Symbol("YEAR.FIRST_YEAR"),
			COLLEGE: Symbol("YEAR.COLLEGE"),
			GRADUATE: Symbol("YEAR.GRADUATE"),
			TRANSFER: Symbol("YEAR.TRANSFER")
		},
		LOANS: {
			NO: Symbol("LOANS.NO"),
			YES: Symbol("LOANS.YES"),
			UNCERTAIN: Symbol("LOANS.UNCERTAIN")
		},
		CAMPUS_LIVING: {
			ON_CAMPUS: Symbol("CAMPUS_LIVING.ON_CAMPUS"),
			OFF_CAMPUS_RENT: Symbol("CAMPUS_LIVING.OFF_CAMPUS_RENT"),
			OFF_CAMPUS_NO_RENT: Symbol("CAMPUS_LIVING.OFF_CAMPUS_NO_RENT"),
			UNCERTAIN: Symbol("CAMPUS_LIVING.UNCERTAIN")
		},
		PARENT1_EDUCATION: {
			NO_DIPLOMA: Symbol("PARENT1_EDUCATION.NO_DIPLOMA"),
			DIPLOMA: Symbol("PARENT1_EDUCATION.DIPLOMA"),
			SOME_COLLEGE: Symbol("PARENT1_EDUCATION.SOME_COLLEGE"),
			DEGREE: Symbol("PARENT1_EDUCATION.DEGREE"),
			MULTIPLE_DEGREES: Symbol("PARENT1_EDUCATION.MULTIPLE_DEGREES"),
			NO_PARENT: Symbol("PARENT1_EDUCATION.NO_PARENT")
		},
		PARENT2_EDUCATION: {
			NO_DIPLOMA: Symbol("PARENT2_EDUCATION.NO_DIPLOMA"),
			DIPLOMA: Symbol("PARENT2_EDUCATION.DIPLOMA"),
			SOME_COLLEGE: Symbol("PARENT2_EDUCATION.SOME_COLLEGE"),
			DEGREE: Symbol("PARENT2_EDUCATION.DEGREE"),
			MULTIPLE_DEGREES: Symbol("PARENT2_EDUCATION.MULTIPLE_DEGREES"),
			NO_PARENT: Symbol("PARENT2_EDUCATION.NO_PARENT")
		}
	}

	window.applicant_spreadsheets = {
		MISSING_FIELD: MISSING_FIELD,
		Enum: Enum,
		2020: {
			// The spreadsheet's ID (found in the URL)
			id: "14jB6c6imlm2Dt3CdQOwn_N7kZc39LVx_DH278zc9bbE",
			// The sheet tab to focus on (at the bottom of the screen)
			sheet: "Form Responses 1",
			// A mapping of headings to identify which column corresponds to what
			mapping: {
				// The applicant's status – One of Enum.STATUS
				// Status: "Status",
				// The unique ID assigned to each applicant – Any hexadecimal number string
				// ID: "ID",
				// The applicant's first name – Any string
				First: "First Name",
				// The applicant's last name – Any string
				Last: "Last Name",
				// The applicant's email address – Any string that matches the format of an email address or Enum.NA
				Email: "Email Address",
				// The applicant's pronouns – Any string with "/" delimiters for different pronouns or Enum.NA
				Pronouns: MISSING_FIELD,
				// The applicant's phone number – Any string that matches the format of a phone number or Enum.NA
				Phone: "Phone Number (xxx) xxx - xxxx",
				// The applicant's birth date – A Date object or Enum.NA
				// Birthday: "Birthday",
				// The name of the college the applicant will be attending – Any string or Enum.NA
				College: "Name of College you will be attending",
				// The applicant's upcoming class year in college – One of Enum.YEAR or Enum.NA
				Year: "Class Year ",
				// The location (City, State) the applicant is living in right now (i.e. the summer before they go to college) – Any string or Enum.NA
				Location: "City, State you currently live in",
				// Whether the applicant's college is requiring them to take out loans – One of Enum.LOANS or Enum.NA
				Loans: "Is your college requiring you to take out loans?",
				// Whether the applicant will be living on campus – One of Enum.CAMPUS_LIVING or Enum.NA
				Campus_Living: "Will you be living on-campus?",
				// The applicant's household income – Either a 2-long Array of nonnegative numbers, a single nonnegative number, or Enum.NA
				//   2-long Array – a range of values that the actual household income falls into (use Infinity to represent an open range like "$100k+")
				//   Number – the applicant's exact household income
				Income: "Household Income",
				// The number of members in the applicant's household, including the applicant – Any positive number or Enum.NA
				Members: MISSING_FIELD,
				// The applicant's Expected Family Contribution from their FAFSA SAR – Any nonnegative number or Enum.NA
				EFC: "EFC - This number should be in your SAR for FAFSA or in your financial aid offer from your college",
				// The applicant's first parent's level of education – One of Enum.PARENT1_EDUCATION or Enum.NA
				Parent1_Education: "Parent 1 Education",
				// The applicant's first parent's level of education – One of Enum.PARENT2_EDUCATION or Enum.NA
				Parent2_Education: "Parent 2 Education",
				// A list of headers that correspond to written prompts on application
				Prompts: [
					"Why do you think you should receive the FGF Scholarship? (350 words max)",
					"Tell us about something you are passionate about. Feel free to rant about anything that can help us know a little more about who you are :) (350 words max)"
				],
				// Additional comments – Any string
				Comments: "Additional Comments? Something you might want us to take into consideration when reading your application? (100 words max) ",
				// A list of icons that the applicant is associated with and is displayed next to their name – A string of "|"-delimited values
				Icons: MISSING_FIELD
			},
			// A list of prompt texts to display for each prompt (must be the same length as .mapping.prompts)
			prompts: [
				"Why do you think you should receive the FGF Scholarship?",
				"What is something you are passionate about?"
			],
			// Functions that convert a spreadsheet value to the expected JavaScript value or vice versa
			translate: {
				// Translate values FROM the spreadsheet to their corresponding JavaScript value
				from: {
					ID: a => (+a).toString(16).toUpperCase(),
					Status: a => ({"Applicant": Enum.STATUS.APPLICANT, "Finalist": Enum.STATUS.FINALIST, "Recipient": Enum.STATUS.RECIPIENT, "Ineligible": Enum.STATUS.INELIGIBLE})[a] || Enum.STATUS.APPLICANT,
					Loans: a => ({"No": Enum.LOANS.NO, "Yes": Enum.LOANS.YES})[a] || Enum.NA,
					Year: a => ({"FY": Enum.YEAR.FIRST_YEAR, "GRAD": Enum.YEAR.GRADUATE, "RSJSC": Enum.YEAR.COLLEGE, "RSJSHS": Enum.YEAR.HIGH_SCHOOL, "TRANSF": Enum.YEAR.TRANSFER})[a] || Enum.NA,
					Campus_Living: a => ({"OFFNP": Enum.CAMPUS_LIVING.OFF_CAMPUS_NO_RENT, "OFFP": Enum.CAMPUS_LIVING.OFF_CAMPUS_RENT, "ONC": Enum.CAMPUS_LIVING.ON_CAMPUS, "UNS": Enum.CAMPUS_LIVING.UNCERTAIN})[a] || Enum.NA,
					Income: function(a) {
						let match;
						if (match = a.match(/\$?(\d+),0(?:00)?\s*-\s*\$?(\d+),0(?:00)?/)) {
							return [match[1] * 1000, match[2] * 1000];
						} else if (match = a.match(/\$?(\d+)\s*-\s*\$?(\d+)/)) {
							return [match[1], match[2]];
						} else if (match = a.match(/Less than \$?(\d+),0(?:00)?/)) {
							return [0, match[1] * 1000];
						} else if (match = a.match(/Less than \$(\d+)/)) {
							return [0, match[1]];
						} else if (match = a.match(/More than \$?(\d+),0(?:00)?/)) {
							return [match[1] * 1000, Infinity];
						} else if (match = a.match(/More than \$?(\d+)/)) {
							return [match[1], Infinity];
						} else if (match = a.match(/\$?(\d+)/)) {
							return +match[1];
						} else {
							return Enum.NA;
						}
					},
					EFC: function (a) {
						a = +(a.trim().replace(/^\$?0*|\.0*$|\s/g, "").replace(/,0$/, "000").replace(/,/g, "") || "0");
						return isNaN(a) ? Enum.NA : a;
					},
					Parent1_Education: a => ({"CD": Enum.PARENT1_EDUCATION.DEGREE, "HSDE": Enum.PARENT1_EDUCATION.DIPLOMA, "MCD": Enum.PARENT1_EDUCATION.MULTIPLE_DEGREES, "NHSD": Enum.PARENT1_EDUCATION.NO_DIPLOMA, "SC": Enum.PARENT1_EDUCATION.SOME_COLLEGE})[a] || Enum.NA,
					Parent2_Education: a => ({"CD": Enum.PARENT2_EDUCATION.DEGREE, "HSDE": Enum.PARENT2_EDUCATION.DIPLOMA, "MCD": Enum.PARENT2_EDUCATION.MULTIPLE_DEGREES, "NHSD": Enum.PARENT2_EDUCATION.NO_DIPLOMA, "SC": Enum.PARENT2_EDUCATION.SOME_COLLEGE})[a] || Enum.NA,
					Birthday: a => {let b = new Date(a);return b.valueOf() ? b : Enum.NA}
				},
				// Translate values TO a spreadsheet value to be stored long term on Google Sheets
				to: {
					ID: a => parseInt(a, 16),
					Status: a => ({[Enum.STATUS.APPLICANT]: "Applicant", [Enum.STATUS.FINALIST]: "Finalist", [Enum.STATUS.RECIPIENT]: "Recipient", [Enum.STATUS.INELIGIBLE]: "Ineligible"})[a] || "Applicant",
					Loans: a => ({[Enum.LOANS.NO]: "No", [Enum.LOANS.YES]: "Yes", [Enum.NA]: "N/A"})[a] || "N/A",
					Year: a => ({[Enum.YEAR.FIRST_YEAR]: "FY", [Enum.YEAR.GRADUATE]: "GRAD", [Enum.YEAR.COLLEGE]: "RSJSC", [Enum.YEAR.HIGH_SCHOOL]: "RSJSHS", [Enum.YEAR.TRANSFER]: "TRANSF"})[a] || "N/A",
					Campus_Living: a => ({[Enum.CAMPUS_LIVING.OFF_CAMPUS_NO_RENT]: "OFFNP", [Enum.CAMPUS_LIVING.OFF_CAMPUS_RENT]: "OFFP", [Enum.CAMPUS_LIVING.ON_CAMPUS]: "ONC", [Enum.CAMPUS_LIVING.UNCERTAIN]: "UNS"})[a] || "N/A",
					Income: function(a) {
						if (Array.isArray(a)) {
							if (a[1] == Infinity) {
								return "More than " + a[0];
							} else {
								return `${a[0]}-${a[1]}`;
							}
						} else if (!isNaN(a)) {
							return a.toString();
						} else {
							return "N/A";
						}
					},
					Parent1_Education: a => ({[Enum.PARENT1_EDUCATION.DEGREE]: "CD", [Enum.PARENT1_EDUCATION.DIPLOMA]: "HSDE", [Enum.PARENT1_EDUCATION.MULTIPLE_DEGREES]: "MCD", [Enum.PARENT1_EDUCATION.NO_DIPLOMA]: "NHSD", [Enum.PARENT1_EDUCATION.SOME_COLLEGE]: "SC"})[a] || "N/A",
					Parent2_Education: a => ({[Enum.PARENT2_EDUCATION.DEGREE]: "CD", [Enum.PARENT2_EDUCATION.DIPLOMA]: "HSDE", [Enum.PARENT2_EDUCATION.MULTIPLE_DEGREES]: "MCD", [Enum.PARENT2_EDUCATION.NO_DIPLOMA]: "NHSD", [Enum.PARENT2_EDUCATION.SOME_COLLEGE]: "SC"})[a] || "N/A",
					Birthday: a => a == Enum.NA ? "N/A" : a.toUTCString()
				}
			},
			// Functions that check if any fields's values make that applicant eliminable (e.g. if they're not first-gen).
			// This does not eliminate an applicant automatically.
			// Instead, it just highlights the field so that a real person has to decide to eliminate or not.
			eliminators: {
				Year: notFirstYear,
				Parent1_Education: notFirstGen,
				Parent2_Education: notFirstGen,
				Income: notLowIncome
			}
		},
		2021: {
			id: "1VI6XJehnjMr-R97FP0vTRb0WYn_75ETo0GpQG4EDlGI",
			sheet: "Form Responses 1",
			mapping: {
				Email: "Email Address",
				First: "First Name",
				Last: "Last Name",
				Pronouns: "Pronouns",
				Birthday: "Birthdate ",
				Phone: "Phone Number (xxx) xxx - xxxx",
				College: "Name of College you will be attending in Fall 2021",
				Year: "Class Year",
				Location: "City, State you currently live in",
				Loans: "Is your college requiring you to take out loans?",
				Campus_Living: "Will you be living on-campus?",
				Income: "Household Annual Income",
				Members: "How many members live in your household, including yourself?",
				EFC: "Expected Family Contribution (EFC) This number should appear after you have completed your FAFSA application OR in your financial aid offer from your college. If you are an undocumented student who is ineligible for FAFSA, please state so and insert the amount your family is expected to pay for college. https://studentaid.gov/help-center/answers/article/what-is-efc ",
				Parent1_Education: "Parent 1 Education",
				Parent2_Education: "Parent 2 Education",
				Status: "Status",
				ID: "ID",
				Icons: "Icons",
				Prompts: [
					"Why do you think you should receive the First Gen First Scholarship? (350 words max)",
					"Tell us about something you are passionate about. Feel free to rant about anything that can help us know a little bit more about you :) (350 words max)"
				],
				Comments: "Additional comments? Is there anything else we should take into consideration while reading your application? (100 words max)"
			},
			prompts: [
				"Why do you think you should receive the FGF scholarship?",
				"What is something you are passionate about?"
			],
			translate: {
				from: {
					Status: a => ({"Applicant": Enum.STATUS.APPLICANT, "Finalist": Enum.STATUS.FINALIST, "Recipient": Enum.STATUS.RECIPIENT, "Ineligible": Enum.STATUS.INELIGIBLE})[a] || Enum.STATUS.APPLICANT,
					Income: function(a) {
						a = a.replace(/,/g, "");
						let match;
						if (match = a.match(/^\$?(\d+)\s*-\s*\$?(\d+)/)) {
							return [match[1], match[2]];
						} else if (match = a.match(/^Less than \$?(\d+)$/)) {
							return [0, match[1]];
						} else if (match = a.match(/^More than \$?(\d+)$/)) {
							return [match[1] * 1000, Infinity];
						} else if (match = a.match(/^\$?(\d+)$/)) {
							return +match[1];
						} else {
							return Enum.NA;
						}
					},
					Loans: a => ({"No": Enum.LOANS.NO, "Yes": Enum.LOANS.YES})[a] || Enum.NA,
					Campus_Living: a => ({"Off-campus, not paying rent": Enum.CAMPUS_LIVING.OFF_CAMPUS_NO_RENT, "Off-campus, paying rent": Enum.CAMPUS_LIVING.OFF_CAMPUS_RENT, "On-Campus": Enum.CAMPUS_LIVING.ON_CAMPUS, "Not sure yet": Enum.CAMPUS_LIVING.UNCERTAIN})[a] || Enum.NA,
					Year: a => ({"Incoming First Year into college": Enum.YEAR.FIRST_YEAR, "Rising Freshman/Sophomore/Junior/Senior in high school": Enum.YEAR.HIGH_SCHOOL, "Rising Sophomore/Junior/Senior in college": Enum.YEAR.COLLEGE, "Graduate Student": Enum.YEAR.GRADUATE, "Transfer Student": Enum.YEAR.TRANSFER})[a] || Enum.NA,
					Parent1_Education: a => ({"One college degree": Enum.PARENT1_EDUCATION.DEGREE, "High school diploma or equivalent": Enum.PARENT1_EDUCATION.DIPLOMA, "More than one college degree": Enum.PARENT1_EDUCATION.MULTIPLE_DEGREES, "No high school diploma or equivalent": Enum.PARENT1_EDUCATION.NO_DIPLOMA, "Some college": Enum.PARENT1_EDUCATION.SOME_COLLEGE, "No Parent 1": Enum.PARENT1_EDUCATION.NO_PARENT})[a] || Enum.NA,
					Parent2_Education: a => ({"One college degree": Enum.PARENT2_EDUCATION.DEGREE, "High school diploma or equivalent": Enum.PARENT2_EDUCATION.DIPLOMA, "More than one college degree": Enum.PARENT2_EDUCATION.MULTIPLE_DEGREES, "No high school diploma or equivalent": Enum.PARENT2_EDUCATION.NO_DIPLOMA, "Some college": Enum.PARENT2_EDUCATION.SOME_COLLEGE, "No Parent 2": Enum.PARENT2_EDUCATION.NO_PARENT})[a] || Enum.NA,
					Campus_Living: a => ({"On-campus": Enum.CAMPUS_LIVING.ON_CAMPUS, "Off-campus, paying rent": Enum.CAMPUS_LIVING.OFF_CAMPUS_RENT, "Off campus, not paying rent": Enum.CAMPUS_LIVING.OFF_CAMPUS_NO_RENT, "Uncertain": Enum.CAMPUS_LIVING.UNCERTAIN})[a] || Enum.NA,
					Members: stringToNumberOr(Enum.NA),
					EFC: function (a) {
						a = +(a.trim().replace(/^\$?0*|\.0*$|\s|,/g, "") || "0");
						return isNaN(a) ? Enum.NA : a;
					},
					Birthday: a => new Date(a)
				},
				to: {
					Status: a => ({[Enum.STATUS.APPLICANT]: "Applicant", [Enum.STATUS.FINALIST]: "Finalist", [Enum.STATUS.RECIPIENT]: "Recipient", [Enum.STATUS.INELIGIBLE]: "Ineligible"})[a] || "Applicant",
					Income: a => a ? Array.isArray(a) ? a[1] == Infinity ? `More than $${a[0]}` : `$${a[0]} - $${a[1]}` : `$${a}` : "N/A",
					Loans: a => ({[Enum.LOANS.NO]: "No", [Enum.LOANS.YES]: "Yes", [Enum.NA]: "N/A"})[a] || "N/A",
					Campus_Living: a => ({[Enum.CAMPUS_LIVING.OFF_CAMPUS_RENT]: "Off-campus, paying rent", [Enum.CAMPUS_LIVING.OFF_CAMPUS_NO_RENT]: "Off-campus, not paying rent", [Enum.CAMPUS_LIVING.ON_CAMPUS]: "On-campus", [Enum.CAMPUS_LIVING.UNCERTAIN]: "Not sure yet"})[a] || "N/A",
					Year: a => ({[Enum.YEAR.FIRST_YEAR]: "Incoming First Year into college", [Enum.YEAR.HIGH_SCHOOL]: "Rising Freshman/Sophomore/Junior/Senior in high school", [Enum.YEAR.COLLEGE]: "Rising Sophomore/Junior/Senior in college", [Enum.YEAR.GRADUATE]: "Graduate Student", [Enum.YEAR.TRANSFER]: "Transfer Student"})[a] || Enum.NA,
					Parent1_Education: a => ({[Enum.PARENT1_EDUCATION.DEGREE]: "One college degree", [Enum.PARENT1_EDUCATION.DIPLOMA]: "High school diploma or equivalent", [Enum.PARENT1_EDUCATION.MULTIPLE_DEGREES]: "More than one college degree", [Enum.PARENT1_EDUCATION.NO_DIPLOMA]: "No high school diploma or equivalent", [Enum.PARENT1_EDUCATION.SOME_COLLEGE]: "Some college", [Enum.PARENT1_EDUCATION.NO_PARENT]: "No Parent 1"})[a] || "N/A",
					Parent2_Education: a => ({[Enum.PARENT2_EDUCATION.DEGREE]: "One college degree", [Enum.PARENT2_EDUCATION.DIPLOMA]: "High school diploma or equivalent", [Enum.PARENT2_EDUCATION.MULTIPLE_DEGREES]: "More than one college degree", [Enum.PARENT2_EDUCATION.NO_DIPLOMA]: "No high school diploma or equivalent", [Enum.PARENT2_EDUCATION.SOME_COLLEGE]: "Some college", [Enum.PARENT2_EDUCATION.NO_PARENT]: "No Parent 2"})[a] || "N/A",
					Campus_Living: a => ({[Enum.CAMPUS_LIVING.ON_CAMPUS]: "On-campus", [Enum.CAMPUS_LIVING.OFF_CAMPUS_RENT]: "Off-campus, paying rent", [Enum.CAMPUS_LIVING.OFF_CAMPUS_NO_RENT]: "Off campus, not paying rent", [Enum.CAMPUS_LIVING.UNCERTAIN]: "Uncertain"})[a] || "N/A",
					Members: numberToStringOr("N/A"),
					EFC: numberToStringOr("N/A"),
					birthday: a => a.toUTCString()
				}
			},
			eliminators: {
				Year: notFirstYear,
				Parent1_Education: notFirstGen,
				Parent2_Education: notFirstGen,
				Income: notLowIncome
			}
		}
	};

	// Converts a string to a number or `altValue` if it is not a number.
	function stringToNumberOr(altValue) {
		return input => typeof input == "symbol" ? altValue : isNaN(input) ? altValue : +input;
	}
	// Converts a number to a string ot `altValue` if it is not a valid number
	function numberToStringOr(altValue) {
		return input => typeof input == "symbol" ? altValue : isNaN(input) ? altValue : input.toString();
	}
	// Checks that an applicant is a first-year student
	function notFirstYear(year) {
		return year != Enum.YEAR.FIRST_YEAR && year != Enum.NA;
	}
	// Checks that an applicant is first-generation
	function notFirstGen(educ) {
		return (
			educ == Enum.PARENT1_EDUCATION.DEGREE ||
			educ == Enum.PARENT1_EDUCATION.MULTIPLE_DEGREES ||
			educ == Enum.PARENT2_EDUCATION.DEGREE ||
			educ == Enum.PARENT2_EDUCATION.MULTIPLE_DEGREES
		);
	}
	function notLowIncome(income) {
		return Array.isArray(income) ? income[0] >= 90000 : isNaN(income) ? false : income >= 90000;
	}
}();