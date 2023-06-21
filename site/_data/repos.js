require("dotenv").config()
let graphql = require("@octokit/graphql").graphql.defaults({
  headers: { authorization: `token ${process.env.GITHUB_TOKEN}` },
})

async function reposForOrg(org) {
  async function doQuery(org, after) {
    return await graphql(
      `
        query ($org: String!, $after: String) {
          organization(login: $org) {
            repositories(
              first: 100
              after: $after
              orderBy: { field: STARGAZERS, direction: DESC }
            ) {
              nodes {
                name
                description
                stargazerCount
                homepageUrl
                owner {
                  login
                }
                isArchived
                isFork
                isEmpty
              }
              pageInfo {
                endCursor
                hasNextPage
              }
            }
          }
        }
      `,
      { org, after }
    )
  }

  let out = await doQuery(org, null)

  let repos = out.organization.repositories.nodes

  while (out.organization.repositories.pageInfo.hasNextPage) {
    out = await doQuery(org, out.organization.repositories.pageInfo.endCursor)
    repos = repos.concat(out.organization.repositories.nodes)
  }

  return repos
}

let orgs = ["CMSGov", "CMS-Enterprise", "DSACMS", "Enterprise-CMCS"]

const manualOverrides = {
  "CMSgov/HealthCare.gov-Styleguide": { hide: true }, // deprecated, replaced by design-system
  "CMSgov/qpp-measures-data": {
    description:
      "The source of truth for Quality Payment Program measures data.",
  },
  "CMSgov/beneficiary-fhir-data": {
    description:
      "An internal backend system used at CMS to represent Medicare beneficiaries' demographic, enrollment, and claims data in FHIR format.",
  },
  "CMSgov/QHP-provider-formulary-APIs": {
    description:
      "A set of schemas describing a data format (encoded as JSON) that lists which health care providers and drug formularies are covered by Qualified Health Plans (QHPs) on the federal health insurance marketplace.",
  },
  "Enterprise-CMCS/eAPD": {
    description:
      "This project aims to create a user-friendly, modern product to streamline the creation, submission, review, and approval of Medicaid Advance Planning Documents and their associated contract documents.",
  },
  "CMSgov/dpc-app": {
    description:
      "As patients move throughout the healthcare system, providers often struggle to gain and maintain a complete picture of their patients’ medical history. Data at the Point of Care (DPC) aims to fill these gaps in care by providing Medicare Fee-For-Service claims data to providers in a structured and standardized format.",
  },
  "CMSgov/bcda-app": {
    description:
      "The Beneficiary Claims Data API (BCDA) enables Accountable Care Organizations (ACOs) to retrieve Medicare Part A, Part B, and Part D claims data for their assigned beneficiaries.",
  },
  "CMSgov/bluebutton-web-server": {
    description:
      "A developer-friendly, standards-based API that enables Medicare beneficiaries to connect their claims data to applications, services and research programs they trust.",
  },
  "CMSgov/easi-app": {
    homepageUrl: "https://easi.cms.gov",
    description:
      "EASi is a web application supporting the IT governance process at CMS.",
  },
  "Enterprise-CMCS/macpro-quickstart-serverless": {
    description:
      "Template for a serverless form submission application, built and deployed to AWS with the Serverless Application Framework.",
  },
  "CMS-Enterprise/sbom-harbor": {
    description:
      "A system for collecting, categorizing, storing, and analyzing software bills of materials (SBOMs).",
  },
  "CMSgov/T-MSIS-Data-Quality-Measures-Generation-Code": {
    description:
      "Tools to measure data quality in the Transformed Medicaid Statistical Information System (T-MSIS).",
  },
  "CMSgov/bluebutton-web-deployment": {
    mergeInto: "CMSgov/bluebutton-web-server",
  },
  "CMSgov/CMCS-DSG-DSS-Certification-Staging": {
    mergeInto: "CMSgov/CMCS-DSG-DSS-Certification",
  },
  "CMSgov/CMCS-DSG-DSS-Certification": {
    description:
      "A space for states, CMS, and vendors to learn, share, and contribute information about the Medicare Enterprise Systems Certification process and its related artifacts.",
  },
  "CMSgov/dpc-static-site": { mergeInto: "CMSgov/dpc-app" },
  "Enterprise-CMCS/managed-care-review": {
    description:
      "Managed Care Review is an application that accepts Managed Care contract and rate submissions from states and packages them for review by CMS.",
  },
  "CMSgov/T-MSIS-Analytic-File-Generation-Code": {
    description:
      "Code used to generate CMS' interim T-MSIS Analytic Files (TAF). These new TAF data sets exist alongside the Transformed Medicaid Statistical Information System and serve as an alternate data source tailored to meet the broad research needs of the Medicaid and CHIP data user community.",
  },
  "CMSgov/heimdall-lite.cms.gov": { hide: true }, // just GHA/Pages glue
  "CMSgov/AB2D-Libs": { mergeInto: "CMSgov/ab2d" }, // caps means the pattern below doesn't get it
  "CMSgov/ab2d": {
    description:
      "The AB2D API provides Medicare part D Prescription Drug Sponsors with secure Medicare parts A and B claims data for their plan enrollees.",
  },
  "CMSgov/bcda-ssas-app": { mergeInto: "CMSgov/bcda-app" },
  "CMS-Enterprise/sbom-harbor-ui": { mergeInto: "CMS-Enterprise/sbom-harbor" },
  "CMSgov/easi-shared": { description: "Shared code used by MINT and EASi." },
}

module.exports = async () => {
  try {
    let repos = (await Promise.all(orgs.map((org) => reposForOrg(org)))).flat()
    // sort by stars across all orgs
    repos.sort((a, b) => b.stargazerCount - a.stargazerCount)

    Object.keys(manualOverrides).forEach((path) => {
      const [org, repo] = path.split("/")
      const repoData = repos.find((x) => x.owner.login == org && x.name == repo)
      Object.assign(repoData, manualOverrides[path])
    })

    repos.forEach((repo) => {
      if (
        repo.homepageUrl ==
        `https://github.com/${repo.owner.login}/${repo.name}`
      ) {
        // filter out "website" links that are just a link back to the github repo
        repo.homepageUrl = undefined
      }

      if (repo.name.startsWith("cms-ars-")) {
        // 60+ repos across CMSgov and CMS-Enterprise - this seems as good a
        // place as any to merge them into
        repo.mergeInto = "CMSgov/saf"
      }
      if (repo.name.startsWith("ab2d-")) {
        repo.mergeInto = "CMSgov/ab2d"
      }

      if (repo.name == ".github") {
        // .github repos aren't interesting in and of themselves
        repo.hide = true
      }

      if (repo.mergeInto) {
        let [o, r] = repo.mergeInto.split("/")
        const target = repos.find((x) => x.owner.login == o && x.name == r)
        target.otherRepos = target.otherRepos || []
        target.otherRepos.push(`${repo.owner.login}/${repo.name}`)
        target.stargazerCount = Math.max(
          target.stargazerCount,
          repo.stargazerCount
        )
      }
    })

    repos = repos.filter(
      (repo) =>
        !repo.isArchived &&
        !repo.isFork &&
        !repo.isEmpty &&
        !repo.mergeInto &&
        !repo.hide
    )

    return {
      repos,
    }
  } catch (e) {
    console.error(e)
    return { repos: [] }
  }
}
