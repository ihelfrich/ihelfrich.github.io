// Academic CV of Ian Helfrich. Source for public/cv/ian-helfrich-cv.pdf.
// Rebuilt on October 24, 2026 from the September 12, 2026 application CV (Helfrich_Academic_CV.pdf),
// whose source was not recoverable. Text is that CV's, with two changes: the NMTC paper has its own
// Job Market Paper section, and Human or Machine? is listed under Research in Progress.
// Build: typst compile cv-source/academic-cv.typ public/cv/ian-helfrich-cv.pdf

#let ink = rgb("#14181d")
#let rule-colour = rgb("#cfd6de")

#set document(title: "Ian Helfrich | Academic Curriculum Vitae", author: "Ian Helfrich")
#set page(
  paper: "us-letter",
  margin: (left: 0.72in, right: 0.72in, top: 0.62in, bottom: 0.8in),
  footer: context align(right, text(size: 9pt)[Ian Helfrich | Curriculum Vitae | #counter(page).display()]),
)
#set text(font: "Times New Roman", size: 10.5pt, fill: ink, lang: "en")
#set par(leading: 0.42em, spacing: 0.5em, justify: false)
#set list(indent: 0.8em, body-indent: 0.45em, spacing: 0.4em, marker: [•])
#show link: it => it

// Sticky, so a heading is never stranded at the foot of a page without its first entry.
#let section(title) = block(sticky: true, above: 0.95em, below: 0.55em)[
  #text(size: 11pt, weight: "bold", upper(title))
  #v(0.1em)
  #line(length: 100%, stroke: 0.5pt + rule-colour)
]
#let dated(left, right) = grid(columns: (1fr, auto), column-gutter: 1em, left, right)
#let role(title, place, when) = block(above: 0.55em, below: 0.3em)[
  #dated(strong(title), when)
  #v(-0.15em)
  #emph(place)
]

#align(center)[
  #text(size: 19pt, weight: "bold")[Ian Helfrich, PhD]
  #v(-0.2em)
  #text(size: 10pt)[#link("mailto:ianthelfrich@gmail.com")[ianthelfrich\@gmail.com] | #link("https://ihelfrich.github.io")[ihelfrich.github.io]]
]

#section[Research interests]
Econometric and statistical methods; economic networks; spatial measurement and international trade; optimal transport and economic equilibrium; quantitative education.

#section[Current research and teaching practice]
*Co-founder, ThirdSpace.* With Elizaveta Gonchar, develop an independent online quantitative research and learning lab connecting shared research projects, methods instruction, and mentorship across disciplinary and institutional boundaries.

#section[Education]
#dated([*PhD, Economics* | Georgia Institute of Technology], [2024])
#dated([*MS, Geographic Information Science and Technology* | Georgia Institute of Technology], [2022])
#dated([*MS, Economics* | Georgia Institute of Technology], [2019])
#dated([*MA, Economics* | Indiana University Bloomington], [2018])
#dated([*MSc, Specialized Economic Analysis* | Barcelona School of Economics], [2015])
#dated([*BA, Economics* | University of North Carolina at Chapel Hill], [2014])
#v(0.15em)
*Doctoral minor:* Quantitative Psychology. *MSc specialization:* Economics and Public Policy.

*Dissertation:* _Redefining Trade Dynamics: Incorporating Network Centrality, Spatial Heterogeneity, and Optimal Transport Theory into Models of International Trade._ Georgia Institute of Technology, August 2024. #link("https://repository.gatech.edu/bitstreams/5162403c-a517-48de-b794-660a053034c9/download")[Dissertation]

*Dissertation co-chairs:* Tibor Besedes and Usha Nair-Reichert.

#section[Job market paper]
*Helfrich, Ian.* “The Rural Mobilization Gap in a U.S. Place-Based Tax Credit.” Job market paper, August 2026. With acknowledged contributions from Katia Antunes and Elizaveta Gonchar. #link("https://ihelfrich.github.io/research/ian-helfrich-nmtc-working-paper.pdf")[Paper]
- Constructed a project-level panel from 19,907 CDFI Fund transactions covering 8,024 New Markets Tax Credit projects with origination years 2001–2022.
- Uses fixed effects, Gelbach decomposition, and distributional comparisons to examine observed rural–urban financing differences. Findings are descriptive and noncausal.
- Built a public evidence viewer connecting source records, model outputs, figures, and manuscript findings.

#section[Working papers and preprints]
*Gonchar, Elizaveta, and Ian Helfrich.* “Trade in the Spotlight: Enhancing Gravity Model Predictions with Nightlights and Population-Weighted Distance Measures.” Preprint, 2025. #link("https://ssrn.com/abstract=5202676")[SSRN 5202676]
- Constructs population- and nightlight-weighted bilateral distance measures and evaluates them in gravity models of interstate and international trade.

*Helfrich, Ian.* “A Unifying Framework for Economic Equilibrium and Optimal Transport in Infinite-Dimensional Hilbert Spaces.” Working paper, 2024. #link("https://ssrn.com/abstract=4772016")[SSRN 4772016]
- Examines the relationship between economic equilibrium and optimal transport when economic objects are represented in infinite-dimensional spaces.

#section[Research in progress]
*Human or Machine? Out-of-Time Validation of Task-Level AI Exposure Ratings* | Sole author. Tests trained-human and GPT-4 task-level AI-exposure ratings against public measures of task use published after the ratings were constructed; in progress.

*Effective Distance* | With Elizaveta Gonchar. Further development of bilateral spatial measurement and structural-gravity validation; in preparation.

*AI and the Entry-Level Labor Market* | With Shane Vardanyan. Research design using CPS microdata, continuous-exposure event studies, and triple differences; empirical analysis in development.

*Pictures of Inference* | With Elizaveta Gonchar. Book and companion workbook in development on statistics and econometrics through visual explanations and worked problems.

#section[Teaching experience]
#role[Instructor of Record and Graduate Teaching Assistant][Georgia Institute of Technology][During doctoral study]
- Instructor of record for three undergraduate economics courses; additional teaching-assistant responsibilities included sections, recitations, assessment, and office hours.
- Received the Economics Graduate Teaching Assistant of the Year award in 2023.
- #link("https://ihelfrich.github.io/cv/cios-evals-2022.pdf")[Georgia Tech course-evaluation record, 2022.]

#role[Graduate Teaching Fellow][Georgia Tech Center for Teaching and Learning][2018–2019]
Member of the inaugural cohort. Designed professional-development curriculum and co-led orientation for teaching assistants and instructors.

#role[Teaching Support][Duke University Global Executive MBA][2016–2017]
Supported instruction in strategy, managerial economics, and global markets.

#role[Graduate Teaching Assistant][Indiana University Bloomington][2015–2016]
Supported undergraduate economics instruction during graduate study.

#role[Online Instructor][Campus / MTI College][2022–2023]
Taught Principles of Microeconomics in Summer and Fall 2022 and Principles of Macroeconomics in Spring 2023.

#role[Independent Quantitative Instructor and Research-Design Coach][Wyzant and direct practice][2021–Present]
- Teach economics, econometrics, statistics, finance, research methods, Python, SQL, Stata, and GIS to students, graduate researchers, and working professionals.
- Help researchers formulate questions, identify data requirements, choose credible comparisons, diagnose models, and interpret results.
- Completed more than 1,035 Wyzant teaching hours as of August 2026, with a 5.0/5 public rating.

#section[Curriculum and research tools]
*Statistics and econometrics.* Visual explanations, public-data exercises, regression workflows, and worked problems connecting mathematical reasoning to implementation and interpretation.

*Research computing.* Python and SQL instruction covering data preparation, diagnostics, and reproducible analysis.

*Spatial methods.* Instruction connecting GIS, public data, geographic measurement, and economic interpretation.

*NMTC evidence viewer.* Public research companion connecting administrative records, model outputs, figures, and manuscript findings. #link("https://github.com/ihelfrich/us-nmtc-viewer")[Research repository]

#section[Honors]
#dated([Georgia Tech Economics Graduate Teaching Assistant of the Year], [2023])
#dated([Georgia Tech Graduate Student Government Senator of the Year], [2020])

#section[Research and advisory experience]
#role[Independent Economist and Quantitative Researcher][Self-directed and collaborative applied research][2024–Present]
- Develop research from question formulation and data construction through econometric analysis, diagnostics, interpretation, and technical writing.
- Build reproducible workflows linking source data, models, tables, figures, and public research tools; document assumptions and the limits of inference.

#role[Independent Economic Advisor][Industrial-sector diagnostics][2026–Present]
- Developed an industrial-sector diagnostic methodology covering indicator selection, analytical sequencing, composite-index construction, and international benchmarking.

#section[Policy research contribution]
_Securing America’s Future: A Framework for Critical Technology Assessment._ National Network for Critical Technology Assessment, 2023. Additional contributor to the semiconductor demonstration in the NSF-sponsored report.

#section[Methods and software]
*Methods:* Panel and fixed-effects models; gravity models and PPML; network measures; spatial measurement; Gelbach decomposition; event-study, difference-in-differences, and triple-difference designs; quantile and median regression; clustered and bootstrap inference; measurement validation.

*Software:* R, Python, Stata, SQL (SQLite and DuckDB), Julia, Excel; QGIS and ArcGIS Pro; Git; LaTeX, Typst, and Quarto.

*Research practice:* Data provenance, reproducible analysis, sensitivity checks, technical writing, and visualization.

#section[Professional service and leadership]
Ad hoc referee: _Journal of Economic Theory._

Georgia Tech Graduate Student Government, 2018–2020. Vice President for Campus Services and graduate senator. Coauthored a policy white paper and represented graduate students in campus planning and service discussions.

#section[Selected research and teaching links]
#link("https://ihelfrich.github.io/job-market")[Academic research and teaching dossier] \
#link("https://ihelfrich.github.io/teaching")[Teaching and quantitative instruction] \
#link("https://github.com/ihelfrich")[Research code and analytical tools]
