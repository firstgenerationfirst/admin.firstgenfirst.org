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

	const ICONS = {
		"!FG": (
			<svg key="!FG" data-icon-name="!FG" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
			  <title>Not a first-generation student</title>
			  <path d="M8.33936,76.26074A1.82385,1.82385,0,0,1,6.5083,74.42969V24.75732a1.85851,1.85851,0,0,1,.53418-1.37353,1.7659,1.7659,0,0,1,1.29688-.53418H41.4541a1.82974,1.82974,0,0,1,1.90772,1.90771v5.34082a1.73427,1.73427,0,0,1-.53418,1.33545,1.93532,1.93532,0,0,1-1.37354.4961H16.96143V46.42676H39.92822a1.82974,1.82974,0,0,1,1.90772,1.90771v5.34131a1.76668,1.76668,0,0,1-.53418,1.29688,1.85932,1.85932,0,0,1-1.37354.53418H16.96143V74.42969a1.7667,1.7667,0,0,1-.53418,1.29687,1.85851,1.85851,0,0,1-1.37354.53418Z"/>
			  <path d="M72.73926,77.02344A26.63592,26.63592,0,0,1,60.79785,74.582,17.80738,17.80738,0,0,1,53.167,67.52441,23.08256,23.08256,0,0,1,50.23,56.499q-.0769-3.27978-.07666-7.0581,0-3.7771.07666-7.13428a22.24425,22.24425,0,0,1,2.937-10.835,17.94968,17.94968,0,0,1,7.707-6.94336,26.77358,26.77358,0,0,1,11.86524-2.44189,29.218,29.218,0,0,1,9.7666,1.48779,22.53507,22.53507,0,0,1,6.98144,3.81543,16.89339,16.89339,0,0,1,4.19629,4.99756,11.57777,11.57777,0,0,1,1.48829,4.95947A1.33322,1.33322,0,0,1,94.79,38.49121a1.65,1.65,0,0,1-1.2207.458H85.71a1.80313,1.80313,0,0,1-1.14453-.30518,2.65331,2.65331,0,0,1-.68652-.91552A11.33568,11.33568,0,0,0,81.97168,34.562a10.29932,10.29932,0,0,0-3.51074-2.63232,13.20883,13.20883,0,0,0-5.72168-1.06836A12.00557,12.00557,0,0,0,64.46,33.60791q-3.08935,2.74731-3.31934,9.08008-.22851,6.63794,0,13.4292.23,6.48633,3.39551,9.30859A12.08116,12.08116,0,0,0,72.8916,68.249a14.78187,14.78187,0,0,0,6.1416-1.2207,9.40112,9.40112,0,0,0,4.27344-3.81543,12.69961,12.69961,0,0,0,1.56445-6.63769V54.21H75.56152a1.76287,1.76287,0,0,1-1.29687-.53418,1.85656,1.85656,0,0,1-.53418-1.374v-4.044a1.85811,1.85811,0,0,1,.53418-1.373,1.76666,1.76666,0,0,1,1.29687-.53418H93.79785a1.73969,1.73969,0,0,1,1.33594.53418,1.94074,1.94074,0,0,1,.49512,1.373v8.01172A21.15466,21.15466,0,0,1,92.84473,67.333a18.4408,18.4408,0,0,1-7.93555,7.17285A27.43188,27.43188,0,0,1,72.73926,77.02344Z"/>
			  <path className="fill_red" d="M3.0952,28.75317A1.76126,1.76126,0,0,1,4.041,27.71709a1.76176,1.76176,0,0,1,1.4011-.0587L98.28356,61.45a1.82449,1.82449,0,0,1,1.09459,2.34737l-2.4533,6.74038a1.73993,1.73993,0,0,1-.95869,1.07159,1.83967,1.83967,0,0,1-1.38813.02151L1.73653,37.83924a1.83651,1.83651,0,0,1-1.049-.90857,1.73618,1.73618,0,0,1-.0456-1.43711Z"/>
			</svg>
		  ),
		"!LI": (
		  <svg key="!LI" data-icon-name="!LI" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
			<title>Not a low-income student</title>
			<path d="M24.249,76.25977A1.82385,1.82385,0,0,1,22.418,74.42871v-49.749A1.82385,1.82385,0,0,1,24.249,22.84863h7.09619a1.82385,1.82385,0,0,1,1.83106,1.83106v42.5h24.187a1.82836,1.82836,0,0,1,1.9082,1.9082v5.34082a1.77338,1.77338,0,0,1-.5332,1.29688,1.86191,1.86191,0,0,1-1.375.53418Z"/>
			<path d="M68.50391,76.25977a1.82384,1.82384,0,0,1-1.832-1.83106v-49.749a1.82384,1.82384,0,0,1,1.832-1.83106h7.17187a1.73607,1.73607,0,0,1,1.335.53418,1.83691,1.83691,0,0,1,.4961,1.29688v49.749a1.83359,1.83359,0,0,1-.4961,1.29688,1.73267,1.73267,0,0,1-1.335.53418Z"/>
			<path className="fill_red" d="M3.0952,28.75317A1.76126,1.76126,0,0,1,4.041,27.71709a1.76176,1.76176,0,0,1,1.4011-.0587L98.28356,61.45a1.82449,1.82449,0,0,1,1.09459,2.34737l-2.4533,6.74038a1.73993,1.73993,0,0,1-.95869,1.07159,1.83967,1.83967,0,0,1-1.38813.02151L1.73653,37.83924a1.83651,1.83651,0,0,1-1.049-.90857,1.73618,1.73618,0,0,1-.0456-1.43711Z"/>
		  </svg>
		)
	  }

	window.applicant_spreadsheets = {
		MISSING_FIELD: MISSING_FIELD,
		ICONS: ICONS,
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
				// A list of icons that the applicant is associated with and is displayed next to their name – An array of icons
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
					Birthday: a => new Date(a),
					Icons: a => a.split("|").map(b => b.trim()).filter(b => b)
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
					birthday: a => a.toUTCString(),
					Icons: a => a.join("|")
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