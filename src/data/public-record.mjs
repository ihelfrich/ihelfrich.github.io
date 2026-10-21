export const identityRecord = Object.freeze({
  name: "Ian Helfrich",
  displayName: "Ian Helfrich",
  role: "Applied economist, quantitative research designer, and educator",
  compact: "Ian Helfrich: Applied economist, quantitative research designer, and educator",
  doctorate: "Ph.D. in Economics, Georgia Institute of Technology, 2024",
  location: "St. Louis, Missouri",
  // Matches the CV entry "Independent Economist and Quantitative Researcher, 2024–present".
  positionLine: "Independent economist since 2024 · PhD in Economics, Georgia Tech, 2024",
});

// The NMTC working paper as /job-market presents it. Every number below appears in
// public/research/ian-helfrich-nmtc-working-paper.pdf (draft of August 2026).
// TODO(Dr. Helfrich): sign off on `finding`, the one-sentence statement of the result.
// TODO(Dr. Helfrich): the page label stays "Primary public working paper · sole author and
// originator" until the job-market-paper decision (plan item A-01) is settled.
export const nmtcPaperRecord = Object.freeze({
  title: "The rural mobilization gap in a U.S. place-based tax credit",
  subtitle: "Intermediary selection versus market structure in the New Markets Tax Credit",
  version: "August 2026",
  pdf: "/research/ian-helfrich-nmtc-working-paper.pdf",
  record: "/research/helfrich-2026-nmtc-rural-gap",
  finding:
    "Pooled across intermediaries, rural New Markets Tax Credit projects carry less additional capital per dollar of subsidized investment than urban projects (−0.262); within the same Community Development Entity the gap is −0.047 (95% CI −0.245 to +0.152; median −0.001), and 86% of the explained movement is associated with which CDEs originate the deals.",
  abstract:
    "The New Markets Tax Credit gives private investors a 39% federal credit for routing capital through certified Community Development Entities (CDEs) into projects in low-income census tracts. Over FY2001–FY2022 the program placed $66.6 billion of subsidized investment in 8,024 projects worth $120.9 billion. Non-metropolitan tracts received 19.6% of dollars, close to the program’s 20% administrative target, yet project-level leverage was lower there (median 1.07× against 1.19× metro). The raw rural gap is a precise −0.262. With CDE fixed effects, the mean within-CDE estimate is −0.047 and the median-regression analog is −0.001; neither the extensive- nor the intensive-margin estimate is statistically distinguishable from zero within intermediary. Of the explained movement, −0.185, or 86%, is associated with observed CDE composition. Deployment shows no bunching at the 20% target, although compliance may operate through allocation agreements that the public data do not record.",
  design:
    "The within-CDE estimates use CDE fixed effects identified from the 163 of 343 CDEs that deploy on both sides of the rural line; an order-invariant Gelbach decomposition divides the movement between the pooled and within-CDE estimates; and a cross-CDE excess-mass test looks for bunching at the 20% non-metropolitan target.",
});

export const tutoringRecord = Object.freeze({
  asOf: "August 2026",
  asOfShort: "Aug 2026",
  evidenceLabel: "Dated public-platform and private-practice records",
  wyzantHoursHeadline: "1,035+",
  wyzantHoursDisplay: "1,035+",
  wyzantHoursProse: "more than 1,035",
  privateHoursDisplay: "≈1,000",
  privateHoursProse: "nearly 1,000",
  publicRating: "5.0",
  wyzant: Object.freeze({
    asOf: "August 2026",
    evidenceLabel: "Public Wyzant profile",
    hoursHeadline: "1,035+",
    hoursDisplay: "1,035+",
    hoursProse: "more than 1,035",
    rating: "5.0",
  }),
  privatePractice: Object.freeze({
    asOf: "August 2026",
    evidenceLabel: "Private-practice ledger; learner identities withheld",
    hoursDisplay: "≈1,000",
    hoursProse: "nearly 1,000",
  }),
});

export const teachingRecognition = Object.freeze({
  award: "Georgia Tech Economics Graduate Teaching Assistant of the Year",
  year: 2023,
  evidenceLabel: "Departmental teaching award",
  evaluations: Object.freeze({
    year: 2022,
    label: "Georgia Tech course evaluations",
    href: "/cv/cios-evals-2022.pdf",
  }),
});

export const serviceRecord = Object.freeze({
  journalReferee: "Ad hoc referee, Journal of Economic Theory",
});

export const availabilityRecord = Object.freeze({
  cycle: "2026-27 economics job market",
  status: "Available for academic and industry roles, research collaborations, teaching, and select advisory work",
  asOf: "August 2026",
  evidenceLabel: "Current availability statement",
  href: "/job-market/",
});

export const picturesOfInferenceRecord = Object.freeze({
  title: "Pictures of Inference",
  status: "Book and workbook in progress",
  collaborators: "With Elizaveta Gonchar",
  part: "Part One",
  chapters: "chapters 1–10",
  asOf: "August 2026",
  draftedAsOf: "August 14, 2026",
  href: "/projects/pictures-of-inference",
  limit: "Part One remains in draft, and no publication date has been announced.",
});

export const publicLinks = Object.freeze({
  website: "https://ihelfrich.github.io/",
  email: "mailto:ianthelfrich@gmail.com",
  emailAddress: "ianthelfrich@gmail.com",
  github: "https://github.com/ihelfrich",
  linkedin: "https://www.linkedin.com/in/ian-helfrich",
  cv: "/cv/",
  wyzant: "https://www.wyzant.com/Tutors/GA/Smyrna/10212943/",
});

/** Public Motion booking pages, listed on /book. Plain links only; no scheduling script loads on this site. */
export const bookingLinks = Object.freeze([
  { id: "tutoring-intro", label: "Tutoring intro call", minutes: 20, href: "https://app.usemotion.com/meet/ianhelfrich/tutoring-intro", detail: "A first conversation about the subject, your goals, and how sessions would work." },
  { id: "tutoring-session", label: "Tutoring session", minutes: 60, href: "https://app.usemotion.com/meet/ianhelfrich/tutoring-session", detail: "One hour of tutoring or research-design coaching. If we have not worked together yet, start with the intro call." },
  { id: "consulting", label: "Consulting intro call", minutes: 30, href: "https://app.usemotion.com/meet/ianhelfrich/consulting-intro", detail: "For an analysis, study design, or data project. The booking form asks for the question and the deadline." },
  { id: "job-market", label: "Job-market meeting", minutes: 30, href: "https://app.usemotion.com/meet/ianhelfrich/job-market", detail: "For search committees, hiring managers, and colleagues who want to talk about a role or a paper." },
  { id: "meeting", label: "Anything else", minutes: 30, href: "https://app.usemotion.com/meet/ianhelfrich/meeting", detail: "A general meeting for whatever the other four do not cover." },
].map((link) => Object.freeze(link)));
