export const identityRecord = Object.freeze({
  name: "Ian Helfrich",
  displayName: "Ian Helfrich",
  role: "Applied economist, quantitative research designer, and educator",
  compact: "Ian Helfrich: Applied economist, quantitative research designer, and educator",
  doctorate: "Ph.D. in Economics, Georgia Institute of Technology, 2024",
  location: "St. Louis, Missouri",
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
